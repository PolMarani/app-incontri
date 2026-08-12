/**
 * FASE 4 - Sicurezza, conferme e supporto.
 *
 * Un'app che manda due sconosciuti a incontrarsi di persona, senza chat e senza
 * foto, si prende due responsabilita' che non puo' scaricare sull'utente:
 *
 *  1. Ridurre il buco a vuoto. Le conferme a T-24h, T-6h e T-1h esistono per
 *     far cadere in anticipo gli incontri che non si terranno, invece di
 *     lasciare qualcuno ad aspettare a un tavolo.
 *  2. Non lasciare nessuno da solo quando va male. Il canale di supporto e'
 *     sempre aperto e non e' mai un canale verso l'altra persona: l'utente
 *     parla con l'assistente dell'app o con un operatore umano, mai con il
 *     match. Il principio "zero chat" non ha eccezioni, nemmeno qui.
 *
 * Nota sul supporto psicologico: l'assistente automatico non fa diagnosi e non
 * sostituisce un professionista. Quando emergono segnali di rischio la
 * conversazione passa a un umano e vengono mostrati i numeri di emergenza.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Stati del ciclo di vita di un incontro. */
export const MEETING_STATES = /** @type {const} */ ([
  'programmato',
  'confermato',
  'in_corso',
  'concluso',
  'annullato',
]);

/**
 * Scaletta delle conferme. `graceMinutes` e' il tempo che passa fra il sollecito
 * e l'annullamento automatico.
 */
export const CHECKPOINTS = [
  { id: 'T-24h', offsetMs: 24 * HOUR, graceMinutes: 240, label: 'un giorno prima' },
  { id: 'T-6h', offsetMs: 6 * HOUR, graceMinutes: 120, label: 'sei ore prima' },
  { id: 'T-1h', offsetMs: 1 * HOUR, graceMinutes: 30, label: 'un ora prima' },
];

/** Finestra di check-in di arrivo al locale. */
const ARRIVAL_EARLY_MIN = 15;
const NO_SHOW_SUSPECTED_MIN = 20;
const NO_SHOW_CONFIRMED_MIN = 35;
/** Ping discreto di controllo dopo l'inizio. */
const WELLNESS_PING_MIN = 30;

/** Numeri utili mostrati insieme al supporto. In produzione sono per paese. */
export const EMERGENCY_RESOURCES = [
  { nome: 'Emergenza (polizia, ambulanza)', numero: '112', quando: 'pericolo immediato' },
  { nome: 'Antiviolenza e stalking', numero: '1522', quando: 'molestie, violenza, stalking - attivo 24/7 e gratuito' },
  { nome: 'Telefono Amico', numero: '02 2327 2327', quando: 'disagio emotivo, bisogno di parlare' },
];

/**
 * Pulsanti sempre disponibili nella scheda dell'evento, prima e durante.
 * `discreto: true` significa che l'azione non produce nessun segnale visibile
 * a chi ti sta di fronte.
 */
export const SAFETY_ACTIONS = [
  {
    id: 'arrivato',
    etichetta: 'Sono arrivato',
    descrizione: 'Conferma di essere sul posto. Sblocca il monitoraggio del no-show.',
    discreto: false,
  },
  {
    id: 'uscita_assistita',
    etichetta: 'Fammi uscire',
    descrizione:
      'L app ti chiama fingendo un imprevisto e ti manda il percorso di uscita ' +
      'piu vicino. Nessuna notifica all altra persona.',
    discreto: true,
  },
  {
    id: 'avvisa_staff',
    etichetta: 'Avvisa il personale del locale',
    descrizione:
      'Manda una segnalazione allo staff del locale, che e formato sul ' +
      'protocollo BlindStep: ti raggiungono al tavolo con una scusa.',
    discreto: true,
  },
  {
    id: 'condividi_posizione',
    etichetta: 'Condividi con un contatto fidato',
    descrizione:
      'Invia luogo, orario e posizione live al contatto che hai scelto, fino ' +
      'al tuo rientro.',
    discreto: true,
  },
  {
    id: 'supporto',
    etichetta: 'Parla con qualcuno',
    descrizione: 'Apre il canale di supporto: assistente dell app o operatore umano.',
    discreto: true,
  },
  {
    id: 'emergenza',
    etichetta: 'Emergenza',
    descrizione: 'Chiamata diretta al 112 con la posizione gia pronta da leggere.',
    discreto: false,
  },
];

/**
 * @typedef {Object} MeetingPlan
 * @property {string} matchId
 * @property {string[]} partecipanti
 * @property {Date} startsAt
 * @property {string} state
 * @property {Array<{ id: string, label: string, dueAt: Date, deadlineAt: Date, confermato: Record<string, boolean>, sollecitato: boolean, esito: string|null }>} checkpoints
 * @property {Record<string, Date|null>} arrivi
 * @property {Array<{ at: Date, tipo: string, dettaglio: string, utente?: string }>} timeline
 */

/**
 * Crea il piano di sicurezza per un incontro confermato in Fase 3.
 * @param {{ matchId: string, partecipanti: string[], quando: { inizio: string } }} eventCard
 * @param {{ now?: Date }} [options]
 * @returns {MeetingPlan}
 */
export function createMeetingPlan(eventCard, options = {}) {
  const now = options.now ?? new Date();
  const startsAt = new Date(eventCard.quando.inizio);
  const partecipanti = eventCard.partecipanti;

  const checkpoints = CHECKPOINTS.map((cp) => ({
    id: cp.id,
    label: cp.label,
    dueAt: new Date(startsAt.getTime() - cp.offsetMs),
    deadlineAt: new Date(startsAt.getTime() - cp.offsetMs + cp.graceMinutes * MINUTE),
    confermato: Object.fromEntries(partecipanti.map((id) => [id, false])),
    sollecitato: false,
    esito: null,
  }))
    // Un incontro fissato per fra due ore non puo' avere un checkpoint a T-24h.
    .filter((cp) => cp.deadlineAt.getTime() > now.getTime());

  return {
    matchId: eventCard.matchId,
    partecipanti,
    startsAt,
    state: 'programmato',
    checkpoints,
    arrivi: Object.fromEntries(partecipanti.map((id) => [id, null])),
    timeline: [{ at: now, tipo: 'creato', dettaglio: 'Piano di sicurezza attivo' }],
  };
}

/**
 * Registra la conferma di un utente su un checkpoint.
 * @param {MeetingPlan} plan
 * @param {string} userId
 * @param {string} checkpointId
 * @param {{ now?: Date }} [options]
 * @returns {{ ok: boolean, messaggio: string }}
 */
export function confirmCheckpoint(plan, userId, checkpointId, options = {}) {
  const now = options.now ?? new Date();
  if (!plan.partecipanti.includes(userId)) {
    return { ok: false, messaggio: 'Utente non associato a questo incontro' };
  }
  if (plan.state === 'annullato') {
    return { ok: false, messaggio: 'Incontro gia annullato' };
  }
  const checkpoint = plan.checkpoints.find((cp) => cp.id === checkpointId);
  if (!checkpoint) {
    return { ok: false, messaggio: `Checkpoint ${checkpointId} non previsto` };
  }
  if (now.getTime() > checkpoint.deadlineAt.getTime()) {
    return { ok: false, messaggio: 'Termine scaduto: la conferma non e piu valida' };
  }

  checkpoint.confermato[userId] = true;
  plan.timeline.push({
    at: now,
    tipo: 'conferma',
    dettaglio: `${checkpointId} confermato`,
    utente: userId,
  });

  const tutti = Object.values(checkpoint.confermato).every(Boolean);
  if (tutti) {
    checkpoint.esito = 'confermato';
    plan.state = 'confermato';
  }
  return {
    ok: true,
    messaggio: tutti
      ? 'Confermato da entrambi: l incontro resta in piedi.'
      : 'Conferma registrata. Manca ancora l altra persona.',
  };
}

/**
 * Annulla l'incontro. Usato sia dall'utente sia dall'automatismo dei checkpoint.
 * @param {MeetingPlan} plan
 * @param {{ da?: string, motivo: string, now?: Date }} params
 */
export function cancelMeeting(plan, { da, motivo, now = new Date() }) {
  plan.state = 'annullato';
  plan.timeline.push({ at: now, tipo: 'annullato', dettaglio: motivo, utente: da });

  const altro = da ? plan.partecipanti.find((id) => id !== da) : null;
  return {
    stato: plan.state,
    motivo,
    notifiche: plan.partecipanti.map((id) => ({
      utente: id,
      // Nessuna colpevolizzazione e nessun dettaglio sull'altro: l'unica
      // informazione utile e' che la serata e' libera.
      testo:
        id === da
          ? 'Incontro annullato. Nessun problema: il tuo profilo torna in circolo da subito.'
          : 'L incontro non si fara. Non e successo niente di personale: capita, ed e ' +
            'per questo che esistono le conferme. Hai la priorita sul prossimo abbinamento.',
      azioni: id === da ? ['rimetti_in_circolo'] : ['rimetti_in_circolo', 'parla_con_qualcuno'],
    })),
    supportoOfferto: altro ? [altro] : [],
  };
}

/**
 * Fa avanzare il piano al tempo `now`: emette solleciti, annulla cio' che e'
 * scaduto, apre le finestre di check-in e rileva i no-show.
 *
 * Va chiamata da uno scheduler; e' idempotente, chiamarla due volte con lo
 * stesso `now` non duplica le azioni.
 *
 * @param {MeetingPlan} plan
 * @param {{ now?: Date }} [options]
 * @returns {{ stato: string, azioni: Array<{ tipo: string, utente?: string, testo: string }> }}
 */
export function advance(plan, options = {}) {
  const now = options.now ?? new Date();
  /** @type {Array<{ tipo: string, utente?: string, testo: string }>} */
  const azioni = [];

  if (plan.state === 'annullato' || plan.state === 'concluso') {
    return { stato: plan.state, azioni };
  }

  // Se qualcuno e' gia' sul posto, le conferme non contano piu': annullare un
  // incontro sotto il naso di chi e' seduto al tavolo sarebbe il peggiore dei
  // comportamenti possibili, checkpoint scaduto o no.
  const qualcunoEArrivato = Object.values(plan.arrivi).some(Boolean);

  // --- Checkpoint di conferma ------------------------------------------------
  for (const cp of plan.checkpoints) {
    if (qualcunoEArrivato) break;
    if (cp.esito) continue;
    const mancanti = plan.partecipanti.filter((id) => !cp.confermato[id]);
    if (mancanti.length === 0) {
      cp.esito = 'confermato';
      continue;
    }
    if (now >= cp.deadlineAt) {
      cp.esito = 'scaduto';
      const result = cancelMeeting(plan, {
        motivo: `Conferma ${cp.id} non arrivata entro il termine`,
        now,
      });
      azioni.push(
        ...result.notifiche.map((n) => ({
          tipo: 'annullamento_automatico',
          utente: n.utente,
          testo: n.testo,
        })),
      );
      return { stato: plan.state, azioni };
    }
    if (now >= cp.dueAt && !cp.sollecitato) {
      cp.sollecitato = true;
      for (const id of mancanti) {
        azioni.push({
          tipo: 'sollecito',
          utente: id,
          testo:
            `Conferma ${cp.label}: ci sei? Se non confermi entro ` +
            `${Math.round((cp.deadlineAt - now) / MINUTE)} minuti l incontro si annulla ` +
            'da solo, senza penalita.',
        });
      }
      plan.timeline.push({ at: now, tipo: 'sollecito', dettaglio: cp.id });
    }
  }

  // --- Finestra di arrivo ----------------------------------------------------
  const start = plan.startsAt.getTime();
  if (now.getTime() >= start - ARRIVAL_EARLY_MIN * MINUTE && plan.state !== 'in_corso') {
    if (plan.checkpoints.every((cp) => cp.esito !== 'scaduto')) {
      plan.state = 'in_corso';
      azioni.push({
        tipo: 'apertura_checkin',
        testo: 'Check-in aperto: premi "Sono arrivato" quando sei sul posto.',
      });
    }
  }

  // --- No-show ---------------------------------------------------------------
  const arrivati = plan.partecipanti.filter((id) => plan.arrivi[id]);
  const assenti = plan.partecipanti.filter((id) => !plan.arrivi[id]);
  if (arrivati.length === 1 && assenti.length === 1) {
    const minutiDaInizio = (now.getTime() - start) / MINUTE;
    if (minutiDaInizio >= NO_SHOW_CONFIRMED_MIN) {
      azioni.push({
        tipo: 'no_show_confermato',
        utente: arrivati[0],
        testo:
          'Non e arrivato nessuno e ci dispiace davvero. Non e una cosa che ti ' +
          'riguarda. La serata la chiudiamo qui: hai la priorita sul prossimo ' +
          'abbinamento e, se ti va, c e qualcuno con cui parlarne adesso.',
      });
      cancelMeeting(plan, { motivo: 'No-show confermato', now });
    } else if (minutiDaInizio >= NO_SHOW_SUSPECTED_MIN) {
      azioni.push({
        tipo: 'no_show_sospetto',
        utente: arrivati[0],
        testo:
          'L altra persona non ha ancora fatto check-in. Aspetta ancora un quarto ' +
          'd ora: se non arriva ti avvisiamo noi e non devi fare niente. ' +
          'Intanto, se vuoi, apriamo il supporto.',
      });
    }
  }

  // --- Ping di benessere -----------------------------------------------------
  if (arrivati.length === plan.partecipanti.length) {
    const minutiDaInizio = (now.getTime() - start) / MINUTE;
    if (minutiDaInizio >= WELLNESS_PING_MIN && !plan.timeline.some((e) => e.tipo === 'wellness_ping')) {
      plan.timeline.push({ at: now, tipo: 'wellness_ping', dettaglio: 'inviato' });
      azioni.push({
        tipo: 'wellness_ping',
        testo:
          'Tutto bene? Una risposta sola, silenziosa: verde se va, rosso se vuoi ' +
          'che ti tiriamo fuori da li in due minuti.',
      });
    }
  }

  return { stato: plan.state, azioni };
}

/**
 * Check-in di arrivo al locale.
 * @param {MeetingPlan} plan
 * @param {string} userId
 * @param {{ now?: Date }} [options]
 */
export function checkIn(plan, userId, options = {}) {
  const now = options.now ?? new Date();
  if (!plan.partecipanti.includes(userId)) {
    return { ok: false, messaggio: 'Utente non associato a questo incontro' };
  }
  plan.arrivi[userId] = now;
  plan.timeline.push({ at: now, tipo: 'arrivo', dettaglio: 'check-in', utente: userId });

  const entrambi = plan.partecipanti.every((id) => plan.arrivi[id]);
  if (entrambi) plan.state = 'in_corso';
  return {
    ok: true,
    entrambiPresenti: entrambi,
    messaggio: entrambi
      ? 'Ci siete tutti e due. Da qui in poi il telefono serve solo per le carte.'
      : 'Check-in registrato. Se l altra persona non arriva entro venti minuti ti avvisiamo noi.',
  };
}

/**
 * Motivi per cui si apre il supporto, con il canale a cui vengono instradati.
 * `umano: true` significa operatore umano da subito, senza passare dall assistente.
 */
const SUPPORT_ROUTING = {
  ansia_pre_date: { umano: false, priorita: 'bassa' },
  partner_non_risponde: { umano: false, priorita: 'media' },
  ritardo: { umano: false, priorita: 'media' },
  no_show: { umano: false, priorita: 'alta' },
  disagio_durante: { umano: true, priorita: 'urgente' },
  mi_sento_in_pericolo: { umano: true, priorita: 'critica' },
  comportamento_da_segnalare: { umano: true, priorita: 'urgente' },
  post_date: { umano: false, priorita: 'bassa' },
};

/** Aperture del canale, per motivo. Tono: concreto, mai paternalistico. */
const SUPPORT_OPENERS = {
  ansia_pre_date:
    'Manca poco e ti sta salendo l ansia. E normalissimo, e non sei obbligato a ' +
    'andare: possiamo anche solo ragionarci su per cinque minuti.',
  partner_non_risponde:
    'Non hai ancora ricevuto la conferma e stai pensando che salti tutto. ' +
    'Vediamo insieme come stai messo, e ricorda che se salta non e per colpa tua.',
  ritardo:
    'Sta tardando. Prima di decidere se restare o andartene: quanto tempo ti va ' +
    'di aspettare? Decidiamo un limite adesso, cosi non ci pensi piu.',
  no_show:
    'Non e venuto nessuno. E una cosa brutta da vivere e non dice niente di te. ' +
    'Se vuoi ne parliamo, se preferisci ti lascio in pace: dimmi solo quale delle due.',
  disagio_durante:
    'Ci sei ancora dentro. La priorita adesso e farti uscire: ti passo un operatore ' +
    'e intanto guarda le opzioni qui sotto.',
  mi_sento_in_pericolo:
    'Ti metto subito in contatto con una persona vera. Se sei in pericolo immediato ' +
    'chiama il 112: puoi farlo da qui e la posizione e gia pronta.',
  comportamento_da_segnalare:
    'Grazie per averlo detto. Prende in carico una persona del team: la segnalazione ' +
    'ha effetto sull altro profilo, non sul tuo.',
  post_date:
    'Com e andata? Non serve un voto, se ti va raccontala e basta.',
};

/**
 * Apre il canale di supporto per un utente.
 *
 * Non e' mai un canale verso l'altra persona: il principio "zero chat" resta
 * valido anche nei casi peggiori, perche' e' proprio quando va male che una
 * chat diretta fa danni.
 *
 * @param {MeetingPlan} plan
 * @param {{ utente: string, motivo: keyof typeof SUPPORT_ROUTING, testoLibero?: string, now?: Date }} params
 */
export function openSupportChannel(plan, { utente, motivo, testoLibero, now = new Date() }) {
  if (!plan.partecipanti.includes(utente)) {
    throw new Error('Utente non associato a questo incontro');
  }
  const routing = SUPPORT_ROUTING[motivo];
  if (!routing) throw new Error(`Motivo di supporto sconosciuto: ${motivo}`);

  // Rete di sicurezza sul testo libero: certe parole scavalcano il routing e
  // portano subito a un umano, qualunque motivo l'utente abbia selezionato.
  const segnaliDiRischio = /(paura|seguit[oa]|minacc|molest|aggredit|non riesco a uscire|farmi del male)/i;
  const escalationDaTesto = Boolean(testoLibero && segnaliDiRischio.test(testoLibero));
  const canale = routing.umano || escalationDaTesto ? 'operatore_umano' : 'assistente_ai';

  plan.timeline.push({
    at: now,
    tipo: 'supporto_aperto',
    dettaglio: `${motivo} -> ${canale}`,
    utente,
  });

  return {
    canale,
    priorita: escalationDaTesto ? 'critica' : routing.priorita,
    apertura: SUPPORT_OPENERS[motivo],
    trasparenza:
      canale === 'assistente_ai'
        ? 'Stai parlando con l assistente di BlindStep, non con una persona. ' +
          'Scrivi "operatore" in qualsiasi momento e ti passo qualcuno in carne e ossa.'
        : 'Ti sto passando un operatore del team. Resta qui, ci mette meno di un minuto.',
    puoiSempre: [
      'passare a un operatore umano',
      'chiudere la conversazione senza spiegazioni',
      'chiedere di cancellare quello che hai scritto',
    ],
    limiti:
      'L assistente non e un professionista della salute mentale e non fa diagnosi. ' +
      'Per un supporto continuativo il team puo indirizzarti a un servizio dedicato.',
    risorse: EMERGENCY_RESOURCES,
    azioniRapide: SAFETY_ACTIONS.filter((a) =>
      canale === 'operatore_umano'
        ? ['uscita_assistita', 'avvisa_staff', 'emergenza', 'condividi_posizione'].includes(a.id)
        : ['uscita_assistita', 'condividi_posizione', 'supporto'].includes(a.id),
    ),
    // L'altra persona non riceve nessun segnale: il supporto e' invisibile.
    notificaAllAltro: null,
  };
}

/**
 * Riepilogo leggibile del piano, utile per la UI e per il log.
 * @param {MeetingPlan} plan
 */
export function summarizePlan(plan) {
  return {
    matchId: plan.matchId,
    stato: plan.state,
    inizio: plan.startsAt.toISOString(),
    conferme: plan.checkpoints.map((cp) => ({
      quando: cp.label,
      scadenza: cp.deadlineAt.toISOString(),
      stato: cp.esito ?? (cp.sollecitato ? 'sollecitato' : 'in attesa'),
      mancano: plan.partecipanti.filter((id) => !cp.confermato[id]),
    })),
    arrivi: Object.fromEntries(
      Object.entries(plan.arrivi).map(([id, at]) => [id, at ? at.toISOString() : null]),
    ),
    eventi: plan.timeline.length,
  };
}
