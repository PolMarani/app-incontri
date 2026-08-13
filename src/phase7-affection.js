/**
 * FASE 7 - Momenti di affetto.
 *
 * Durante la serata l'app può' proporre un gesto fisico: un brindisi, un
 * contatto di mano, un bacio sulla guancia, un abbraccio breve, un abbraccio di
 * venti secondi. Arrivano in momenti imprevedibili, non a orari fissi.
 *
 * ── Il problema, e la forma che lo risolve ────────────────────────────────
 *
 * Proporre un abbraccio a due sconosciuti ha un modo ovvio di andare male: se
 * la proposta compare in mezzo al tavolo, chi non se la sente deve dire di no
 * *davanti all'altra persona*, e a quel punto non e' piu' una scelta libera -
 * e' una cosa che si subisce per non fare una figuraccia. Un gesto fatto per
 * imbarazzo e' esattamente il contrario di un gesto affettuoso.
 *
 * Quindi vale la stessa forma della Fase 2, che l'app usa già' per la
 * location:
 *
 *  1. La proposta arriva **separatamente** sullo schermo di ciascuno.
 *  2. Serve il **si' di entrambi**, dato senza sapere cosa ha risposto l'altro.
 *  3. Se salta, i due vedono **lo stesso identico messaggio**, che non
 *     distingue fra "l'altro ha detto no", "l'altro non ha guardato il
 *     telefono" e "il momento e' scaduto". L'ambiguita' e' voluta: senza,
 *     accettare diventerebbe un rischio e non lo farebbe piu' nessuno.
 *  4. Il rifiuto costa **un tocco**, non e' registrato da nessuna parte e
 *     alza l'asticella per le proposte successive.
 *
 * ── Cos'e' casuale e cosa non lo e' ──────────────────────────────────────
 *
 * E' casuale il **quando**: la proposta scatta con una probabilita' per tick,
 * cosi' non e' prevedibile ne' programmata. Non e' mai casuale il **se**: i
 * cancelli su clima, tempo trascorso, intensita' e sicurezza valgono sempre.
 * Un abbraccio proposto a caso dentro una serata fredda e' la cosa peggiore
 * che questo modulo possa fare.
 */

import { createRng, pick } from './util/rng.js';
import { CORNICI, ESITO_NEUTRO, MOMENTI, RIFIUTO } from './data/affection-moments.js';

/** Proposte massime in una serata. Oltre, diventa un programma di ginnastica. */
const MAX_PROPOSTE = 3;
/** Due rifiuti e il modulo si spegne per la serata: il messaggio e' chiaro. */
const MAX_RIFIUTI = 2;
/** Minuti minimi fra due proposte. */
const COOLDOWN_MIN = 18;
/** Secondi entro cui va data una risposta, poi la proposta decade in silenzio. */
const FINESTRA_RISPOSTA_SEC = 240;
/** Probabilita' per tick quando tutti i cancelli sono aperti. */
const PROBABILITA_PER_TICK = 0.25;

/**
 * Crea la traccia dei momenti di affetto per una serata.
 *
 * Doppio cancello: serve il consenso esplicito alla funzione E nessuno dei due
 * deve aver dichiarato di non volere contatto fisico. Chi non vuole essere
 * toccato non deve nemmeno vedere la proposta: doverla rifiutare ogni volta e'
 * gia' un piccolo costo, e non c'e' motivo di farglielo pagare.
 *
 * @param {{ matchId: string, partecipanti: string[], quando: { durata_minuti: number } }} eventCard
 * @param {{ consenso?: Record<string, boolean>, profili?: Record<string, { contattoFisico?: boolean }>, seed?: string }} [options]
 */
export function createAffectionTrack(eventCard, options = {}) {
  const consenso = options.consenso ?? {};
  const profili = options.profili ?? {};
  const partecipanti = eventCard.partecipanti;

  const senzaConsenso = partecipanti.filter((id) => consenso[id] !== true);
  const senzaContatto = partecipanti.filter(
    (id) => profili[id]?.contattoFisico === false,
  );

  const base = {
    matchId: eventCard.matchId,
    partecipanti,
    durataPrevistaMin: eventCard.quando.durata_minuti,
    proposte: [],
    accettati: [],
    rifiuti: 0,
    ultimaPropostaSec: -Infinity,
    bloccatoPerSicurezza: false,
    rng: createRng(options.seed ?? `${eventCard.matchId}|affetto`),
  };

  if (senzaConsenso.length > 0 || senzaContatto.length > 0) {
    return {
      ...base,
      attivo: false,
      motivo:
        senzaContatto.length > 0
          ? 'Almeno una delle due persone ha dichiarato di non volere contatto fisico: ' +
            'la funzione resta spenta per entrambi e nessuno vedrà mai una proposta.'
          : 'Serve il consenso esplicito di entrambi.',
    };
  }

  return {
    ...base,
    attivo: true,
    promessa: [
      'Ogni proposta la vedi solo tu.',
      'Serve il si di tutti e due, e non saprai mai cosa ha risposto l\'altra persona.',
      'Rifiutare costa un tocco, non lascia traccia e non ti viene chiesto il perché.',
    ],
  };
}

/**
 * Blocca definitivamente i momenti di affetto per questa serata.
 *
 * Chiamata quando la Fase 5 rileva un qualsiasi segnale di rischio. Non e'
 * reversibile: se una persona ha avuto anche solo un momento di disagio,
 * proporle un contatto fisico piu' tardi e' fuori discussione, per quanto il
 * clima possa sembrare migliorato dopo.
 * @param {ReturnType<typeof createAffectionTrack>} track
 */
export function bloccaPerSicurezza(track) {
  track.bloccatoPerSicurezza = true;
  return { bloccato: true, motivo: 'segnale di rischio rilevato durante la serata' };
}

/**
 * Prossimo gradino ammesso: uno sopra l'ultimo accettato, mai di più'.
 * @param {ReturnType<typeof createAffectionTrack>} track
 */
function prossimaIntensita(track) {
  const massima = track.accettati.reduce((max, m) => Math.max(max, m.intensita), 0);
  return massima + 1;
}

/**
 * Il clima e' quello giusto? Serve calore recente e nessun gelo in corso.
 * @param {{ risate?: number, energia?: number, silenzioSec?: number, rischio?: string }} tick
 */
function climaFavorevole(tick) {
  const risate = tick.risate ?? 0;
  const energia = tick.energia ?? 0.5;
  const silenzio = tick.silenzioSec ?? 0;
  return (
    (tick.rischio ?? 'nessuno') === 'nessuno' &&
    silenzio < 6 &&
    energia >= 0.5 &&
    (risate > 0 || energia >= 0.65)
  );
}

/**
 * Valuta se proporre un momento adesso.
 *
 * Va chiamata con gli stessi tick della Fase 5: il modulo non ascolta niente
 * per conto suo, riusa i segnali gia' derivati sul dispositivo.
 *
 * @param {ReturnType<typeof createAffectionTrack>} track
 * @param {import('./phase5-companion.js').SignalTick} tick
 * @returns {{ proposta: any|null, motivo: string }}
 */
export function maybePropose(track, tick) {
  if (!track.attivo) return { proposta: null, motivo: 'spento' };
  if (track.bloccatoPerSicurezza) return { proposta: null, motivo: 'bloccato_per_sicurezza' };
  if ((tick.rischio ?? 'nessuno') !== 'nessuno') {
    bloccaPerSicurezza(track);
    return { proposta: null, motivo: 'bloccato_per_sicurezza' };
  }
  if (track.rifiuti >= MAX_RIFIUTI) return { proposta: null, motivo: 'rifiuti_ripetuti' };
  if (track.proposte.length >= MAX_PROPOSTE) return { proposta: null, motivo: 'budget_esaurito' };
  // Una proposta ancora aperta non si scavalca con un'altra. Va controllato
  // prima del cooldown, altrimenti il motivo restituito sarebbe sempre
  // "in_pausa" e questo ramo non si raggiungerebbe mai.
  if (track.proposte.some((p) => p.stato === 'aperta')) {
    return { proposta: null, motivo: 'proposta_in_corso' };
  }
  if ((tick.t - track.ultimaPropostaSec) / 60 < COOLDOWN_MIN) {
    return { proposta: null, motivo: 'in_pausa' };
  }
  if (!climaFavorevole(tick)) return { proposta: null, motivo: 'clima_non_adatto' };

  const minuti = tick.t / 60;
  const intensita = prossimaIntensita(track);
  const finale = minuti >= track.durataPrevistaMin * 0.8;

  const candidati = MOMENTI.filter(
    (m) =>
      m.intensita === intensita &&
      minuti >= m.minMinuti &&
      // I gesti da commiato hanno senso solo alla fine.
      (!m.finaleSerata || finale),
  );
  if (candidati.length === 0) return { proposta: null, motivo: 'nessun_gradino_disponibile' };

  // Qui, e solo qui, entra il caso: il momento esatto non deve essere
  // prevedibile, mentre tutto cio' che sta sopra non e' mai casuale.
  if (track.rng() > PROBABILITA_PER_TICK) {
    return { proposta: null, motivo: 'non_stavolta' };
  }

  const momento = pick(track.rng, candidati);
  const proposta = {
    id: `aff-${track.proposte.length + 1}`,
    momento,
    t: tick.t,
    minuto: Math.round(minuti),
    scadeA: tick.t + FINESTRA_RISPOSTA_SEC,
    stato: 'aperta',
    risposte: {},
    // Il payload che finisce sullo schermo: uguale per i due, ma consegnato
    // separatamente e senza nessun riferimento all'altro.
    schermata: {
      titolo: momento.titolo,
      istruzione: momento.istruzione,
      nota: momento.nota ?? null,
      durataSec: momento.durataSec ?? null,
      cornice: pick(track.rng, CORNICI),
      rifiuto: RIFIUTO,
    },
  };
  track.proposte.push(proposta);
  track.ultimaPropostaSec = tick.t;
  return { proposta, motivo: 'proposta' };
}

/**
 * Registra la risposta di una persona.
 *
 * Chi risponde non riceve mai un'informazione sull'altro: finche' mancano
 * risposte l'esito e' "in attesa" per entrambi, e quando salta il messaggio e'
 * lo stesso per tutti.
 *
 * @param {ReturnType<typeof createAffectionTrack>} track
 * @param {string} propostaId
 * @param {string} userId
 * @param {{ accetta: boolean, t?: number }} params
 */
export function respond(track, propostaId, userId, { accetta, t }) {
  const proposta = track.proposte.find((p) => p.id === propostaId);
  if (!proposta) throw new Error(`Proposta ${propostaId} inesistente`);
  if (!track.partecipanti.includes(userId)) {
    throw new Error(`Utente ${userId} non fa parte di questo incontro`);
  }
  if (proposta.stato !== 'aperta') {
    return { stato: proposta.stato, messaggio: ESITO_NEUTRO };
  }
  if (t !== undefined && t > proposta.scadeA) {
    proposta.stato = 'scaduta';
    return { stato: 'scaduta', messaggio: ESITO_NEUTRO };
  }

  proposta.risposte[userId] = Boolean(accetta);

  const risposteComplete = track.partecipanti.every(
    (id) => proposta.risposte[id] !== undefined,
  );
  if (!risposteComplete) {
    return {
      stato: 'in_attesa',
      // Identico per chi ha accettato e per chi ha rifiutato: nemmeno la
      // schermata di attesa deve lasciar intuire la propria risposta a chi
      // sbircia il telefono dell'altro.
      messaggio: accetta ? 'Ok. Un attimo.' : RIFIUTO.conferma,
    };
  }

  const entrambi = track.partecipanti.every((id) => proposta.risposte[id] === true);
  if (entrambi) {
    proposta.stato = 'accettata';
    track.accettati.push(proposta.momento);
    return {
      stato: 'accettata',
      // Solo adesso la cosa diventa condivisa e compare a entrambi.
      condiviso: {
        titolo: proposta.momento.titolo,
        istruzione: proposta.momento.istruzione,
        durataSec: proposta.momento.durataSec ?? null,
        nota: proposta.momento.nota ?? null,
      },
      messaggio: 'Ci state tutti e due.',
    };
  }

  proposta.stato = 'non_riuscita';
  track.rifiuti += 1;
  return { stato: 'non_riuscita', messaggio: ESITO_NEUTRO };
}

/**
 * Fa scadere in silenzio le proposte a cui non si e' risposto.
 * @param {ReturnType<typeof createAffectionTrack>} track
 * @param {number} t secondi dall'inizio
 */
export function scadiProposte(track, t) {
  const scadute = [];
  for (const proposta of track.proposte) {
    if (proposta.stato === 'aperta' && t > proposta.scadeA) {
      proposta.stato = 'scaduta';
      // Una proposta ignorata conta come rifiuto ai fini del ritmo: se non
      // vengono nemmeno guardate, insistere e' peggio che smettere.
      track.rifiuti += 1;
      scadute.push(proposta.id);
    }
  }
  return { scadute, messaggio: scadute.length ? ESITO_NEUTRO : null };
}

/**
 * Riepilogo per il debrief. Contiene solo cosa e' stato accettato da entrambi:
 * i rifiuti non risultano da nessuna parte, come promesso all'utente.
 * @param {ReturnType<typeof createAffectionTrack>} track
 */
export function summarizeAffection(track) {
  return {
    matchId: track.matchId,
    attivo: track.attivo,
    momentiCondivisi: track.accettati.map((m) => ({
      id: m.id,
      titolo: m.titolo,
      intensita: m.intensita,
    })),
    intensitaMassima: track.accettati.reduce((max, m) => Math.max(max, m.intensita), 0),
    bloccatoPerSicurezza: track.bloccatoPerSicurezza,
    // Deliberatamente assente: quante proposte sono state rifiutate e da chi.
    rifiutiRegistrati: false,
  };
}
