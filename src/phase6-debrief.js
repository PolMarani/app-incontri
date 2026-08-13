/**
 * FASE 6 - Debrief post-incontro.
 *
 * Il compagno ha ascoltato tutta la sera; adesso deve restituire qualcosa che
 * serva davvero a chi era al tavolo. E' la parte più' facile da sbagliare
 * dell'intera app, quindi le regole sono poche e rigide.
 *
 *  1. IL DEBRIEF E' PRIVATO E ASIMMETRICO. Ognuno vede solo il proprio, e il
 *     proprio parla solo di se'. Nessuno riceve mai una valutazione dell'altra
 *     persona, e soprattutto nessuno riceve mai "cosa ha pensato l'altro di
 *     te": e' l'informazione che tutti vorrebbero e l'unica capace di fare
 *     danni veri.
 *
 *  2. UNA SOLA COSA DA PROVARE. Non un elenco. Tre osservazioni critiche di
 *     fila non sono un allenamento, sono una pagella - e a una pagella non si
 *     migliora, ci si affeziona in negativo. Prima cosa ha funzionato, poi al
 *     massimo una cosa da provare la volta dopo.
 *
 *  3. SI DESCRIVONO COMPORTAMENTI, MAI PERSONE. "Hai fatto due domande in
 *     un'ora e mezza" e' un fatto su cui si puo' agire; "sei poco curioso" e'
 *     un'etichetta che uno si porta dietro.
 *
 *  4. NIENTE PUNTEGGI. Nessun voto alla serata, nessun voto alla persona.
 *     Un numero su una cosa cosi' viene ricordato e nient'altro.
 */

/** Frasi che non devono mai comparire in un debrief. Verificate dai test. */
export const VIETATO_NEL_DEBRIEF = [
  // Mai riportare l'altro.
  /l altra persona ha (detto|pensato|trovato)/i,
  /secondo (lui|lei)/i,
  /(lui|lei) ti ha trovat/i,
  /(gli|le) sei piaciut/i,
  // Mai etichette sulla persona.
  /sei (poco|troppo|un po) (curios|noios|invadent|timid|egocentric)/i,
  /il tuo problema e/i,
  // Mai voti.
  /voto/i,
  /punteggio della serata/i,
];

/** Quote di parlato oltre le quali vale la pena farlo notare. */
const SOGLIA_DOMINANZA = 0.64;
const SOGLIA_SILENZIO = 0.36;

/**
 * Individua la carta che ha funzionato meglio: quella dopo cui si e' riso di
 * piu' o la conversazione e' ripartita con piu' energia.
 * @param {any[]} carteGiocate
 */
function cartaMigliore(carteGiocate) {
  if (!carteGiocate || carteGiocate.length === 0) return null;
  return carteGiocate
    .slice()
    .sort(
      (x, y) =>
        y.risateDopo - x.risateDopo ||
        y.energiaDopo - x.energiaDopo ||
        x.t - y.t,
    )[0];
}

/**
 * Costruisce il debrief privato di un singolo utente.
 *
 * @param {ReturnType<import('./phase5-companion.js').closeCompanionSession>} sessione
 * @param {string} userId
 * @returns {object}
 */
export function buildDebrief(sessione, userId) {
  if (!sessione.partecipanti.includes(userId)) {
    throw new Error(`Utente ${userId} non fa parte di questo incontro`);
  }
  if (!sessione.attivo) {
    return {
      utente: userId,
      disponibile: false,
      motivo:
        'Il compagno era spento, quindi non c\'è niente da raccontare. ' +
        'Il debrief esiste solo se lo avete acceso entrambi.',
    };
  }

  const m = sessione.metriche;
  const primo = sessione.partecipanti[0];
  // La metrica registrata e' la quota del primo partecipante: per l'altro e'
  // il complemento.
  const quotaMia = userId === primo ? m.quotaParlatoMedia : 1 - m.quotaParlatoMedia;

  // --- Cosa ha funzionato ---------------------------------------------------
  const funzionato = [];
  if (m.risate >= 3) {
    funzionato.push(`Avete riso ${m.risate} volte: la serata aveva un suo ritmo.`);
  }
  if (m.silenzioMedioSec < 6) {
    funzionato.push('La conversazione si e retta quasi sempre da sola.');
  }
  if (quotaMia >= 0.4 && quotaMia <= 0.6) {
    funzionato.push('Vi siete divisi lo spazio in modo equilibrato, ed e più raro di quanto sembri.');
  }
  const migliore = cartaMigliore(sessione.carteGiocate);
  if (migliore && (migliore.risateDopo > 0 || migliore.energiaDopo >= 0.6)) {
    funzionato.push(`La cosa che ha acceso di più la conversazione: "${migliore.testo}"`);
  }
  if (funzionato.length === 0) {
    funzionato.push('Ci siete andati, che e la parte che quasi nessuno fa.');
  }

  // --- Una sola cosa da provare --------------------------------------------
  /** @type {{ osservazione: string, prova: string }|null} */
  let daProvare = null;
  if (quotaMia >= SOGLIA_DOMINANZA) {
    daProvare = {
      osservazione: `Hai tenuto il campo per circa ${Math.round(quotaMia * 100)}% del tempo.`,
      prova:
        'La prossima volta prova a chiudere un tuo racconto con una domanda invece ' +
        'che con una conclusione: e il modo più semplice di passare la palla.',
    };
  } else if (quotaMia <= SOGLIA_SILENZIO) {
    daProvare = {
      osservazione: `Hai parlato per circa ${Math.round(quotaMia * 100)}% del tempo.`,
      prova:
        'Non c\'è niente di sbagliato nell ascoltare. Ma prova a portare una cosa tua ' +
        'senza aspettare che te la chiedano: quasi nessuno la chiede.',
    };
  } else if (m.domande <= 2 && sessione.durataMin >= 60) {
    daProvare = {
      osservazione: `In ${sessione.durataMin} minuti sono state fatte ${m.domande} domande in tutto.`,
      prova:
        'Una domanda in più sulla cosa che l\'altro ha appena detto vale più di ' +
        'un argomento nuovo: e il punto in cui una conversazione diventa un discorso.',
    };
  }

  return {
    utente: userId,
    disponibile: true,
    durataMin: sessione.durataMin,
    cosaHaFunzionato: funzionato,
    // Puo' essere null: se non c'e' niente di utile da dire, non si inventa
    // una critica per riempire lo spazio.
    daProvare,
    carteUsate: sessione.carteGiocate.length,
    nota:
      'Questo l\'ha scritto il compagno guardando solo il tuo modo di stare nella ' +
      'conversazione. Non sa cosa ha pensato l\'altra persona e non glielo ha chiesto.',
    privacy: 'Il debrief dell\'altra persona è diverso dal tuo e tu non lo vedrai mai.',
  };
}

/**
 * Trasforma i segnali di una o piu' serate in pesi per categoria di carta,
 * pronti da passare a `generateIcebreakers`.
 *
 * Chiude l'anello: finora la Fase 6 misurava quali carte accendevano la
 * conversazione e quel dato non arrivava da nessuna parte. Un peso sopra 1
 * significa "questa categoria ha funzionato con questa persona", sotto 1 il
 * contrario. Il valore resta vicino a 1 di proposito: dopo due serate non si sa
 * ancora niente, e un modello che si convince troppo in fretta smette di
 * proporre le cose che non ha ancora provato.
 *
 * @param {Array<ReturnType<typeof debriefSignalsForMatcher>>} segnali
 * @returns {Record<string, number>}
 */
export function preferenzeDaSegnali(segnali) {
  /** @type {Record<string, { somma: number, giocate: number }>} */
  const accumulo = {};
  for (const s of segnali) {
    if (!s?.utilizzabile) continue;
    for (const c of s.categorieEfficaci ?? []) {
      const voce = (accumulo[c.categoria] ??= { somma: 0, giocate: 0 });
      voce.somma += c.efficacia * c.giocate;
      voce.giocate += c.giocate;
    }
  }

  /** @type {Record<string, number>} */
  const pesi = {};
  for (const [categoria, v] of Object.entries(accumulo)) {
    const media = v.somma / Math.max(1, v.giocate);
    // Fiducia crescente con le prove: una sola carta giocata sposta pochissimo.
    const fiducia = Math.min(1, v.giocate / 6);
    pesi[categoria] = Math.round((1 + (media - 0.5) * 0.6 * fiducia) * 100) / 100;
  }
  return pesi;
}

/**
 * Scambio di contatti a doppio consenso.
 *
 * Zero chat *prima* dell'incontro e' il cuore dell'app e non si tocca. Ma dopo,
 * se la serata e' andata bene e uno dei due si e' dimenticato di chiedere il
 * contatto di persona, l'app oggi non offre niente e l'esperienza muore li'.
 *
 * La forma che non tradisce il principio: ognuno decide da solo entro una
 * finestra breve, e i contatti si sbloccano solo se entrambi hanno detto di si.
 * Non e' una chat, e' una presentazione reciproca.
 *
 * La regola che conta piu' di tutte: **chi ha detto di si non deve mai poter
 * sapere che l'altro ha detto di no**. Il messaggio di esito e' identico che
 * l'altro abbia rifiutato o semplicemente non abbia aperto l'app. Senza questa
 * ambiguita' voluta, dire di si' diventa un rischio e non lo fa piu' nessuno.
 *
 * @param {{ matchId: string, partecipanti: string[] }} sessione
 * @param {{ finestraOre?: number, now?: Date }} [options]
 */
export function apriScambioContatti(sessione, options = {}) {
  const now = options.now ?? new Date();
  const finestraOre = options.finestraOre ?? 12;
  return {
    matchId: sessione.matchId,
    partecipanti: sessione.partecipanti,
    scadenza: new Date(now.getTime() + finestraOre * 3600000),
    scelte: {},
    contatti: {},
    domanda:
      'Ti va di scambiare un contatto? Lo vedrete solo se lo volete tutti e due, ' +
      'e non saprai mai cosa ha risposto l\'altra persona.',
  };
}

/**
 * Registra la scelta di un utente. Il contatto viene raccolto subito ma
 * consegnato solo a consenso doppio.
 * @param {ReturnType<typeof apriScambioContatti>} scambio
 * @param {string} userId
 * @param {{ vuole: boolean, contatto?: string, now?: Date }} params
 */
export function rispondiScambioContatti(scambio, userId, { vuole, contatto, now = new Date() }) {
  if (!scambio.partecipanti.includes(userId)) {
    throw new Error(`Utente ${userId} non fa parte di questo incontro`);
  }
  if (now > scambio.scadenza) {
    return { ok: false, messaggio: 'La finestra si e chiusa. Va bene così.' };
  }
  scambio.scelte[userId] = Boolean(vuole);
  if (vuole && contatto) scambio.contatti[userId] = contatto;
  return {
    ok: true,
    messaggio: vuole
      ? 'Segnato. Se anche l\'altra persona vuole, vi arriva il contatto.'
      : 'Segnato, e non lo saprà nessuno.',
  };
}

/**
 * Chiude lo scambio. Restituisce un esito per utente.
 * @param {ReturnType<typeof apriScambioContatti>} scambio
 * @param {{ now?: Date }} [options]
 */
export function chiudiScambioContatti(scambio, options = {}) {
  const now = options.now ?? new Date();
  const scaduto = now >= scambio.scadenza;
  const tutti = scambio.partecipanti.every((id) => scambio.scelte[id] !== undefined);
  if (!scaduto && !tutti) return { stato: 'in_attesa' };

  const reciproco = scambio.partecipanti.every((id) => scambio.scelte[id] === true);

  return {
    stato: reciproco ? 'scambiato' : 'nessuno_scambio',
    esitiPerUtente: Object.fromEntries(
      scambio.partecipanti.map((id) => {
        const altro = scambio.partecipanti.find((x) => x !== id);
        return [
          id,
          reciproco
            ? {
                scambiato: true,
                contatto: scambio.contatti[altro] ?? null,
                messaggio: 'Vi siete scelti tutti e due. Da qui in poi non c entriamo più.',
              }
            : {
                scambiato: false,
                contatto: null,
                // Identico per chi ha detto no, per chi ha detto si e per chi
                // non ha risposto: e' il punto di tutta la funzione.
                messaggio: 'Non se ne fa niente. Non c\'è altro da sapere.',
              },
        ];
      }),
    ),
  };
}

/**
 * Segnali aggregati che tornano al matcher di Fase 1.
 *
 * Servono a smettere di indovinare: oggi i pesi e le famiglie di interessi sono
 * scritti a mano, e questo e' il primo dato reale su cosa fa davvero parlare
 * due persone. Contiene solo categorie e numeri, mai testo della conversazione.
 *
 * @param {ReturnType<import('./phase5-companion.js').closeCompanionSession>} sessione
 */
export function debriefSignalsForMatcher(sessione) {
  if (!sessione.attivo) return { matchId: sessione.matchId, utilizzabile: false };

  /** @type {Record<string, { giocate: number, risate: number, energia: number }>} */
  const perCategoria = {};
  for (const carta of sessione.carteGiocate) {
    const voce = (perCategoria[carta.categoria] ??= { giocate: 0, risate: 0, energia: 0 });
    voce.giocate += 1;
    voce.risate += carta.risateDopo;
    voce.energia += carta.energiaDopo;
  }

  const categorieEfficaci = Object.entries(perCategoria)
    .map(([categoria, v]) => ({
      categoria,
      giocate: v.giocate,
      efficacia: (v.risate + v.energia) / v.giocate,
    }))
    .sort((x, y) => y.efficacia - x.efficacia);

  return {
    matchId: sessione.matchId,
    utilizzabile: true,
    // Quanto la serata si e' retta da sola: l'indicatore piu' onesto di quanto
    // l'abbinamento fosse azzeccato.
    autonomia: Math.max(0, 1 - sessione.interventi.filter((i) => !i.richiesto).length / 6),
    risate: sessione.metriche.risate,
    equilibrio: 1 - Math.abs(sessione.metriche.quotaParlatoMedia - 0.5) * 2,
    energiaMedia: sessione.metriche.energiaMedia,
    categorieEfficaci,
    contieneContenutoConversazione: false,
  };
}
