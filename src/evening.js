/**
 * Il runtime della serata: un solo ciclo, un solo arbitro.
 *
 * Le fasi 5, 7 e 8 - compagno, momenti di affetto, giochi - vivono tutte sugli
 * stessi segnali e vogliono tutte lo stesso telefono. Finche' ognuna veniva
 * guidata dal chiamante, tre cose non funzionavano:
 *
 *  1. **Il tetto sulle interruzioni non esisteva davvero.** Il budget di
 *     attenzione lo consultava una fase sola: le altre due parlavano quando
 *     volevano, quindi il limite complessivo era una dichiarazione di
 *     intenti, non un vincolo.
 *  2. **Le precedenze erano casuali.** Se in uno stesso istante il compagno
 *     voleva una carta, l'affetto una proposta e i giochi una partita, vinceva
 *     quella che il chiamante aveva scritto per prima nel proprio codice.
 *  3. **Il ciclo dei tick era duplicato** in ogni client, e con lui la logica
 *     di coordinamento - il posto piu' facile del sistema in cui sbagliare.
 *
 * Qui i moduli tornano a fare una cosa sola: dire se *avrebbe senso* parlare
 * adesso. Decidere chi parla davvero spetta a questo file.
 *
 * ── L'ordine di precedenza ────────────────────────────────────────────────
 *
 *   1. sicurezza          sempre, prima di tutto, e in silenzio
 *   2. richiesta esplicita  se lo chiedono loro, si risponde
 *   3. momenti di affetto   rari e legati a un clima che passa
 *   4. giochi               solo dopo che le mosse leggere non sono bastate
 *   5. compagno             carte e battute
 *
 * Il criterio dell'ordine e' quanto un'occasione e' deperibile: una carta si
 * puo' giocare anche cinque minuti dopo, un momento caldo no. Il criterio dei
 * giochi e' invece l'escalation: si prova prima la cosa che costa poco.
 */

import { restoreRng } from './util/rng.js';
import {
  attenzioneDisponibile,
  createAttentionBudget,
  richiediAttenzione,
  rilasciaAttenzione,
  riepilogoAttenzione,
} from './attention.js';
import {
  closeCompanionSession,
  createCompanionSession,
  observe,
  setMuto,
} from './phase5-companion.js';
import {
  bloccaPerSicurezza,
  createAffectionTrack,
  maybePropose,
  respond,
  scadiProposte,
  summarizeAffection,
} from './phase7-affection.js';
import {
  completeGame,
  createGameTrack,
  maybeProposeGame,
  respondGame,
  scadiProposteGioco,
  summarizeGames,
} from './phase8-games.js';

/**
 * Quante mosse leggere devono essere state gia' tentate prima che un gioco
 * diventi ammissibile. Un gioco chiede dieci minuti: prima si prova con una
 * carta, che ne chiede zero.
 */
const CARTE_PRIMA_DI_UN_GIOCO = 2;

/**
 * Avvia la serata.
 *
 * Ogni funzione ha il suo consenso separato: chi accetta il compagno non ha
 * accettato per questo i momenti di affetto, e chi gioca volentieri non ha
 * accettato un microfono acceso. Fondere i consensi in un interruttore solo
 * sarebbe comodo e disonesto.
 *
 * @param {object} eventCard scheda prodotta dalla Fase 3
 * @param {{
 *   consensi?: { compagno?: Record<string, boolean>, affetto?: Record<string, boolean>, giochi?: Record<string, boolean> },
 *   profili?: Record<string, { contattoFisico?: boolean }>,
 *   modo?: 'schermo'|'voce',
 *   seed?: string,
 * }} [options]
 */
export function createEvening(eventCard, options = {}) {
  const consensi = options.consensi ?? {};
  const seed = options.seed ?? eventCard.matchId;

  const compagno = createCompanionSession(eventCard, {
    consenso: consensi.compagno ?? {},
    modo: options.modo,
  });
  const affetto = createAffectionTrack(eventCard, {
    consenso: consensi.affetto ?? {},
    profili: options.profili,
    seed: `${seed}|affetto`,
  });
  const giochi = createGameTrack(eventCard, {
    consenso: consensi.giochi ?? {},
    seed: `${seed}|giochi`,
  });

  return {
    matchId: eventCard.matchId,
    partecipanti: eventCard.partecipanti,
    durataPrevistaMin: eventCard.quando.durata_minuti,
    compagno,
    affetto,
    giochi,
    attenzione: createAttentionBudget({
      durataPrevistaMin: eventCard.quando.durata_minuti,
    }),
    log: [],
    attive: {
      compagno: compagno.attivo,
      affetto: affetto.attivo,
      giochi: giochi.attivo,
    },
    apertura: compagno.attivo ? compagno.apertura : null,
  };
}

/** Registra un'azione nel log della serata e la restituisce. */
function registra(evening, azione) {
  evening.log.push(azione);
  return azione;
}

/**
 * Prende il turno per una fase, esegue, e lo restituisce.
 * Il turno si prende solo quando c'e' davvero qualcosa da mostrare.
 */
function conTurno(evening, { fase, tipo, t }, esegui) {
  if (!attenzioneDisponibile(evening.attenzione, { fase, tipo, t }).disponibile) {
    return null;
  }
  const esito = esegui();
  if (!esito) return null;
  richiediAttenzione(evening.attenzione, { fase, tipo, t });
  return esito;
}

/**
 * Un tick di serata. Va chiamata con i segnali derivati sul dispositivo, gli
 * stessi che consuma la Fase 5.
 *
 * @param {ReturnType<typeof createEvening>} evening
 * @param {import('./phase5-companion.js').SignalTick} tick
 * @returns {{ azioni: any[], sicurezza: any|null, stato: string }}
 */
export function tickEvening(evening, tick) {
  const azioni = [];
  const t = tick.t;

  // --- 1. Sicurezza ---------------------------------------------------------
  // Passa dal compagno perche' e' l'unico che vede i segnali di rischio, ma le
  // conseguenze valgono per tutta la serata: niente piu' gesti fisici e niente
  // piu' giochi, comunque vada il clima da qui in avanti.
  const esitoCompagno = observe(evening.compagno, tick);
  if (esitoCompagno.sicurezza) {
    if (evening.affetto.attivo) bloccaPerSicurezza(evening.affetto);
    evening.giochi.bloccatoPerSicurezza = true;
    registra(evening, { fonte: 'sicurezza', t, livello: esitoCompagno.sicurezza.livello });
    return { azioni, sicurezza: esitoCompagno.sicurezza, stato: 'allerta' };
  }

  // Le proposte non raccolte decadono in silenzio prima di valutarne altre.
  const scaduteAffetto = evening.affetto.attivo ? scadiProposte(evening.affetto, t) : { scadute: [] };
  const scaduteGiochi = evening.giochi.attivo ? scadiProposteGioco(evening.giochi, t) : { scadute: [] };
  for (const id of [...scaduteAffetto.scadute, ...scaduteGiochi.scadute]) {
    rilasciaAttenzione(evening.attenzione, {
      fase: id.startsWith('aff') ? 'affetto' : 'giochi',
      t,
    });
  }

  // --- 2. Richiesta esplicita ----------------------------------------------
  // `observe` ha gia' risposto: una cosa chiesta dall'utente non consuma il
  // budget, perche' non e' un'interruzione - e' il telefono che obbedisce.
  if (esitoCompagno.intervento?.richiesto) {
    azioni.push(registra(evening, { fonte: 'compagno', t, ...esitoCompagno.intervento }));
    return { azioni, sicurezza: null, stato: 'attivo' };
  }

  // --- 3. Momenti di affetto ------------------------------------------------
  if (evening.affetto.attivo) {
    const esito = conTurno(evening, { fase: 'affetto', tipo: 'affetto', t }, () => {
      const { proposta } = maybePropose(evening.affetto, tick);
      return proposta;
    });
    if (esito) {
      azioni.push(registra(evening, { fonte: 'affetto', t, tipo: 'proposta', proposta: esito }));
      return { azioni, sicurezza: null, stato: 'attivo' };
    }
  }

  // --- 4. Giochi ------------------------------------------------------------
  // Ammessi solo dopo che le mosse leggere non sono bastate: se il compagno non
  // ha ancora provato a rilanciare, proporre dieci minuti di gioco significa
  // saltare a una soluzione grossa per un problema che forse non c'e'.
  const carteGiocate = evening.compagno.attivo
    ? evening.compagno.interventi.filter((i) => !i.richiesto && !i.silenzioso).length
    : CARTE_PRIMA_DI_UN_GIOCO;
  if (evening.giochi.attivo && carteGiocate >= CARTE_PRIMA_DI_UN_GIOCO) {
    const esito = conTurno(evening, { fase: 'giochi', tipo: 'gioco', t }, () => {
      const { proposta } = maybeProposeGame(evening.giochi, tick);
      return proposta;
    });
    if (esito) {
      azioni.push(registra(evening, { fonte: 'giochi', t, tipo: 'proposta', proposta: esito }));
      return { azioni, sicurezza: null, stato: 'attivo' };
    }
  }

  // --- 5. Compagno ----------------------------------------------------------
  if (esitoCompagno.intervento) {
    const tipo = esitoCompagno.intervento.tipo === 'battuta' ? 'battuta' : 'carta';
    if (attenzioneDisponibile(evening.attenzione, { fase: 'compagno', tipo, t }).disponibile) {
      richiediAttenzione(evening.attenzione, { fase: 'compagno', tipo, t });
      // Una carta si consuma nell'istante in cui viene mostrata: il turno si
      // apre e si chiude subito, ed e' la pausa a fare da distanziatore.
      rilasciaAttenzione(evening.attenzione, { fase: 'compagno', t });
      azioni.push(registra(evening, { fonte: 'compagno', t, ...esitoCompagno.intervento }));
      return { azioni, sicurezza: null, stato: 'attivo' };
    }
    // Il compagno aveva qualcosa da dire ma il telefono era occupato: si
    // rinuncia invece di accodare. Una carta buona fra dieci minuti non e' piu'
    // la stessa carta.
    registra(evening, { fonte: 'compagno', t, tipo: 'rinunciato', motivo: 'telefono occupato' });
  }

  return { azioni, sicurezza: null, stato: esitoCompagno.stato };
}

/**
 * Risposta a una proposta di affetto, con rilascio del turno.
 * @param {ReturnType<typeof createEvening>} evening
 */
export function rispondiAffetto(evening, propostaId, userId, { accetta, t }) {
  const esito = respond(evening.affetto, propostaId, userId, { accetta, t });
  if (esito.stato !== 'in_attesa') {
    rilasciaAttenzione(evening.attenzione, { fase: 'affetto', t: t ?? 0 });
  }
  return esito;
}

/**
 * Risposta a una proposta di gioco. Il turno resta preso finche' la partita non
 * finisce: durante un gioco il telefono e' gia' occupato per definizione.
 * @param {ReturnType<typeof createEvening>} evening
 */
export function rispondiGioco(evening, propostaId, userId, { accetta, t }) {
  const esito = respondGame(evening.giochi, propostaId, userId, { accetta, t });
  if (esito.stato === 'rifiutata' || esito.stato === 'scaduta') {
    rilasciaAttenzione(evening.attenzione, { fase: 'giochi', t: t ?? 0 });
  }
  return esito;
}

/**
 * Chiude una partita e restituisce il turno.
 * @param {ReturnType<typeof createEvening>} evening
 */
export function chiudiGioco(evening, propostaId, options = {}) {
  const esito = completeGame(evening.giochi, propostaId, options);
  rilasciaAttenzione(evening.attenzione, { fase: 'giochi', t: options.t ?? 0 });
  return esito;
}

/**
 * Zittisce il compagno. Vale solo per le carte e le battute: sicurezza,
 * affetto e giochi hanno interruttori propri, perche' sono cose diverse.
 * @param {ReturnType<typeof createEvening>} evening
 */
export function zittisci(evening, muto) {
  return setMuto(evening.compagno, muto);
}

/**
 * Chiude la serata e raccoglie tutto quello che serve alla Fase 6.
 * @param {ReturnType<typeof createEvening>} evening
 * @param {{ durataEffettivaMin?: number }} [options]
 */
export function closeEvening(evening, options = {}) {
  const sessione = closeCompanionSession(evening.compagno, options);
  return {
    matchId: evening.matchId,
    sessione,
    affetto: summarizeAffection(evening.affetto),
    giochi: summarizeGames(evening.giochi),
    attenzione: riepilogoAttenzione(evening.attenzione),
    // Il dato piu' onesto sulla serata: quanto poco e' servito il telefono.
    autonomia:
      1 - Math.min(1, evening.attenzione.pesoSpeso / evening.attenzione.maxPeso),
  };
}

/**
 * JSON non sa rappresentare -Infinity: `JSON.stringify(-Infinity)` produce
 * `null`. I contatori "non e' mai successo" (`ultimoInterventoSec`,
 * `ultimaPropostaSec`, `liberoDaSec`) partono proprio da -Infinity, e ripristinarli
 * come `null` li trasformerebbe in 0 al primo confronto: una serata ripresa
 * subito dopo l'avvio si ritroverebbe con tutte le pause gia' scadute.
 */
const CAMPI_INFINITI = ['ultimoInterventoSec', 'ultimaPropostaSec', 'liberoDaSec'];

function serializzaInfiniti(oggetto) {
  const copia = { ...oggetto };
  for (const campo of CAMPI_INFINITI) {
    if (copia[campo] === -Infinity) copia[campo] = '-Infinity';
  }
  return copia;
}

function ripristinaInfiniti(oggetto) {
  const copia = { ...oggetto };
  for (const campo of CAMPI_INFINITI) {
    if (copia[campo] === '-Infinity' || copia[campo] === null) copia[campo] = -Infinity;
  }
  return copia;
}

/**
 * Fotografia serializzabile dello stato.
 *
 * Una serata dura due ore e il processo che la segue puo' morire in mezzo: lo
 * stato deve poter essere salvato e ripreso senza che i due telefoni vedano
 * cose diverse. Per questo i generatori espongono il proprio stato interno.
 * @param {ReturnType<typeof createEvening>} evening
 */
export function snapshotEvening(evening) {
  return JSON.parse(
    JSON.stringify({
      versione: 1,
      matchId: evening.matchId,
      partecipanti: evening.partecipanti,
      durataPrevistaMin: evening.durataPrevistaMin,
      attive: evening.attive,
      apertura: evening.apertura,
      attenzione: serializzaInfiniti(evening.attenzione),
      log: evening.log,
      rng: {
        compagno: evening.compagno.rng?.state ?? null,
        affetto: evening.affetto.rng?.state ?? null,
        giochi: evening.giochi.rng?.state ?? null,
      },
      compagno: {
        ...serializzaInfiniti(evening.compagno),
        rng: undefined,
        inizio: evening.compagno.inizio?.toISOString() ?? null,
        carteUsate: [...(evening.compagno.carteUsate ?? [])],
      },
      affetto: { ...serializzaInfiniti(evening.affetto), rng: undefined },
      giochi: { ...serializzaInfiniti(evening.giochi), rng: undefined },
    }),
  );
}

/**
 * Ricostruisce una serata da una fotografia.
 *
 * Deve restituire un oggetto indistinguibile da quello originale per le
 * decisioni future: stessi generatori nello stesso punto, stesse pause, stesse
 * carte gia' usate. Se il ripristino perdesse anche solo lo stato dei
 * generatori, i due telefoni comincerebbero a vedere carte diverse dopo un
 * riavvio - ed e' l'unico modo in cui questa app puo' contraddirsi davanti a
 * due persone sedute allo stesso tavolo.
 *
 * @param {ReturnType<typeof snapshotEvening>} snapshot
 * @returns {ReturnType<typeof createEvening>}
 */
export function restoreEvening(snapshot) {
  if (snapshot?.versione !== 1) {
    throw new Error(`Fotografia di versione non supportata: ${snapshot?.versione}`);
  }
  return {
    matchId: snapshot.matchId,
    partecipanti: snapshot.partecipanti,
    durataPrevistaMin: snapshot.durataPrevistaMin,
    attive: snapshot.attive,
    apertura: snapshot.apertura,
    attenzione: ripristinaInfiniti(snapshot.attenzione),
    log: snapshot.log,
    compagno: {
      ...ripristinaInfiniti(snapshot.compagno),
      inizio: snapshot.compagno.inizio ? new Date(snapshot.compagno.inizio) : null,
      carteUsate: new Set(snapshot.compagno.carteUsate ?? []),
      rng: restoreRng(snapshot.rng.compagno ?? 0),
    },
    affetto: {
      ...ripristinaInfiniti(snapshot.affetto),
      rng: restoreRng(snapshot.rng.affetto ?? 0),
    },
    giochi: {
      ...ripristinaInfiniti(snapshot.giochi),
      rng: restoreRng(snapshot.rng.giochi ?? 0),
    },
  };
}
