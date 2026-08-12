/**
 * FASE 2 - Negoziazione "double blind" della posizione.
 *
 * Regola di riservatezza che governa tutto il file: nessuno dei due utenti puo'
 * dedurre da cosa vede dove abita l'altro. Concretamente:
 *  - le tre opzioni sono presentate senza nome ne' indirizzo finche' non c'e'
 *    accordo (chi conosce la citta' identificherebbe il locale, e da li' la
 *    zona dell'altro);
 *  - ogni utente vede solo il PROPRIO tempo di percorrenza, mai quello
 *    dell'altro e mai la distanza fra i due;
 *  - le opzioni sono identiche per entrambi e presentate nello stesso ordine,
 *    cosi' nessuno dei due puo' capire quale sia "piu' comoda all'altro".
 *
 * L'equita' e' garantita a monte dal motore, non dalla trattativa: si scelgono
 * solo locali per cui i due percorsi sono confrontabili.
 */

import { distanceKm, fairnessScore, midpoint, travelEstimate } from './util/geo.js';
import { DAYS, dayLabel, normalizeWindow, toHHMM } from './util/time.js';
import { VIBE_LABELS, vibeSimilarity } from './data/taxonomy.js';
import { loadVenues } from './data/venues.js';

/** Sotto questa soglia un locale non entra mai in proposta. */
const MIN_SAFETY_SCORE = 0.6;
const MIN_MEETING_MINUTES = 90;
const OPTIONS_TO_PRESENT = 3;

/** Pesi del punteggio di una location. */
const VENUE_WEIGHTS = {
  fairness: 0.28,
  vibe: 0.22,
  safety: 0.25,
  tragitto: 0.25,
};

/** Oltre questi minuti di viaggio una proposta comincia a essere un peso. */
const TRAVEL_TOLERANCE_MIN = 30;

/**
 * Il locale rispetta i requisiti dichiarati da entrambi?
 * @param {import('./types.js').Venue} venue
 * @param {import('./types.js').VenueConstraints[]} constraintSets
 * @returns {string|null} motivo dello scarto, o null se va bene
 */
function constraintViolation(venue, constraintSets) {
  const f = venue.features;
  if (!f.publicPlace) return 'non e un luogo pubblico';
  if (!f.staffed) return 'senza personale presente';
  if (!f.wellLit) return 'illuminazione non verificata';
  if (venue.safetyScore < MIN_SAFETY_SCORE) return 'safety score sotto soglia';

  for (const c of constraintSets) {
    if (!c) continue;
    if (c.noAlcohol && f.servesAlcohol) return 'serve alcolici';
    if (c.wheelchairAccess && !f.wheelchairAccess) return 'non accessibile in sedia a rotelle';
    if (c.lowNoise && f.noiseLevel === 'alto') return 'troppo rumoroso';
    if (c.outdoorOnly && !f.outdoor) return 'nessuno spazio all aperto';
  }
  return null;
}

/**
 * Arrotonda l'inizio al successivo :00 o :30. Un appuntamento alle 19:07 e' un
 * appuntamento che qualcuno sbaglia.
 * @param {number} minutes
 * @returns {number}
 */
function roundStart(minutes) {
  return Math.ceil(minutes / 30) * 30;
}

/**
 * Interseca una finestra comune con gli orari del locale in quel giorno.
 * @param {import('./util/time.js').MinuteWindow} window
 * @param {import('./types.js').Venue} venue
 * @param {number} minMeetingMinutes
 * @returns {{ day: string, startMin: number, endMin: number }|null}
 */
function feasibleSlot(window, venue, minMeetingMinutes) {
  let best = null;
  for (const oh of venue.openingHours) {
    if (oh.day !== window.day) continue;
    // Un bar aperto "17:00-01:00" chiude a 1500 minuti, non a 60: la stessa
    // convenzione delle disponibilita' utente.
    const { startMin: openMin, endMin: closeMin } = normalizeWindow(oh);
    const startMin = roundStart(Math.max(window.startMin, openMin));
    const endMin = Math.min(window.endMin, closeMin);
    if (endMin - startMin < minMeetingMinutes) continue;
    if (!best || startMin < best.startMin) {
      best = { day: window.day, startMin, endMin };
    }
  }
  return best;
}

/**
 * Miglior corrispondenza fra le vibe di consenso e quelle coperte dal locale.
 * @param {import('./types.js').Venue} venue
 * @param {string[]} consensusVibes
 * @returns {{ score: number, vibe: string|null }}
 */
function venueVibeMatch(venue, consensusVibes) {
  let best = { score: 0, vibe: null };
  for (const wanted of consensusVibes) {
    for (const has of venue.vibes) {
      const sim = vibeSimilarity(wanted, has);
      if (sim > best.score) best = { score: sim, vibe: has };
    }
  }
  return best;
}

/**
 * Calcola e ordina i candidati. Esposta separatamente dal wrapper pubblico
 * perche' serve anche al ri-lancio dopo un mancato consenso.
 *
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {import('./types.js').MatchEvaluation} evaluation
 * @param {{ venues?: import('./types.js').Venue[], excludeVenueIds?: string[], minMeetingMinutes?: number }} [options]
 */
function scoreCandidates(a, b, evaluation, options = {}) {
  const venues = options.venues ?? loadVenues();
  const excluded = new Set(options.excludeVenueIds ?? []);
  const minMeetingMinutes = options.minMeetingMinutes ?? MIN_MEETING_MINUTES;
  const maxA = a.maxTravelKm ?? 5;
  const maxB = b.maxTravelKm ?? 5;
  const center = midpoint(a.origin, b.origin);

  /** @type {Array<{ venue: any, slot: any, kmA: number, kmB: number, score: number, vibe: string|null, parts: object }>} */
  const candidates = [];
  /** @type {Array<{ venueId: string, reason: string }>} */
  const rejected = [];

  for (const venue of venues) {
    if (excluded.has(venue.id)) {
      rejected.push({ venueId: venue.id, reason: 'gia scartato in un giro precedente' });
      continue;
    }
    const violation = constraintViolation(venue, [a.constraints, b.constraints]);
    if (violation) {
      rejected.push({ venueId: venue.id, reason: violation });
      continue;
    }

    const kmA = distanceKm(a.origin, venue.location);
    const kmB = distanceKm(b.origin, venue.location);
    if (kmA > maxA || kmB > maxB) {
      rejected.push({ venueId: venue.id, reason: 'fuori dal raggio di spostamento' });
      continue;
    }

    const vibeMatch = venueVibeMatch(venue, evaluation.consensusVibes);
    if (vibeMatch.score === 0) {
      rejected.push({ venueId: venue.id, reason: 'vibe non compatibile' });
      continue;
    }

    // Fra tutte le finestre comuni si tiene la prima praticabile: la piu'
    // vicina nel tempo, perche' l'app vive di incontri immediati.
    let slot = null;
    for (const window of evaluation.commonWindows) {
      slot = feasibleSlot(window, venue, minMeetingMinutes);
      if (slot) break;
    }
    if (!slot) {
      rejected.push({ venueId: venue.id, reason: 'orari incompatibili con la finestra comune' });
      continue;
    }

    const travelA = travelEstimate(kmA, { transitNearby: venue.features.transitNearby });
    const travelB = travelEstimate(kmB, { transitNearby: venue.features.transitNearby });
    // Conta il tragitto piu' lungo dei due: e' quello che fa saltare la serata.
    const peggiore = Math.max(travelA.minuti, travelB.minuti);

    const parts = {
      fairness: fairnessScore(kmA, kmB),
      vibe: vibeMatch.score,
      safety: venue.safetyScore,
      tragitto: Math.max(0, 1 - peggiore / (TRAVEL_TOLERANCE_MIN * 2)),
    };
    const score = Object.entries(VENUE_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + Math.min(1, parts[key]) * weight,
      0,
    );

    candidates.push({
      venue, slot, kmA, kmB, travelA, travelB, score, vibe: vibeMatch.vibe, parts,
      centralita: distanceKm(center, venue.location),
    });
  }

  candidates.sort(
    (x, y) =>
      y.score - x.score ||
      DAYS.indexOf(x.slot.day) - DAYS.indexOf(y.slot.day) ||
      x.venue.id.localeCompare(y.venue.id),
  );
  return { candidates, rejected };
}

/**
 * Vista anonima di un'opzione, personalizzata per un singolo utente.
 * Contiene solo cio' che quell'utente puo' sapere.
 * @param {{ venue: any, slot: any, vibe: string|null }} candidate
 * @param {number} index
 * @param {{ minuti: number, modo: string }} ownTravel
 */
function anonymousView(candidate, index, ownTravel) {
  const { venue, slot } = candidate;
  return {
    optionId: `opt-${index + 1}`,
    etichetta: `Opzione ${index + 1}`,
    // Il tipo e' quello che il posto e' davvero, non la vibe che ha fatto
    // scattare l'abbinamento: una ludoteca annunciata come "caffe tranquillo"
    // e' una sorpresa sgradita all'arrivo.
    tipo: VIBE_LABELS[venue.vibes[0]] ?? venue.vibes[0],
    tipo_key: venue.vibes[0],
    anche: venue.vibes.slice(1).map((v) => VIBE_LABELS[v] ?? v),
    anche_keys: venue.vibes.slice(1),
    atmosfera: venue.atmosphere,
    rumore: venue.features.noiseLevel,
    quando: `${dayLabel(slot.day)} dalle ${toHHMM(slot.startMin)}`,
    aperto_fino_a: toHHMM(slot.endMin),
    // Solo il proprio tragitto: nessun riferimento all'altra persona.
    dal_tuo_punto_di_partenza: `circa ${ownTravel.minuti} minuti ${ownTravel.modo}`,
    minuti_di_viaggio: ownTravel.minuti,
    accessibile: Boolean(venue.features.wheelchairAccess),
    all_aperto: Boolean(venue.features.outdoor),
    servono_alcolici: Boolean(venue.features.servesAlcohol),
    zona_verificata: true,
  };
}

/**
 * Costruisce la proposta di Fase 2: tre opzioni pubbliche e sicure a meta'
 * strada, presentate in forma anonima a entrambi.
 *
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {import('./types.js').MatchEvaluation} evaluation
 * @param {{ venues?: import('./types.js').Venue[], excludeVenueIds?: string[], minMeetingMinutes?: number }} [options]
 * @returns {{ ok: boolean, reason?: string, options: any[], viewFor: (userId: string) => any[], rejected: any[] }}
 */
export function proposeLocations(a, b, evaluation, options = {}) {
  const { candidates, rejected } = scoreCandidates(a, b, evaluation, options);
  const shortlist = candidates.slice(0, OPTIONS_TO_PRESENT);

  if (shortlist.length === 0) {
    return {
      ok: false,
      reason:
        'Nessun luogo pubblico soddisfa insieme raggio, orari, vibe e requisiti dei due profili',
      options: [],
      viewFor: () => [],
      rejected,
    };
  }

  const viewsA = shortlist.map((c, i) => anonymousView(c, i, c.travelA));
  const viewsB = shortlist.map((c, i) => anonymousView(c, i, c.travelB));

  return {
    ok: true,
    // `options` contiene i dati completi: resta lato server, non va mai
    // serializzato verso un client.
    options: shortlist.map((c, i) => ({
      optionId: `opt-${i + 1}`,
      venue: c.venue,
      slot: c.slot,
      vibe: c.vibe,
      score: Math.round(c.score * 1000) / 1000,
      fairness: Math.round(c.parts.fairness * 100) / 100,
      travelA: c.travelA,
      travelB: c.travelB,
    })),
    /**
     * Payload effettivamente inviato a un client.
     * @param {string} userId
     */
    viewFor(userId) {
      if (userId === a.id) return viewsA;
      if (userId === b.id) return viewsB;
      throw new Error(`Utente ${userId} non fa parte di questo match`);
    },
    rejected,
  };
}

/**
 * Algoritmo di consenso.
 *
 * Ogni utente invia le opzioni che accetta, in ordine di preferenza. Chi non
 * compare in lista e' rifiutato. Vince l'opzione accettata da entrambi con la
 * somma dei piazzamenti piu' bassa; a parita' vince quella piu' equa, poi
 * quella con punteggio di locale piu' alto.
 *
 * @param {ReturnType<typeof proposeLocations>} proposal
 * @param {string[]} rankingA optionId in ordine di preferenza
 * @param {string[]} rankingB
 * @returns {{ ok: boolean, reason?: string, chosen?: any, tally?: any[] }}
 */
export function resolveLocationConsensus(proposal, rankingA, rankingB) {
  if (!proposal.ok) {
    return { ok: false, reason: 'Nessuna proposta valida da votare' };
  }
  const valid = new Set(proposal.options.map((o) => o.optionId));
  const clean = (ranking) => (ranking ?? []).filter((id) => valid.has(id));
  const listA = clean(rankingA);
  const listB = clean(rankingB);

  if (listA.length === 0 || listB.length === 0) {
    return {
      ok: false,
      reason:
        'Almeno uno dei due non ha accettato nessuna opzione: si rilancia con locali diversi',
    };
  }

  const tally = proposal.options
    .filter((o) => listA.includes(o.optionId) && listB.includes(o.optionId))
    .map((o) => ({
      optionId: o.optionId,
      rankSum: listA.indexOf(o.optionId) + listB.indexOf(o.optionId),
      fairness: o.fairness,
      score: o.score,
      option: o,
    }))
    .sort(
      (x, y) => x.rankSum - y.rankSum || y.fairness - x.fairness || y.score - x.score,
    );

  if (tally.length === 0) {
    return {
      ok: false,
      reason: 'Le preferenze non si incrociano su nessuna opzione: si rilancia',
      tally: [],
    };
  }

  return { ok: true, chosen: tally[0].option, tally };
}

/**
 * Rilancio dopo un mancato consenso: esclude i locali gia' proposti e ne cerca
 * altri tre.
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {import('./types.js').MatchEvaluation} evaluation
 * @param {ReturnType<typeof proposeLocations>} previous
 * @param {object} [options]
 */
export function reproposeLocations(a, b, evaluation, previous, options = {}) {
  const already = previous.options.map((o) => o.venue.id);
  return proposeLocations(a, b, evaluation, {
    ...options,
    excludeVenueIds: [...(options.excludeVenueIds ?? []), ...already],
  });
}
