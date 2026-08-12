/**
 * Motore BlindStep: orchestrazione delle quattro fasi.
 *
 *   Fase 1  valutazione del match          -> punteggio, gate, soglia 80%
 *   Fase 2  negoziazione double blind      -> 3 opzioni anonime, consenso
 *   Fase 3  carta incontro e icebreaker    -> luogo, ora, codice, mazzo
 *   Fase 4  conferme e sicurezza           -> T-24h/T-6h/T-1h, check-in, supporto
 *
 * Il flusso si ferma alla prima fase che non passa e dice perche'. Nessuna
 * fase inventa dati mancanti: se non c'e' un posto equo e sicuro, il match non
 * diventa un incontro, e va bene cosi'.
 */

import { DEFAULT_THRESHOLD, evaluateMatch, rankCandidates } from './phase1-compatibility.js';
import {
  proposeLocations,
  reproposeLocations,
  resolveLocationConsensus,
} from './phase2-location.js';
import { buildEventCard, eventCardFor, generateIcebreakers } from './phase3-eventcard.js';
import {
  advance,
  cancelMeeting,
  checkIn,
  confirmCheckpoint,
  createMeetingPlan,
  openSupportChannel,
  summarizePlan,
} from './phase4-safety.js';

export {
  evaluateMatch,
  rankCandidates,
  proposeLocations,
  reproposeLocations,
  resolveLocationConsensus,
  buildEventCard,
  eventCardFor,
  generateIcebreakers,
  createMeetingPlan,
  confirmCheckpoint,
  checkIn,
  advance,
  cancelMeeting,
  openSupportChannel,
  summarizePlan,
  DEFAULT_THRESHOLD,
};

/**
 * Voto automatico di un utente sulle opzioni anonime.
 *
 * Usa esclusivamente la vista anonima di quell'utente - le stesse informazioni
 * che avrebbe sullo schermo - quindi e' anche la prova che la scelta e'
 * possibile senza sapere niente dell'altro.
 *
 * @param {import('./types.js').Profile} profile
 * @param {any[]} view opzioni come le vede quell'utente
 * @param {{ maxTravelMinutes?: number }} [options]
 * @returns {string[]} optionId in ordine di preferenza
 */
export function autoRanking(profile, view, options = {}) {
  const maxTravel = options.maxTravelMinutes ?? 35;
  const vibePriority = (opzione) => {
    const vibes = profile.vibes ?? [];
    const candidates = [opzione.tipo_key, ...(opzione.anche_keys ?? [])];
    const positions = candidates
      .map((tipo) => vibes.indexOf(tipo))
      .filter((index) => index !== -1);
    return positions.length ? Math.min(...positions) : 99;
  };
  const travelOf = (opzione) => opzione.minuti_di_viaggio ?? 999;

  return view
    .filter((opzione) => travelOf(opzione) <= maxTravel)
    .sort(
      (x, y) =>
        vibePriority(x) - vibePriority(y) ||
        travelOf(x) - travelOf(y) ||
        x.optionId.localeCompare(y.optionId),
    )
    .map((opzione) => opzione.optionId);
}

/**
 * Esegue l'intero flusso per una coppia di profili.
 *
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {{
 *   now?: Date,
 *   threshold?: number,
 *   venues?: import('./types.js').Venue[],
 *   rankings?: { [userId: string]: string[] },
 *   maxRounds?: number,
 *   deckSize?: number,
 * }} [options]
 */
export function runMatchFlow(a, b, options = {}) {
  const now = options.now ?? new Date();
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const matchId = `${a.id}-${b.id}`;

  // --- Fase 1 ----------------------------------------------------------------
  const evaluation = evaluateMatch(a, b, { threshold });
  if (!evaluation.proceed) {
    return {
      esito: evaluation.eligible ? 'sotto_soglia' : 'non_compatibile',
      matchId,
      fase1: evaluation,
      motivo: evaluation.eligible
        ? `Punteggio ${evaluation.score}% sotto la soglia del ${threshold}%`
        : evaluation.blockers.join('; '),
    };
  }

  // --- Fase 2 ----------------------------------------------------------------
  const maxRounds = options.maxRounds ?? 2;
  let proposal = proposeLocations(a, b, evaluation, { venues: options.venues });
  let consensus = null;
  let round = 0;

  while (proposal.ok && round < maxRounds) {
    const rankingA = options.rankings?.[a.id] ?? autoRanking(a, proposal.viewFor(a.id));
    const rankingB = options.rankings?.[b.id] ?? autoRanking(b, proposal.viewFor(b.id));
    consensus = resolveLocationConsensus(proposal, rankingA, rankingB);
    if (consensus.ok) break;
    round += 1;
    if (round >= maxRounds) break;
    proposal = reproposeLocations(a, b, evaluation, proposal, { venues: options.venues });
  }

  if (!proposal.ok) {
    return {
      esito: 'nessuna_location',
      matchId,
      fase1: evaluation,
      fase2: proposal,
      motivo: proposal.reason,
    };
  }
  if (!consensus?.ok) {
    return {
      esito: 'nessun_consenso',
      matchId,
      fase1: evaluation,
      fase2: proposal,
      motivo: consensus?.reason ?? 'Consenso non raggiunto',
    };
  }

  // --- Fase 3 ----------------------------------------------------------------
  const eventCard = buildEventCard(a, b, evaluation, consensus.chosen, {
    now,
    matchId,
    deckSize: options.deckSize,
  });

  // --- Fase 4 ----------------------------------------------------------------
  const plan = createMeetingPlan(eventCard, { now });

  return {
    esito: 'incontro_fissato',
    matchId,
    fase1: evaluation,
    fase2: { proposal, consensus, giri: round + 1 },
    fase3: eventCard,
    fase4: plan,
    /** Payload per un singolo client, gia' ripulito dai dati dell'altro. */
    schedaPer: (userId) => eventCardFor(eventCard, userId),
  };
}
