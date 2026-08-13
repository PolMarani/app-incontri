/**
 * Tassonomia degli interessi e delle vibe.
 *
 * Serve a due cose:
 *  1. capire che "arrampicata" e "trekking" non sono lo stesso interesse ma
 *     nemmeno due mondi separati (match parziale sulla famiglia);
 *  2. capire quali vibe sono adiacenti, cosi' due persone che hanno chiesto
 *     "libreria" e "caffe tranquillo" non vengono scartate per un cavillo.
 */

/** @type {Record<string, string[]>} */
export const INTEREST_FAMILIES = {
  outdoor: [
    'arrampicata', 'trekking', 'escursionismo', 'bici', 'corsa', 'kayak',
    'sci', 'surf', 'campeggio', 'orto',
  ],
  musica: [
    'concerti', 'vinili', 'chitarra', 'pianoforte', 'techno', 'jazz',
    'cantautorato', 'produzione_musicale', 'cori', 'opera',
  ],
  lettura: [
    'libri', 'fantascienza', 'poesia', 'fumetti', 'saggistica', 'true_crime',
    'gialli', 'biblioteche', 'scrittura',
  ],
  schermo: [
    'cinema', 'serie_tv', 'animazione', 'horror', 'documentari', 'cinema_asiatico',
  ],
  cucina: [
    'cucina', 'pasticceria', 'fermentazioni', 'street_food', 'vino',
    'birra_artigianale', 'caffe_specialty', 'te', 'mercati_alimentari',
  ],
  arte: [
    'pittura', 'fotografia', 'ceramica', 'design', 'illustrazione', 'teatro',
    'musei', 'architettura', 'street_art',
  ],
  tech: [
    'programmazione', 'videogiochi', 'elettronica', 'ai', 'retrocomputing',
    'making', 'stampa_3d',
  ],
  giochi: [
    'giochi_da_tavolo', 'gdr', 'scacchi', 'videogiochi', 'enigmistica',
    'escape_room', 'quiz',
  ],
  benessere: [
    'yoga', 'meditazione', 'palestra', 'arti_marziali', 'danza', 'nuoto',
    'running',
  ],
  animali: ['cani', 'gatti', 'birdwatching', 'acquari', 'cavalli'],
  viaggi: ['viaggi', 'backpacking', 'lingue', 'interrail', 'mappe', 'geografia'],
  pensiero: [
    'astronomia', 'divulgazione', 'storia', 'filosofia', 'psicologia',
    'economia', 'archeologia', 'podcast',
  ],
  sociale: [
    'volontariato', 'attivismo', 'sostenibilita', 'politica_locale',
    'mutuo_soccorso', 'quartiere',
  ],
  collezioni: ['piante', 'sneakers', 'modellismo', 'vintage', 'francobolli', 'vinili'],
};

/** Indice inverso tag -> famiglie (un tag puo' stare in più' famiglie). */
const TAG_TO_FAMILIES = (() => {
  /** @type {Map<string, Set<string>>} */
  const index = new Map();
  for (const [family, tags] of Object.entries(INTEREST_FAMILIES)) {
    for (const tag of tags) {
      if (!index.has(tag)) index.set(tag, new Set());
      index.get(tag).add(family);
    }
  }
  return index;
})();

/**
 * Famiglie a cui appartiene un interesse.
 * @param {string} tag
 * @returns {Set<string>}
 */
export function familiesOf(tag) {
  return TAG_TO_FAMILIES.get(tag) ?? new Set();
}

/**
 * Similarita' fra due interessi: 1 se identici, 0.45 se condividono almeno una
 * famiglia, 0 altrimenti. Il valore intermedio e' volutamente sotto la meta':
 * un interesse condiviso davvero vale piu' del doppio di uno "cugino".
 * @param {string} tagA
 * @param {string} tagB
 * @returns {number} 0..1
 */
export function interestSimilarity(tagA, tagB) {
  if (tagA === tagB) return 1;
  const famA = familiesOf(tagA);
  const famB = familiesOf(tagB);
  for (const f of famA) if (famB.has(f)) return 0.45;
  return 0;
}

/** Vibe supportate per l'uscita. */
export const VIBES = [
  'caffe_tranquillo',
  'bar_serale',
  'aperitivo',
  'parco',
  'passeggiata',
  'libreria',
  'museo',
  'mostra',
  'mercato',
  'boardgame_cafe',
  'gelateria',
  'concerto_piccolo',
];

/**
 * Vibe adiacenti: coppie che condividono ritmo, rumore e "impegno" della
 * serata. Il valore e' la compatibilita' residua quando le due preferenze non
 * coincidono.
 * @type {Array<[string, string, number]>}
 */
const VIBE_ADJACENCY = [
  ['caffe_tranquillo', 'libreria', 0.75],
  ['caffe_tranquillo', 'gelateria', 0.6],
  ['caffe_tranquillo', 'passeggiata', 0.55],
  ['caffe_tranquillo', 'museo', 0.5],
  ['bar_serale', 'aperitivo', 0.85],
  ['bar_serale', 'concerto_piccolo', 0.6],
  ['bar_serale', 'boardgame_cafe', 0.5],
  ['aperitivo', 'mercato', 0.45],
  ['aperitivo', 'passeggiata', 0.45],
  ['parco', 'passeggiata', 0.85],
  ['parco', 'mercato', 0.5],
  ['parco', 'gelateria', 0.55],
  ['libreria', 'museo', 0.6],
  ['libreria', 'mostra', 0.6],
  ['museo', 'mostra', 0.9],
  ['mostra', 'mercato', 0.4],
  ['boardgame_cafe', 'gelateria', 0.4],
  ['concerto_piccolo', 'mercato', 0.3],
];

const VIBE_SIMILARITY = (() => {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const [a, b, score] of VIBE_ADJACENCY) {
    map.set(`${a}|${b}`, score);
    map.set(`${b}|${a}`, score);
  }
  return map;
})();

/**
 * @param {string} vibeA
 * @param {string} vibeB
 * @returns {number} 0..1
 */
export function vibeSimilarity(vibeA, vibeB) {
  if (vibeA === vibeB) return 1;
  return VIBE_SIMILARITY.get(`${vibeA}|${vibeB}`) ?? 0;
}

/** Etichette leggibili, usate nella scheda evento e nelle opzioni anonime. */
export const VIBE_LABELS = {
  caffe_tranquillo: 'caffè tranquillo',
  bar_serale: 'bar serale',
  aperitivo: 'aperitivo',
  parco: 'parco',
  passeggiata: 'passeggiata',
  libreria: 'libreria con caffè',
  museo: 'museo',
  mostra: 'mostra',
  mercato: 'mercato coperto',
  boardgame_cafe: 'ludoteca / boardgame cafe',
  gelateria: 'gelateria',
  concerto_piccolo: 'piccolo live',
};

/** Etichette leggibili degli interessi (fallback: il tag con gli underscore sciolti). */
export function interestLabel(tag) {
  const custom = {
    caffe_specialty: 'caffè specialty',
    giochi_da_tavolo: 'giochi da tavolo',
    produzione_musicale: 'produzione musicale',
    true_crime: 'true crime',
    politica_locale: 'politica locale',
    mercati_alimentari: 'mercati alimentari',
    cinema_asiatico: 'cinema asiatico',
    stampa_3d: 'stampa 3D',
    gdr: 'giochi di ruolo',
    ai: 'intelligenza artificiale',
    sostenibilita: 'sostenibilita',
    te: 'te',
  };
  return custom[tag] ?? tag.replace(/_/g, ' ');
}
