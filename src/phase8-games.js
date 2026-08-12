/**
 * FASE 8 - Giochi a schermo condiviso.
 *
 * Ogni tanto, in modo imprevedibile, l'app propone un gioco da fare in due su
 * un telefono solo. Sono scritti in `data/games.js` e obbediscono a un vincolo
 * che vale piu' di tutti gli altri: **il telefono deve sparire**. Un gioco che
 * tiene due persone a fissare uno schermo per venti minuti ha trasformato un
 * appuntamento in una sala giochi.
 *
 * ── Quando proporre un gioco (e perche' non e' come una carta) ─────────────
 *
 * Una carta della Fase 5 riempie un silenzio: costa poco e si puo' ignorare.
 * Un gioco e' un'altra cosa - chiede cinque o dieci minuti e cambia la forma
 * della serata. Quindi la regola e' rovesciata rispetto agli icebreaker:
 *
 *  - **mai mentre la conversazione va bene.** Se l'energia e' alta, i due si
 *    stanno gia' divertendo e proporre un gioco significa interrompere la cosa
 *    che il gioco dovrebbe produrre;
 *  - **si propone nei momenti piatti**, quando la serata gira a vuoto ma il
 *    clima non e' brutto;
 *  - **due giochi a serata al massimo**, con almeno venticinque minuti in mezzo;
 *  - **piu' la serata avanza, piu' si preferiscono i giochi `solo_avvio`**,
 *    quelli in cui l'app da' una regola e poi il telefono torna sul tavolo.
 *
 * Tutte le richieste passano dal budget di attenzione condiviso (`attention.js`),
 * cosi' un gioco non arriva mai subito dopo una proposta di affetto o una carta.
 */

import { createRng, pick, shuffle } from './util/rng.js';
import {
  attenzioneDisponibile,
  richiediAttenzione,
  rilasciaAttenzione,
} from './attention.js';
import { GIOCHI, GIOCO_NON_FATTO, PROPOSTA_GIOCO } from './data/games.js';

const MAX_GIOCHI = 2;
const COOLDOWN_MIN = 25;
/** Sopra questa energia la conversazione sta funzionando: non si interrompe. */
const ENERGIA_MASSIMA = 0.65;
/** Secondi per rispondere alla proposta. */
const FINESTRA_RISPOSTA_SEC = 180;
const PROBABILITA_PER_TICK = 0.2;

/**
 * Crea la traccia dei giochi per una serata.
 * @param {{ matchId: string, partecipanti: string[], quando: { durata_minuti: number } }} eventCard
 * @param {{ consenso?: Record<string, boolean>, seed?: string, attenzione?: object }} [options]
 */
export function createGameTrack(eventCard, options = {}) {
  const consenso = options.consenso ?? {};
  const partecipanti = eventCard.partecipanti;
  const mancanti = partecipanti.filter((id) => consenso[id] !== true);

  const base = {
    matchId: eventCard.matchId,
    partecipanti,
    durataPrevistaMin: eventCard.quando.durata_minuti,
    proposte: [],
    giocati: [],
    ultimaPropostaSec: -Infinity,
    bloccatoPerSicurezza: false,
    attenzione: options.attenzione ?? null,
    rng: createRng(options.seed ?? `${eventCard.matchId}|giochi`),
  };

  if (mancanti.length > 0) {
    return { ...base, attivo: false, motivo: 'Serve il consenso di entrambi.', mancanti };
  }
  return {
    ...base,
    attivo: true,
    catalogo: GIOCHI.map((g) => ({ id: g.id, titolo: g.titolo, durataMin: g.durataMin })),
  };
}

/**
 * Prepara la partita: pesca il materiale e costruisce i payload.
 *
 * Alcuni giochi non mostrano la stessa cosa ai due schermi - `L infiltrato`
 * consegna una bugia a una sola persona (o a nessuna), ed e' tutto il gioco.
 * Per questo il ritorno distingue `comune` da `perUtente`.
 *
 * @param {import('./data/games.js').Gioco} gioco
 * @param {() => number} rng
 * @param {string[]} partecipanti
 */
function materializza(gioco, rng, partecipanti) {
  const comune = {
    titolo: gioco.titolo,
    regole: gioco.regole,
    durataMin: gioco.durataMin,
    schermo: gioco.schermo,
    chiusura: gioco.chiusura,
  };
  /** @type {Record<string, object>} */
  const perUtente = Object.fromEntries(partecipanti.map((id) => [id, {}]));

  if (gioco.id === 'infiltrato') {
    // Una volta su quattro non mente nessuno: e' quello che rende il gioco
    // vivo, perche' toglie la certezza che ci sia qualcosa da trovare.
    const nessuno = rng() < 0.25;
    const bersaglio = nessuno ? null : pick(rng, partecipanti);
    for (const id of partecipanti) {
      perUtente[id] =
        id === bersaglio
          ? { ruolo: 'infiltrato', istruzione: pick(rng, gioco.materiale) }
          : {
              ruolo: 'onesto',
              // Schermata identica a quella dell'infiltrato nella forma: chi
              // sbircia il telefono dell'altro non deve poter dedurre niente.
              istruzione: 'Nessuna bugia per te. Comportati normalmente.',
            };
    }
    return { comune, perUtente, soluzione: { infiltrato: bersaglio } };
  }

  if (gioco.id === 'la_riga') {
    // "domanda | sinistra / destra"
    const righe = shuffle(rng, gioco.materiale)
      .slice(0, 4)
      .map((riga) => {
        const [domanda, estremi] = riga.split('|').map((x) => x.trim());
        const [sinistra, destra] = estremi.split('/').map((x) => x.trim());
        return { domanda, sinistra, destra };
      });
    return { comune: { ...comune, righe }, perUtente };
  }

  return {
    comune: { ...comune, consegna: gioco.materiale ? pick(rng, gioco.materiale) : null },
    perUtente,
  };
}

/**
 * Sceglie il gioco piu' adatto a questo momento della serata.
 * @param {ReturnType<typeof createGameTrack>} track
 * @param {number} minuti
 */
function scegliGioco(track, minuti) {
  const finale = minuti >= track.durataPrevistaMin * 0.8;
  const giocati = new Set(track.giocati.map((g) => g.id));

  const ammessi = GIOCHI.filter(
    (g) =>
      !giocati.has(g.id) &&
      minuti >= g.minMinuti &&
      (!g.finaleSerata || finale) &&
      // Un gioco non deve sforare la fine prevista della serata.
      minuti + g.durataMin <= track.durataPrevistaMin,
  );
  if (ammessi.length === 0) return null;

  // Nella seconda meta' si preferiscono i giochi che liberano lo schermo.
  const avanzata = minuti >= track.durataPrevistaMin * 0.5;
  const preferiti = avanzata
    ? ammessi.filter((g) => g.schermo === 'solo_avvio')
    : ammessi.filter((g) => g.schermo !== 'solo_avvio');

  const rosa = preferiti.length > 0 ? preferiti : ammessi;
  return pick(track.rng, rosa);
}

/**
 * Valuta se proporre un gioco adesso.
 * @param {ReturnType<typeof createGameTrack>} track
 * @param {import('./phase5-companion.js').SignalTick} tick
 * @returns {{ proposta: any|null, motivo: string }}
 */
export function maybeProposeGame(track, tick) {
  if (!track.attivo) return { proposta: null, motivo: 'spento' };
  if (track.bloccatoPerSicurezza) return { proposta: null, motivo: 'bloccato_per_sicurezza' };
  if ((tick.rischio ?? 'nessuno') !== 'nessuno') {
    track.bloccatoPerSicurezza = true;
    return { proposta: null, motivo: 'bloccato_per_sicurezza' };
  }
  if (track.proposte.some((p) => p.stato === 'aperta')) {
    return { proposta: null, motivo: 'proposta_in_corso' };
  }
  if (track.giocati.length >= MAX_GIOCHI) {
    return { proposta: null, motivo: 'budget_esaurito' };
  }
  if ((tick.t - track.ultimaPropostaSec) / 60 < COOLDOWN_MIN) {
    return { proposta: null, motivo: 'in_pausa' };
  }

  // La regola rovesciata rispetto alle carte: se la conversazione gira, un
  // gioco toglie invece di aggiungere.
  const energia = tick.energia ?? 0.5;
  if (energia > ENERGIA_MASSIMA) {
    return { proposta: null, motivo: 'la_conversazione_gira' };
  }

  const minuti = tick.t / 60;
  const gioco = scegliGioco(track, minuti);
  if (!gioco) return { proposta: null, motivo: 'nessun_gioco_adatto' };

  // Prima si verifica il turno senza prenderlo: se un'altra fase sta gia'
  // parlando la risposta e' no comunque, e il motivo deve dirlo invece di un
  // generico "non stavolta".
  if (track.attenzione) {
    const check = attenzioneDisponibile(track.attenzione, {
      fase: 'giochi',
      tipo: 'gioco',
      t: tick.t,
    });
    if (!check.disponibile) return { proposta: null, motivo: check.motivo };
  }

  // Il caso decide l'istante, non l'opportunita'.
  if (track.rng() > PROBABILITA_PER_TICK) return { proposta: null, motivo: 'non_stavolta' };

  // Solo adesso il turno viene preso davvero.
  if (track.attenzione) {
    richiediAttenzione(track.attenzione, { fase: 'giochi', tipo: 'gioco', t: tick.t });
  }

  const proposta = {
    id: `game-${track.proposte.length + 1}`,
    giocoId: gioco.id,
    t: tick.t,
    minuto: Math.round(minuti),
    scadeA: tick.t + FINESTRA_RISPOSTA_SEC,
    stato: 'aperta',
    risposte: {},
    schermata: {
      cornice: pick(track.rng, PROPOSTA_GIOCO),
      titolo: gioco.titolo,
      premessa: gioco.premessa,
      durataMin: gioco.durataMin,
      // Si dice sempre quanto tempo costa e come si esce: un gioco che non
      // dichiara la sua durata e' una trappola.
      uscita: 'Basta che uno dei due dica di no.',
    },
  };
  track.proposte.push(proposta);
  track.ultimaPropostaSec = tick.t;
  return { proposta, motivo: 'proposta' };
}

/**
 * Registra la risposta di una persona alla proposta di gioco.
 * @param {ReturnType<typeof createGameTrack>} track
 * @param {string} propostaId
 * @param {string} userId
 * @param {{ accetta: boolean, t?: number }} params
 */
export function respondGame(track, propostaId, userId, { accetta, t }) {
  const proposta = track.proposte.find((p) => p.id === propostaId);
  if (!proposta) throw new Error(`Proposta ${propostaId} inesistente`);
  if (!track.partecipanti.includes(userId)) {
    throw new Error(`Utente ${userId} non fa parte di questo incontro`);
  }
  if (proposta.stato !== 'aperta') {
    return { stato: proposta.stato, messaggio: GIOCO_NON_FATTO };
  }

  proposta.risposte[userId] = Boolean(accetta);

  // Un no basta e chiude subito: far aspettare l'altra risposta quando la
  // partita e' gia' saltata tiene il telefono acceso per niente.
  if (!accetta) {
    proposta.stato = 'rifiutata';
    if (track.attenzione) {
      rilasciaAttenzione(track.attenzione, { fase: 'giochi', t: t ?? proposta.t });
    }
    return { stato: 'rifiutata', messaggio: GIOCO_NON_FATTO };
  }

  const tutti = track.partecipanti.every((id) => proposta.risposte[id] === true);
  if (!tutti) return { stato: 'in_attesa', messaggio: 'Ok. Aspetto l altra risposta.' };

  proposta.stato = 'accettata';
  const gioco = GIOCHI.find((g) => g.id === proposta.giocoId);
  const partita = materializza(gioco, track.rng, track.partecipanti);

  proposta.partita = partita;
  return {
    stato: 'accettata',
    partita: {
      giocoId: gioco.id,
      ...partita.comune,
      // Ogni schermo riceve solo la propria parte.
      perTe: (userId2) => {
        if (!track.partecipanti.includes(userId2)) {
          throw new Error(`Utente ${userId2} non fa parte di questo incontro`);
        }
        return partita.perUtente[userId2];
      },
    },
  };
}

/**
 * Chiude la partita e restituisce la frase che rimette in moto la conversazione.
 * @param {ReturnType<typeof createGameTrack>} track
 * @param {string} propostaId
 * @param {{ t?: number, abbandonato?: boolean }} [options]
 */
export function completeGame(track, propostaId, options = {}) {
  const proposta = track.proposte.find((p) => p.id === propostaId);
  if (!proposta) throw new Error(`Proposta ${propostaId} inesistente`);
  if (proposta.stato !== 'accettata') {
    return { ok: false, messaggio: 'Questa partita non e mai cominciata' };
  }
  const gioco = GIOCHI.find((g) => g.id === proposta.giocoId);
  proposta.stato = options.abbandonato ? 'abbandonato' : 'finito';
  track.giocati.push({ id: gioco.id, titolo: gioco.titolo, abbandonato: Boolean(options.abbandonato) });

  if (track.attenzione) {
    rilasciaAttenzione(track.attenzione, { fase: 'giochi', t: options.t ?? proposta.t });
  }

  return {
    ok: true,
    // Nessun punteggio, nessun vincitore: si esce con un argomento in mano.
    chiusura: gioco.chiusura,
    soluzione: proposta.partita?.soluzione ?? null,
    messaggio: 'Telefono giu. Il resto lo fate voi.',
  };
}

/**
 * Fa scadere in silenzio le proposte ignorate.
 * @param {ReturnType<typeof createGameTrack>} track
 * @param {number} t
 */
export function scadiProposteGioco(track, t) {
  const scadute = [];
  for (const proposta of track.proposte) {
    if (proposta.stato === 'aperta' && t > proposta.scadeA) {
      proposta.stato = 'scaduta';
      if (track.attenzione) rilasciaAttenzione(track.attenzione, { fase: 'giochi', t });
      scadute.push(proposta.id);
    }
  }
  return { scadute, messaggio: scadute.length ? GIOCO_NON_FATTO : null };
}

/**
 * Riepilogo per il debrief.
 * @param {ReturnType<typeof createGameTrack>} track
 */
export function summarizeGames(track) {
  return {
    matchId: track.matchId,
    attivo: track.attivo,
    giocati: track.giocati,
    proposti: track.proposte.length,
    // Utile al matcher: chi gioca volentieri va abbinato con chi gioca
    // volentieri, e chi rifiuta sempre non deve piu' vedersele proporre.
    accettazione: track.proposte.length
      ? track.giocati.length / track.proposte.length
      : null,
  };
}
