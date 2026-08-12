/**
 * FASE 3 - Carta incontro e spunti di conversazione.
 *
 * Qui il match diventa una cosa concreta: un posto, un orario, un modo per
 * riconoscersi senza foto e senza nome, e un mazzo di carte da usare al tavolo.
 *
 * Il codice di riconoscimento e' pensato per funzionare senza scambio di
 * immagini: una parola chiave con risposta (cosi' nessuno abborda lo
 * sconosciuto sbagliato) e un segno visivo che chiunque puo' improvvisare sul
 * posto, senza comprare niente e senza addosso nulla di identificabile.
 */

import { createRng, pick, shuffle } from './util/rng.js';
import { dayLabel, nextOccurrence, toHHMM, toLocalDate } from './util/time.js';
import { VIBE_LABELS, familiesOf, interestLabel } from './data/taxonomy.js';
import { contieneContatti } from './validation.js';
import {
  BANNED_PATTERNS,
  CURIOSITY_PROMPTS,
  DIVERGENCE_PROMPTS,
  FAMILY_PROMPTS,
  GENERIC_INTEREST_PROMPTS,
  UNIVERSAL_DECK,
  VALUE_PROMPTS,
  VENUE_PROMPTS,
} from './data/icebreakers.js';

/** Parole neutre: nessun riferimento a persone, aspetto o provenienza. */
const CODEWORDS = [
  'ananas', 'bussola', 'meridiana', 'cactus', 'polaroid', 'ghiaccio',
  'faro', 'origami', 'metronomo', 'cometa', 'girasole', 'domino',
  'aquilone', 'lanterna', 'quarzo', 'tandem',
];

/** Segni visivi improvvisabili sul posto, senza oggetti da procurarsi. */
const VISUAL_SIGNS = [
  'un libro o un quaderno appoggiato in verticale sul tavolo',
  'il telefono a faccia in giu sopra un tovagliolo piegato a triangolo',
  'due bicchieri messi uno accanto all altro anche se sei da solo',
  'le chiavi appoggiate a destra del bicchiere',
  'una banconota piegata a meta infilata sotto il bicchiere',
  'la giacca appesa allo schienale della sedia di fronte, non alla tua',
  'lo scontrino piegato a fisarmonica accanto al bicchiere',
];

const MAX_HIGHLIGHTED = 5;
const MIN_HIGHLIGHTED = 3;
const DEFAULT_DECK_SIZE = 30;

/**
 * Quote del mazzo. Senza limiti il generatore produce venti varianti della
 * stessa domanda: gli interessi divergenti sono tanti e ogni template li
 * moltiplica, cosi' le carte migliori - i dilemmi del mazzo base - finiscono
 * fuori dal mazzo. Le quote tengono insieme personalizzazione e varieta'.
 */
const MAX_PER_CATEGORY = 4;
const MAX_PER_TEMPLATE = 2;

/**
 * Riempie i segnaposto di un template.
 * @param {string} template
 * @param {Record<string, string>} values
 * @returns {string}
 */
function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}

/** Normalizza il testo per il deduplicatore. */
const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Una carta e' accettabile se non tocca nessuno degli argomenti banditi.
 * @param {string} testo
 * @returns {boolean}
 */
export function isAcceptableCard(testo) {
  return !BANNED_PATTERNS.some((pattern) => pattern.test(testo));
}

/**
 * Costruisce il pool personalizzato: carte che esistono solo per questa coppia.
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {import('./types.js').MatchEvaluation} evaluation
 * @param {{ vibe: string|null }} context
 * @param {() => number} rng
 */
function buildPersonalizedPool(a, b, evaluation, context, rng) {
  /** @type {Array<{ categoria: string, testo: string, origine: string }>} */
  const pool = [];

  // 1. Punti di contatto sugli interessi condivisi.
  for (const tag of evaluation.sharedInterests) {
    const label = interestLabel(tag);
    const templates = [];
    for (const family of familiesOf(tag)) {
      if (FAMILY_PROMPTS[family]) templates.push(...FAMILY_PROMPTS[family]);
    }
    if (templates.length === 0) templates.push(...GENERIC_INTEREST_PROMPTS);
    for (const template of templates) {
      pool.push({
        categoria: 'contatto',
        testo: fill(template, { interesse: label, valore: label }),
        origine: `interesse condiviso: ${label}`,
        template,
      });
    }
  }

  // 2. Divergenze leggere: uno dei due ce l'ha, l'altro no.
  const divergent = shuffle(rng, evaluation.complementaryInterests);
  for (const [i, tag] of divergent.entries()) {
    const label = interestLabel(tag);
    const other = divergent[(i + 1) % divergent.length];
    for (const template of DIVERGENCE_PROMPTS) {
      // Il template a due argomenti serve solo se esiste davvero un secondo tag.
      if (template.includes('{altro}') && (divergent.length < 2 || other === tag)) continue;
      pool.push({
        categoria: 'divergenza',
        testo: fill(template, { interesse: label, altro: interestLabel(other) }),
        origine: `divergenza: ${label}`,
        template,
      });
    }
  }

  // 3. Curiosita' dichiarate: sono la materia prima migliore.
  for (const curiosity of [...(a.curiosities ?? []), ...(b.curiosities ?? [])]) {
    // Seconda barriera dopo la validazione del profilo: una curiosita' con
    // dentro un contatto verrebbe letta dall'altra persona prima ancora di
    // incontrarsi, e annullerebbe tutto l'anonimato costruito nelle fasi 2 e 3.
    // Si scarta la carta, non si prova a ripulire il testo: un filtro che
    // riscrive sbaglia prima o poi, uno che scarta no.
    if (!contieneContatti(curiosity).pulito) continue;
    for (const template of CURIOSITY_PROMPTS) {
      pool.push({
        categoria: 'curiosita',
        testo: fill(template, { curiosita: curiosity }),
        origine: 'curiosita dichiarata nel profilo',
        template,
      });
    }
  }

  // 4. Valori in comune, girati su fatti concreti.
  for (const value of evaluation.sharedValues) {
    for (const template of VALUE_PROMPTS) {
      pool.push({
        categoria: 'valori',
        testo: fill(template, { valore: interestLabel(value) }),
        origine: `valore condiviso: ${interestLabel(value)}`,
        template,
      });
    }
  }

  // 5. Carte ancorate al posto.
  const venuePrompts = VENUE_PROMPTS[context.vibe] ?? [];
  for (const template of venuePrompts) {
    pool.push({
      categoria: 'luogo',
      testo: template,
      origine: `ambientata nel posto scelto (${VIBE_LABELS[context.vibe] ?? context.vibe})`,
      template,
    });
  }

  return pool;
}

/**
 * Genera il mazzo di spunti: alcune carte in evidenza per rompere il ghiaccio
 * nei primi minuti, e un mazzo lungo da pescare per tutta la serata.
 *
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {import('./types.js').MatchEvaluation} evaluation
 * Se arrivano le preferenze apprese dalle serate precedenti
 * (`preferenzeCategorie`, prodotte dalla Fase 6), le categorie che hanno
 * funzionato davvero salgono in cima. E' l'unico punto del sistema in cui i
 * pesi smettono di essere quelli che ho scritto a mano e diventano quelli che
 * si sono visti al tavolo.
 *
 * @param {{ vibe?: string|null, seed?: string, deckSize?: number, highlighted?: number, preferenzeCategorie?: Record<string, number> }} [context]
 * @returns {{ inEvidenza: any[], mazzo: any[], perCategoria: Record<string, number> }}
 */
export function generateIcebreakers(a, b, evaluation, context = {}) {
  const rng = createRng(context.seed ?? `${a.id}|${b.id}`);
  const deckSize = context.deckSize ?? DEFAULT_DECK_SIZE;
  const wanted = Math.min(
    MAX_HIGHLIGHTED,
    Math.max(MIN_HIGHLIGHTED, context.highlighted ?? MAX_HIGHLIGHTED),
  );

  const personalized = buildPersonalizedPool(a, b, evaluation, {
    vibe: context.vibe ?? null,
  }, rng);
  const universal = UNIVERSAL_DECK.map((card) => ({
    ...card,
    origine: 'mazzo base',
    template: card.testo,
  }));

  // Le preferenze apprese riordinano il pool prima delle quote: piu una
  // categoria ha funzionato, piu' e' probabile che entri nel mazzo.
  const preferenze = context.preferenzeCategorie ?? {};
  const perPreferenza = (carte) =>
    Object.keys(preferenze).length === 0
      ? carte
      : carte
          .map((carta, i) => ({ carta, i, peso: preferenze[carta.categoria] ?? 1 }))
          .sort((x, y) => y.peso - x.peso || x.i - y.i)
          .map((x) => x.carta);

  const seen = new Set();
  /** @type {Map<string, number>} */
  const perTemplate = new Map();
  /** @type {Map<string, number>} */
  const perCategory = new Map();
  let counter = 0;
  /** @type {Array<{ id: string, categoria: string, testo: string, origine: string }>} */
  const clean = [];

  for (const card of [
    ...perPreferenza(shuffle(rng, personalized)),
    ...perPreferenza(shuffle(rng, universal)),
  ]) {
    const key = normalize(card.testo);
    if (seen.has(key)) continue;
    if (!isAcceptableCard(card.testo)) continue;

    const isBase = card.origine === 'mazzo base';
    const templateUses = perTemplate.get(card.template) ?? 0;
    const categoryUses = perCategory.get(card.categoria) ?? 0;
    // Le quote valgono sulle carte generate dai profili: il mazzo base e' gia'
    // scritto a mano, una carta per idea, e non ha bisogno di essere limitato.
    if (!isBase && templateUses >= MAX_PER_TEMPLATE) continue;
    if (!isBase && categoryUses >= MAX_PER_CATEGORY) continue;

    seen.add(key);
    perTemplate.set(card.template, templateUses + 1);
    perCategory.set(card.categoria, categoryUses + 1);
    counter += 1;
    clean.push({ id: `ice-${String(counter).padStart(3, '0')}`, ...card });
  }

  // In evidenza: si privilegiano le carte nate dai profili, e si evita di
  // aprire la serata con tre domande della stessa categoria.
  const inEvidenza = [];
  const usedCategories = new Set();
  const personalizedFirst = clean.filter((c) => c.origine !== 'mazzo base');
  for (const card of [...personalizedFirst, ...clean]) {
    if (inEvidenza.length >= wanted) break;
    if (inEvidenza.some((c) => c.id === card.id)) continue;
    if (usedCategories.has(card.categoria) && usedCategories.size < wanted) continue;
    usedCategories.add(card.categoria);
    inEvidenza.push(card);
  }
  // Se le categorie disponibili erano poche, si completa senza vincoli.
  for (const card of clean) {
    if (inEvidenza.length >= wanted) break;
    if (!inEvidenza.some((c) => c.id === card.id)) inEvidenza.push(card);
  }

  // Il resto del mazzo si pesca in sequenza durante la serata: alternando le
  // categorie si evita di trovarsi cinque dilemmi di fila a meta cena.
  const rest = clean.filter((card) => !inEvidenza.some((c) => c.id === card.id));
  /** @type {Map<string, typeof rest>} */
  const byCategory = new Map();
  for (const card of rest) {
    if (!byCategory.has(card.categoria)) byCategory.set(card.categoria, []);
    byCategory.get(card.categoria).push(card);
  }
  const interleaved = [];
  while (interleaved.length < rest.length) {
    for (const group of byCategory.values()) {
      const card = group.shift();
      if (card) interleaved.push(card);
    }
  }

  const mazzo = [...inEvidenza, ...interleaved].slice(
    0,
    Math.max(deckSize, inEvidenza.length),
  );

  /** @type {Record<string, number>} */
  const perCategoria = {};
  for (const card of mazzo) {
    perCategoria[card.categoria] = (perCategoria[card.categoria] ?? 0) + 1;
  }

  return { inEvidenza, mazzo, perCategoria };
}

/**
 * Codice di riconoscimento anonimo.
 *
 * Non descrive mai le persone: descrive cosa fanno con gli oggetti che trovano
 * al tavolo. Chi arriva prima prende il posto e mette il segno, l'altro cerca
 * il segno e apre con la parola chiave.
 *
 * @param {import('./types.js').Venue} venue
 * @param {{ minutiA: number, minutiB: number }} travel
 * @param {{ idA: string, idB: string }} users
 * @param {() => number} rng
 */
function generateRecognitionCode(venue, travel, users, rng) {
  const codeword = pick(rng, CODEWORDS);
  const signs = shuffle(rng, VISUAL_SIGNS);
  // Arriva per primo chi ha il tragitto piu' corto: tiene il tavolo invece di
  // far girare a vuoto l'altro. A parita', decide il sorteggio deterministico.
  const firstIsA =
    travel.minutiA < travel.minutiB ||
    (travel.minutiA === travel.minutiB && rng() < 0.5);

  return {
    parolaChiave: {
      apertura: `Scusa, aspetti anche tu il ${codeword}?`,
      risposta: `Si, ma il ${codeword} e sempre in ritardo.`,
      nota:
        'Se la risposta non arriva esattamente cosi, non e la persona giusta: ' +
        'sorridi e vai al punto di ritrovo indicato.',
    },
    puntoDiRitrovo: pick(rng, venue.recognitionSpots),
    segnoVisivo: {
      [users.idA]: signs[0],
      [users.idB]: signs[1],
    },
    arrivaPerPrimo: firstIsA ? users.idA : users.idB,
    istruzioni: [
      'Chi arriva per primo prende il tavolo o si ferma al punto di ritrovo e mette il proprio segno visivo.',
      'Chi arriva dopo cerca il segno, non la persona.',
      'La parola chiave si usa solo per confermare: e la vostra unica password.',
    ],
  };
}

/**
 * Costruisce la scheda dell'evento completa.
 *
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @param {import('./types.js').MatchEvaluation} evaluation
 * @param {{ optionId: string, venue: import('./types.js').Venue, slot: any, vibe: string|null, travelA: { minuti: number, modo: string }, travelB: { minuti: number, modo: string } }} chosen
 * @param {{ now?: Date, matchId?: string, deckSize?: number }} [options]
 */
export function buildEventCard(a, b, evaluation, chosen, options = {}) {
  const now = options.now ?? new Date();
  const matchId = options.matchId ?? `${a.id}-${b.id}`;
  const rng = createRng(`${matchId}|recognition`);
  const { venue, slot } = chosen;

  const startsAt = nextOccurrence(now, slot.day, slot.startMin);
  const endsAt = new Date(startsAt.getTime() + (slot.endMin - slot.startMin) * 60000);

  // Le carte ambientate nel posto seguono cio' che il locale e' davvero
  // (`venue.vibes[0]`), non la vibe che ha fatto scattare l'abbinamento.
  const icebreakers = generateIcebreakers(a, b, evaluation, {
    vibe: venue.vibes[0] ?? chosen.vibe,
    seed: `${matchId}|ice`,
    deckSize: options.deckSize,
  });

  return {
    matchId,
    partecipanti: [a.id, b.id],
    compatibilita: `${evaluation.score}%`,
    luogo: {
      nome: venue.name,
      indirizzo: venue.address,
      tipo: VIBE_LABELS[venue.vibes[0]] ?? venue.vibes[0],
      atmosfera: venue.atmosphere,
      accessibile: Boolean(venue.features.wheelchairAccess),
      mezzi_vicini: Boolean(venue.features.transitNearby),
    },
    quando: {
      giorno: dayLabel(slot.day),
      data: toLocalDate(startsAt),
      ora: toHHMM(slot.startMin),
      inizio: startsAt.toISOString(),
      fine_prevista: endsAt.toISOString(),
      durata_minuti: slot.endMin - slot.startMin,
    },
    tragitto: {
      [a.id]: `circa ${chosen.travelA.minuti} minuti ${chosen.travelA.modo}`,
      [b.id]: `circa ${chosen.travelB.minuti} minuti ${chosen.travelB.modo}`,
    },
    riconoscimento: generateRecognitionCode(
      venue,
      { minutiA: chosen.travelA.minuti, minutiB: chosen.travelB.minuti },
      { idA: a.id, idB: b.id },
      rng,
    ),
    icebreakers,
    promemoria: [
      'Non esiste chat fra voi: quello che c e da dire si dice li.',
      'Se cambia qualcosa, si passa dall app: annullare in tempo non e maleducazione.',
    ],
  };
}

/**
 * Vista della scheda destinata a un singolo utente: mostra solo il proprio
 * tragitto e il proprio segno visivo, piu' quello dell'altro (serve per
 * riconoscerlo) ma nessun dato di partenza.
 * @param {ReturnType<typeof buildEventCard>} card
 * @param {string} userId
 */
export function eventCardFor(card, userId) {
  if (!card.partecipanti.includes(userId)) {
    throw new Error(`Utente ${userId} non fa parte di questo match`);
  }
  const otherId = card.partecipanti.find((id) => id !== userId);
  return {
    ...card,
    tragitto: card.tragitto[userId],
    riconoscimento: {
      ...card.riconoscimento,
      segnoVisivo: {
        il_tuo: card.riconoscimento.segnoVisivo[userId],
        quello_dell_altra_persona: card.riconoscimento.segnoVisivo[otherId],
      },
      arriva_per_primo:
        card.riconoscimento.arrivaPerPrimo === userId ? 'tu' : 'l altra persona',
    },
    partecipanti: undefined,
  };
}
