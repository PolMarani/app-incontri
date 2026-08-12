/**
 * FASE 1 - Valutazione del match.
 *
 * Due profili anonimizzati entrano, un punteggio 0..100 esce. Sopra la soglia
 * (default 80) si passa alla Fase 2.
 *
 * La logica ha due livelli:
 *  - GATE obbligatori: se saltano, il match e' impossibile a prescindere dal
 *    punteggio (nessuna fascia oraria in comune, aree di spostamento disgiunte,
 *    dealbreaker dichiarati, nessuna vibe compatibile). Un match che non puo'
 *    diventare un'uscita reale non ha senso in un'app senza chat: non c'e' un
 *    ripiego "intanto ci scriviamo".
 *  - PUNTEGGIO pesato sulle dimensioni residue.
 */

import { distanceKm, midpoint, travelZonesOverlap } from './util/geo.js';
import { overlappingWindows, totalOverlapMinutes } from './util/time.js';
import { interestSimilarity, vibeSimilarity } from './data/taxonomy.js';

/** Pesi delle dimensioni di compatibilita'. La somma fa 1. */
export const WEIGHTS = {
  availability: 0.22,
  geography: 0.18,
  vibe: 0.2,
  interests: 0.22,
  values: 0.12,
  spark: 0.06,
};

export const DEFAULT_THRESHOLD = 80;
export const DEFAULT_MAX_TRAVEL_KM = 5;
const MIN_MEETING_MINUTES = 90;

/**
 * Calibrazione: ogni dimensione vale 1 quando la condizione e' "chiaramente
 * buona per una serata", non quando e' perfetta. Serve una sera libera in
 * comune, non otto; servono due argomenti veri, non dieci. Con una scala
 * tarata sul massimo teorico nessuna coppia reale supererebbe mai l'80%, e la
 * soglia diventerebbe decorativa.
 */
const OVERLAP_SATURATION_MIN = 3 * 60;

/** Forza degli interessi in comune oltre la quale non si guadagna piu'. */
const INTEREST_SATURATION = 2;

/**
 * Forza dei punti di contatto fra due liste di interessi.
 *
 * Accoppia gli interessi a due a due in modo greedy, dal legame piu' forte al
 * piu' debole, e ogni tag puo' essere usato una volta sola: due profili che
 * dicono entrambi "musica" in cinque modi diversi hanno un argomento in comune,
 * non cinque.
 *
 * @param {string[]} a
 * @param {string[]} b
 * @returns {{ strength: number, pairs: Array<[string, string, number]> }}
 */
function matchStrength(a, b) {
  /** @type {Array<[string, string, number]>} */
  const candidates = [];
  for (const tagA of a) {
    for (const tagB of b) {
      const sim = interestSimilarity(tagA, tagB);
      if (sim > 0) candidates.push([tagA, tagB, sim]);
    }
  }
  candidates.sort((x, y) => y[2] - x[2] || x[0].localeCompare(y[0]));

  const usedA = new Set();
  const usedB = new Set();
  const pairs = [];
  let strength = 0;
  for (const [tagA, tagB, sim] of candidates) {
    if (usedA.has(tagA) || usedB.has(tagB)) continue;
    usedA.add(tagA);
    usedB.add(tagB);
    pairs.push([tagA, tagB, sim]);
    strength += sim;
  }
  return { strength, pairs };
}

/**
 * Interessi in comune, esatti o della stessa famiglia.
 * @param {string[]} a
 * @param {string[]} b
 * @returns {{ shared: string[], complementary: string[] }}
 */
function partitionInterests(a, b) {
  const shared = [];
  const complementary = [];
  const setB = new Set(b);
  for (const tag of a) {
    if (setB.has(tag)) {
      shared.push(tag);
    } else if (b.some((other) => interestSimilarity(tag, other) > 0)) {
      shared.push(tag);
    } else {
      complementary.push(tag);
    }
  }
  for (const tag of b) {
    const inA = a.some((other) => interestSimilarity(tag, other) > 0);
    if (!inA) complementary.push(tag);
  }
  return { shared: [...new Set(shared)], complementary: [...new Set(complementary)] };
}

/**
 * Punteggio delle vibe: si confronta ogni vibe di A con ogni vibe di B tenendo
 * conto della posizione in classifica (la prima scelta pesa piu' della terza).
 * @param {string[]} vibesA
 * @param {string[]} vibesB
 * @returns {{ score: number, consensus: string[] }}
 */
function scoreVibes(vibesA, vibesB) {
  if (vibesA.length === 0 || vibesB.length === 0) {
    return { score: 0, consensus: [] };
  }
  const rankWeight = (index, total) => 1 - (index / total) * 0.4; // 1 -> 0.6

  /** @type {Array<{ vibe: string, weight: number }>} */
  const scored = [];
  let best = 0;

  for (const [i, va] of vibesA.entries()) {
    for (const [j, vb] of vibesB.entries()) {
      const sim = vibeSimilarity(va, vb);
      if (sim === 0) continue;
      const weight =
        sim * rankWeight(i, vibesA.length) * rankWeight(j, vibesB.length);
      if (weight > best) best = weight;
      // La vibe di consenso e' quella "piu' condivisa": se coincidono si prende
      // quella, se sono adiacenti si tengono entrambe come candidate.
      scored.push({ vibe: va, weight });
      if (va !== vb) scored.push({ vibe: vb, weight: weight * 0.99 });
    }
  }

  const consensus = [...new Map(
    scored
      .sort((x, y) => y.weight - x.weight)
      .map((entry) => [entry.vibe, entry.weight]),
  ).keys()];

  return { score: best, consensus };
}

/**
 * Sovrapposizione semplice fra insiemi di valori (Jaccard smorzato: chi
 * dichiara pochi valori non viene penalizzato all'osso).
 * @param {string[]} a
 * @param {string[]} b
 * @returns {{ score: number, shared: string[] }}
 */
function scoreValues(a, b) {
  if (a.length === 0 || b.length === 0) return { score: 0.5, shared: [] };
  const setB = new Set(b);
  const shared = a.filter((v) => setB.has(v));
  const union = new Set([...a, ...b]).size;
  const jaccard = shared.length / union;
  // 0 valori in comune non e' un veto, e' solo assenza di segnale: si parte da
  // 0.35 e si sale.
  return { score: Math.min(1, 0.35 + jaccard * 1.3), shared };
}

/**
 * "Spark": la divergenza stimolante. Due profili identici fanno una serata
 * piatta, due profili senza alcun punto di contatto fanno una serata muta.
 *
 * L'ottimo e' intorno al 55% di interessi non condivisi: nei profili reali si
 * dichiarano quattro o cinque interessi a testa e averne piu' di due in comune
 * e' raro, quindi un ottimo tarato piu' in basso premierebbe solo i cloni.
 * @param {number} sharedCount
 * @param {number} complementaryCount
 * @returns {number} 0..1
 */
function scoreSpark(sharedCount, complementaryCount) {
  const total = sharedCount + complementaryCount;
  if (total === 0) return 0;
  const divergence = complementaryCount / total;
  const ideal = 0.55;
  return Math.max(0, 1 - Math.abs(divergence - ideal) / 0.55);
}

/**
 * Gate sui dealbreaker: un tag dichiarato incompatibile da una parte non deve
 * comparire fra interessi e valori dell'altra.
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @returns {string[]} motivi di blocco
 */
function dealbreakerBlockers(a, b) {
  const blockers = [];
  const check = (source, target, label) => {
    const surface = new Set([...(target.interests ?? []), ...(target.values ?? [])]);
    for (const tag of source.dealbreakers ?? []) {
      if (surface.has(tag)) blockers.push(`${label}: dealbreaker dichiarato su "${tag}"`);
    }
  };
  check(a, b, 'Utente A');
  check(b, a, 'Utente B');
  return blockers;
}

/**
 * Valuta la compatibilita' fra due profili.
 *
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {{ threshold?: number, minMeetingMinutes?: number }} [options]
 * @returns {import('./types.js').MatchEvaluation}
 */
export function evaluateMatch(a, b, options = {}) {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const minMeetingMinutes = options.minMeetingMinutes ?? MIN_MEETING_MINUTES;

  /** @type {string[]} */
  const blockers = [];

  // --- Gate 1: disponibilita' ------------------------------------------------
  const commonWindows = overlappingWindows(
    a.availability,
    b.availability,
    minMeetingMinutes,
  );
  if (commonWindows.length === 0) {
    blockers.push(
      `Nessuna finestra comune di almeno ${minMeetingMinutes} minuti`,
    );
  }
  const overlapMinutes = totalOverlapMinutes(commonWindows);
  // Avere piu' giorni disponibili non allunga la serata, ma rende l'incontro
  // recuperabile se salta: vale un piccolo bonus, non una dimensione a se.
  const distinctDays = new Set(commonWindows.map((w) => w.day)).size;
  const availabilityScore = Math.min(
    1,
    (overlapMinutes / OVERLAP_SATURATION_MIN) * (1 + 0.05 * Math.max(0, distinctDays - 1)),
  );

  // --- Gate 2: geografia -----------------------------------------------------
  const maxA = a.maxTravelKm ?? DEFAULT_MAX_TRAVEL_KM;
  const maxB = b.maxTravelKm ?? DEFAULT_MAX_TRAVEL_KM;
  const separationKm = distanceKm(a.origin, b.origin);
  if (!travelZonesOverlap(a.origin, b.origin, maxA, maxB)) {
    blockers.push(
      `Aree di spostamento disgiunte (${separationKm.toFixed(1)} km fra le zone, ` +
        `budget combinato ${maxA + maxB} km)`,
    );
  }
  // Il punto medio deve essere raggiungibile da entrambi: e' la condizione di
  // equita' vera, piu' stretta della semplice intersezione dei due cerchi.
  const center = midpoint(a.origin, b.origin);
  const halfKm = separationKm / 2;
  if (halfKm > maxA || halfKm > maxB) {
    blockers.push(
      'Il punto a meta strada e fuori dal raggio di almeno uno dei due',
    );
  }
  // Curva morbida vicino allo zero e ripida vicino al limite: due persone a
  // due chilometri sono "in zona" quanto due che abitano nella stessa via, ma
  // avvicinarsi al bordo del raggio consentito penalizza in fretta.
  const tighterBudgetKm = Math.max(0.001, Math.min(maxA, maxB));
  const geographyScore = Math.max(
    0,
    1 - (halfKm / tighterBudgetKm) ** 1.5,
  );

  // --- Gate 3: vibe ----------------------------------------------------------
  const { score: vibeScore, consensus: consensusVibes } = scoreVibes(
    a.vibes ?? [],
    b.vibes ?? [],
  );
  if (vibeScore === 0) {
    blockers.push('Nessuna vibe compatibile fra le preferenze dichiarate');
  }

  // --- Gate 4: dealbreaker ---------------------------------------------------
  blockers.push(...dealbreakerBlockers(a, b));

  // --- Punteggio -------------------------------------------------------------
  const interestsA = a.interests ?? [];
  const interestsB = b.interests ?? [];
  // Conta la forza dei legami, non la percentuale di profilo coperta: la parte
  // di profilo che NON si sovrappone e' gia' valutata da `spark`, e contarla
  // due volte punirebbe chiunque abbia interessi propri.
  const { strength, pairs } = matchStrength(interestsA, interestsB);
  const interestsScore = Math.min(1, strength / INTEREST_SATURATION);
  const { shared: sharedInterests, complementary: complementaryInterests } =
    partitionInterests(interestsA, interestsB);
  const { score: valuesScore, shared: sharedValues } = scoreValues(
    a.values ?? [],
    b.values ?? [],
  );
  const sparkScore = scoreSpark(sharedInterests.length, complementaryInterests.length);

  const breakdown = {
    availability: availabilityScore,
    geography: geographyScore,
    vibe: vibeScore,
    interests: interestsScore,
    values: valuesScore,
    spark: sparkScore,
  };

  const raw = Object.entries(WEIGHTS).reduce(
    (sum, [key, weight]) => sum + breakdown[key] * weight,
    0,
  );
  const score = Math.round(raw * 1000) / 10; // una cifra decimale

  const eligible = blockers.length === 0;
  return {
    eligible,
    score,
    proceed: eligible && score >= threshold,
    breakdown,
    blockers,
    sharedInterests,
    complementaryInterests,
    /** Accoppiamenti effettivi fra interessi: [tagA, tagB, forza]. */
    interestPairs: pairs,
    sharedValues,
    commonWindows,
    consensusVibes,
    meetingCenter: center,
  };
}

/**
 * Ordina i candidati per un utente e restituisce solo quelli che superano la
 * soglia. Usato dal ciclo di matching giornaliero.
 * @param {import('./types.js').Profile} user
 * @param {import('./types.js').Profile[]} candidates
 * @param {{ threshold?: number }} [options]
 * @returns {Array<{ candidate: import('./types.js').Profile, evaluation: import('./types.js').MatchEvaluation }>}
 */
export function rankCandidates(user, candidates, options = {}) {
  return candidates
    .map((candidate) => ({
      candidate,
      evaluation: evaluateMatch(user, candidate, options),
    }))
    .filter((entry) => entry.evaluation.proceed)
    .sort((x, y) => y.evaluation.score - x.evaluation.score);
}
