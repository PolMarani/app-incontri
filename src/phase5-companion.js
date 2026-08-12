/**
 * FASE 5 - Il terzo compagno.
 *
 * Un'AI compresente alla serata: ascolta, rilancia quando la conversazione si
 * inceppa, tiene d'occhio la sicurezza e ogni tanto fa una battuta. Non e' un
 * tramite fra i due (quelli sono seduti allo stesso tavolo e si parlano da
 * soli): e' una presenza in piu', come l'amico che sta zitto in fondo.
 *
 * ── Cosa entra in questo modulo ────────────────────────────────────────────
 *
 * NIENTE audio e NIENTE trascrizioni. Il riconoscimento gira sul telefono e da
 * qui passano solo segnali derivati: quanti secondi dura il silenzio, come sono
 * distribuiti i turni di parola, se si e' riso, se c'e' un segnale di allarme.
 *
 * Non e' una formalita' burocratica. Due persone sedute in un bar sono in un
 * luogo pubblico: un microfono acceso raccoglie anche il tavolo accanto, fatto
 * di gente che non ha acconsentito a niente e che non e' nemmeno iscritta.
 * L'unica versione difendibile di questa funzione e' quella in cui l'audio non
 * lascia mai il dispositivo e non viene mai conservato. Il contratto di questo
 * modulo (`SignalTick`) esiste per rendere impossibile, non solo sconsigliato,
 * far arrivare al server il contenuto di una conversazione privata.
 *
 * ── Il problema vero: quando parlare ───────────────────────────────────────
 *
 * Il modo piu' facile di rovinare un appuntamento e' mettere al tavolo qualcosa
 * che interviene troppo. Quindi il compagno:
 *  - ha un budget di interventi per serata e un intervallo che si allunga da
 *    solo ogni volta che parla;
 *  - non considera tutti i silenzi uguali: otto secondi al minuto cinque sono
 *    imbarazzo, gli stessi otto secondi al minuto cinquanta sono due persone
 *    che stanno bene zitte, e interromperle sarebbe il vero danno;
 *  - non interrompe mai chi sta raccontando qualcosa (energia alta);
 *  - fa una battuta solo quando si sta gia' ridendo. Una battuta dentro un
 *    silenzio teso e' la cosa che lo peggiora di piu'.
 */

import { createRng, pick } from './util/rng.js';
import {
  APERTURA,
  BATTUTE,
  CHIUSURA,
  RILANCIO_SILENZIO,
  RIEQUILIBRIO,
  SU_RICHIESTA,
} from './data/companion-lines.js';

/**
 * @typedef {Object} SignalTick
 * @property {number} t                  secondi dall'inizio dell'incontro
 * @property {number} [silenzioSec]      durata del silenzio in corso
 * @property {number} [quotaParlato]     0..1, quota di parlato del PRIMO partecipante
 * @property {number} [energia]          0..1, quanto e viva la conversazione adesso
 * @property {number} [risate]           risate rilevate nell ultima finestra
 * @property {number} [domande]          domande poste nell ultima finestra
 * @property {'nessuno'|'disagio'|'allarme'} [rischio]
 * @property {string} [richiestaDa]      id di chi ha toccato "dammi una carta"
 */

/** Budget di interventi non richiesti per serata. */
const BUDGET_INTERVENTI = 6;
/** Massimo di battute: oltre diventa un cabaret e nessuno lo ha chiesto. */
const BUDGET_BATTUTE = 2;
/** Pausa minima fra due interventi, in minuti. Cresce a ogni intervento. */
const COOLDOWN_BASE_MIN = 4;
/** Sopra questa energia qualcuno sta raccontando: non si interrompe. */
const ENERGIA_RACCONTO = 0.7;
/** Quanto deve durare lo squilibrio dei turni prima di intervenire. */
const TICK_SQUILIBRIO = 3;

/**
 * Soglia di silenzio "imbarazzante", in secondi, in funzione dei minuti
 * trascorsi. All'inizio bastano sette secondi, dopo un'ora ne servono venti.
 * @param {number} minuti
 * @returns {number}
 */
export function sogliaSilenzio(minuti) {
  return 7 + Math.min(13, minuti * 0.22);
}

/**
 * Crea la sessione del compagno.
 *
 * Il consenso e' un cancello, non una preferenza: se anche uno solo dei due non
 * lo da', il compagno non ascolta niente. Non esiste una modalita' "ascolto
 * solo per uno dei due", perche' l'altro sarebbe ascoltato senza aver detto di
 * si'.
 *
 * @param {{ matchId: string, partecipanti: string[], quando: { inizio: string, durata_minuti: number }, icebreakers: { mazzo: any[] } }} eventCard
 * @param {{ consenso?: Record<string, boolean>, modo?: 'schermo'|'voce', now?: Date }} [options]
 */
export function createCompanionSession(eventCard, options = {}) {
  const consenso = options.consenso ?? {};
  const partecipanti = eventCard.partecipanti;
  const mancanti = partecipanti.filter((id) => consenso[id] !== true);

  const base = {
    matchId: eventCard.matchId,
    partecipanti,
    // Di default il compagno scrive sullo schermo invece di parlare: una voce
    // che esce dal telefono a un primo appuntamento la sentono anche i tavoli
    // vicini, e mette in imbarazzo entrambi. La voce e' una scelta esplicita.
    modo: options.modo ?? 'schermo',
    inizio: new Date(eventCard.quando.inizio),
    durataPrevistaMin: eventCard.quando.durata_minuti,
    mazzo: eventCard.icebreakers.mazzo.slice(),
    carteUsate: new Set(),
    interventi: [],
    ultimoInterventoSec: -Infinity,
    ultimoTipo: null,
    battuteFatte: 0,
    chiusuraProposta: false,
    squilibrioConsecutivo: 0,
    muto: false,
    // Aggregati per il debrief: numeri, mai contenuti.
    osservazioni: {
      tick: 0,
      silenzioTotaleSec: 0,
      silenzioMax: 0,
      risate: 0,
      domande: 0,
      quotaParlatoSomma: 0,
      energiaSomma: 0,
      carteGiocate: [],
      segnaliRischio: 0,
    },
    rng: createRng(`${eventCard.matchId}|companion`),
  };

  if (mancanti.length > 0) {
    return {
      ...base,
      attivo: false,
      modo: 'spento',
      motivo:
        'Il compagno resta spento: serve il consenso di entrambe le persone, ' +
        'altrimenti una delle due verrebbe ascoltata senza aver detto di si.',
      mancanti,
    };
  }

  return {
    ...base,
    attivo: true,
    apertura: pick(base.rng, APERTURA),
    indicatore:
      'Il telefono resta sul tavolo con la spia accesa per tutto il tempo: ' +
      'finche e accesa, il compagno sta ascoltando. Un tocco lo zittisce.',
    garanzie: [
      'L audio non esce dal telefono e non viene registrato.',
      'Al server arrivano solo numeri: durata dei silenzi, equilibrio dei turni, risate.',
      'Potete zittirlo in qualsiasi momento, e resta attiva solo la sicurezza.',
      'A fine serata i segnali grezzi vengono cancellati: resta solo il vostro debrief.',
    ],
  };
}

/** Pesca una carta non ancora usata, preferendo una categoria diversa dall'ultima. */
function pescaCarta(session, categoriaDaEvitare) {
  const disponibili = session.mazzo.filter((c) => !session.carteUsate.has(c.id));
  if (disponibili.length === 0) return null;
  const preferite = disponibili.filter((c) => c.categoria !== categoriaDaEvitare);
  const carta = pick(session.rng, preferite.length > 0 ? preferite : disponibili);
  session.carteUsate.add(carta.id);
  return carta;
}

/** Minuti di pausa richiesti prima del prossimo intervento non richiesto. */
function cooldownMin(session) {
  // Piu' ha parlato, piu' aspetta: il compagno si fa da parte man mano che la
  // conversazione si regge da sola.
  return COOLDOWN_BASE_MIN + session.interventi.filter((i) => !i.richiesto).length;
}

/** Aggiorna gli aggregati usati poi dal debrief. */
function accumula(session, tick) {
  const o = session.osservazioni;
  o.tick += 1;
  o.silenzioTotaleSec += tick.silenzioSec ?? 0;
  o.silenzioMax = Math.max(o.silenzioMax, tick.silenzioSec ?? 0);
  o.risate += tick.risate ?? 0;
  o.domande += tick.domande ?? 0;
  o.quotaParlatoSomma += tick.quotaParlato ?? 0.5;
  o.energiaSomma += tick.energia ?? 0.5;
  if ((tick.rischio ?? 'nessuno') !== 'nessuno') o.segnaliRischio += 1;

  // Efficacia delle carte: si guarda se dopo una carta si e' riso o se la
  // conversazione e' ripartita. E' il segnale che torna al matcher.
  for (const giocata of o.carteGiocate) {
    if (tick.t - giocata.t <= 180 && !giocata.chiusa) {
      giocata.risateDopo += tick.risate ?? 0;
      giocata.energiaDopo = Math.max(giocata.energiaDopo, tick.energia ?? 0);
      if (tick.t - giocata.t > 150) giocata.chiusa = true;
    }
  }
}

/** Registra un intervento e restituisce l'oggetto da mostrare all'utente. */
function emetti(session, tick, { tipo, frase, carta, richiesto = false, silenzioso = false }) {
  const intervento = {
    t: tick.t,
    minuto: Math.round(tick.t / 60),
    tipo,
    frase,
    carta: carta ?? null,
    richiesto,
    // Un intervento silenzioso non viene mostrato al tavolo: e' un segnale
    // interno verso la Fase 4.
    silenzioso,
    modo: silenzioso ? 'interno' : session.modo,
  };
  session.interventi.push(intervento);
  if (!silenzioso) {
    session.ultimoInterventoSec = tick.t;
    session.ultimoTipo = tipo;
  }
  if (carta) {
    session.osservazioni.carteGiocate.push({
      t: tick.t,
      cardId: carta.id,
      categoria: carta.categoria,
      origine: carta.origine,
      testo: carta.testo,
      risateDopo: 0,
      energiaDopo: 0,
      chiusa: false,
    });
  }
  return intervento;
}

/**
 * Elabora un tick di segnali e decide se e come intervenire.
 *
 * @param {ReturnType<typeof createCompanionSession>} session
 * @param {SignalTick} tick
 * @returns {{ intervento: any|null, sicurezza: any|null, stato: string }}
 */
export function observe(session, tick) {
  if (!session.attivo) {
    return { intervento: null, sicurezza: null, stato: 'spento' };
  }
  accumula(session, tick);

  const minuti = tick.t / 60;
  const rischio = tick.rischio ?? 'nessuno';
  const energia = tick.energia ?? 0.5;
  const silenzio = tick.silenzioSec ?? 0;
  const quota = tick.quotaParlato ?? 0.5;

  // --- 1. Sicurezza: precede tutto e non passa mai dal tavolo ---------------
  // Un allarme detto ad alta voce davanti alla persona di cui hai paura ti
  // mette in pericolo invece di toglierti da li'. Quindi e' sempre silenzioso.
  if (rischio !== 'nessuno') {
    const sicurezza = {
      livello: rischio,
      motivoSupporto: rischio === 'allarme' ? 'mi_sento_in_pericolo' : 'disagio_durante',
      azione:
        rischio === 'allarme'
          ? 'Apri il canale con un operatore umano e mostra uscita assistita ed emergenza.'
          : 'Proponi in modo discreto l uscita assistita e il supporto.',
      visibileAlTavolo: false,
    };
    emetti(session, tick, {
      tipo: 'sicurezza',
      frase: null,
      silenzioso: true,
    });
    return { intervento: null, sicurezza, stato: 'allerta' };
  }

  // --- 2. Richiesta esplicita: si risponde sempre ---------------------------
  if (tick.richiestaDa) {
    const carta = pescaCarta(session, session.ultimoTipo === 'carta' ? null : undefined);
    if (!carta) {
      return { intervento: null, sicurezza: null, stato: 'mazzo_finito' };
    }
    return {
      intervento: emetti(session, tick, {
        tipo: 'su_richiesta',
        frase: pick(session.rng, SU_RICHIESTA),
        carta,
        richiesto: true,
      }),
      sicurezza: null,
      stato: 'attivo',
    };
  }

  // Zittito dall'utente: resta solo la sicurezza, gestita sopra.
  if (session.muto) return { intervento: null, sicurezza: null, stato: 'muto' };

  // --- 3. Squilibrio dei turni: si accumula, non scatta al primo tick -------
  const squilibrato = Math.abs(quota - 0.5) >= 0.3;
  session.squilibrioConsecutivo = squilibrato ? session.squilibrioConsecutivo + 1 : 0;

  // --- 4. Cancelli comuni agli interventi non richiesti ---------------------
  const spesi = session.interventi.filter((i) => !i.richiesto && !i.silenzioso).length;
  if (spesi >= BUDGET_INTERVENTI) {
    return { intervento: null, sicurezza: null, stato: 'budget_esaurito' };
  }
  if ((tick.t - session.ultimoInterventoSec) / 60 < cooldownMin(session)) {
    return { intervento: null, sicurezza: null, stato: 'in_pausa' };
  }
  // Qualcuno sta raccontando: qualsiasi cosa dicessi ora sarebbe
  // un'interruzione, anche la piu' azzeccata.
  if (energia >= ENERGIA_RACCONTO && silenzio < 3) {
    return { intervento: null, sicurezza: null, stato: 'non_interrompo' };
  }

  // --- 5. Chiusura: la serata si sta spegnendo -----------------------------
  const finePrevista = session.durataPrevistaMin * 0.75;
  if (
    !session.chiusuraProposta &&
    minuti >= finePrevista &&
    energia < 0.3 &&
    silenzio >= sogliaSilenzio(minuti)
  ) {
    session.chiusuraProposta = true;
    return {
      intervento: emetti(session, tick, {
        tipo: 'chiusura',
        frase: pick(session.rng, CHIUSURA),
      }),
      sicurezza: null,
      stato: 'attivo',
    };
  }

  // --- 6. Silenzio imbarazzante: si rilancia con una carta ------------------
  if (silenzio >= sogliaSilenzio(minuti)) {
    const carta = pescaCarta(session);
    if (carta) {
      // Se uno dei due sta parlando molto meno, il rilancio glielo si gira.
      const riequilibra = session.squilibrioConsecutivo >= TICK_SQUILIBRIO;
      if (riequilibra) session.squilibrioConsecutivo = 0;
      return {
        intervento: emetti(session, tick, {
          tipo: riequilibra ? 'riequilibrio' : 'rilancio',
          frase: pick(session.rng, riequilibra ? RIEQUILIBRIO : RILANCIO_SILENZIO),
          carta,
        }),
        sicurezza: null,
        stato: 'attivo',
      };
    }
  }

  // --- 7. Squilibrio prolungato senza silenzio: si tira dentro chi ascolta --
  if (session.squilibrioConsecutivo >= TICK_SQUILIBRIO && energia < ENERGIA_RACCONTO) {
    const carta = pescaCarta(session);
    if (carta) {
      session.squilibrioConsecutivo = 0;
      return {
        intervento: emetti(session, tick, {
          tipo: 'riequilibrio',
          frase: pick(session.rng, RIEQUILIBRIO),
          carta,
        }),
        sicurezza: null,
        stato: 'attivo',
      };
    }
  }

  // --- 8. Battuta: solo se si sta gia' ridendo ------------------------------
  // Una battuta dentro un silenzio teso lo peggiora. Serve che il clima sia
  // gia' buono: allora e' una spalla, non un salvataggio.
  if (
    session.battuteFatte < BUDGET_BATTUTE &&
    session.ultimoTipo !== 'battuta' &&
    (tick.risate ?? 0) > 0 &&
    energia >= 0.4 &&
    minuti >= 10
  ) {
    session.battuteFatte += 1;
    return {
      intervento: emetti(session, tick, {
        tipo: 'battuta',
        frase: pick(session.rng, BATTUTE),
      }),
      sicurezza: null,
      stato: 'attivo',
    };
  }

  return { intervento: null, sicurezza: null, stato: 'in_ascolto' };
}

/**
 * Zittisce o riattiva il compagno. La sicurezza resta comunque attiva: e'
 * l'unica cosa che l'utente non puo' spegnere a meta' serata, ed e' scritto
 * nel consenso iniziale.
 * @param {ReturnType<typeof createCompanionSession>} session
 * @param {boolean} muto
 */
export function setMuto(session, muto) {
  session.muto = muto;
  return {
    muto,
    messaggio: muto
      ? 'Ok, sparisco. Resta attiva solo la parte di sicurezza.'
      : 'Torno disponibile.',
  };
}

/**
 * Chiude la sessione e restituisce gli aggregati.
 *
 * Da qui in poi i segnali grezzi non servono piu' e vanno buttati: quello che
 * resta e' il riassunto numerico da cui nasce il debrief.
 * @param {ReturnType<typeof createCompanionSession>} session
 * @param {{ durataEffettivaMin?: number }} [options]
 */
export function closeCompanionSession(session, options = {}) {
  const o = session.osservazioni;
  const tick = Math.max(1, o.tick);
  return {
    matchId: session.matchId,
    partecipanti: session.partecipanti,
    attivo: session.attivo,
    durataMin: options.durataEffettivaMin ?? session.durataPrevistaMin,
    interventi: session.interventi.filter((i) => !i.silenzioso),
    metriche: {
      silenzioMedioSec: o.silenzioTotaleSec / tick,
      silenzioMax: o.silenzioMax,
      risate: o.risate,
      domande: o.domande,
      // Quota di parlato del primo partecipante; l'altro e' il complemento.
      quotaParlatoMedia: o.quotaParlatoSomma / tick,
      energiaMedia: o.energiaSomma / tick,
      segnaliRischio: o.segnaliRischio,
    },
    carteGiocate: o.carteGiocate,
    segnaliGrezziCancellati: true,
  };
}
