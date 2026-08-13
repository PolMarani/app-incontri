/**
 * Profili di esempio, gia' anonimizzati come li riceve il motore.
 * Servono alla demo e ai test: nessun dato reale, nessun nome, solo pseudonimi.
 */

/** @type {Record<string, import('../types.js').Profile>} */
export const SAMPLE_PROFILES = {
  // Zona Isola. Fa il lievito madre, va in falesia nei weekend.
  'u-7f3a': {
    id: 'u-7f3a',
    availability: [
      { day: 'gio', start: '18:30', end: '23:30' },
      { day: 'sab', start: '15:00', end: '23:00' },
    ],
    interests: ['viaggi', 'fermentazioni', 'vinili', 'arrampicata', 'documentari'],
    values: ['sostenibilita', 'curiosita'],
    curiosities: [
      'ho un lievito madre di quattro anni e gli ho dato un nome',
      'so leggere le mappe topografiche meglio del navigatore',
    ],
    vibes: ['caffe_tranquillo', 'libreria', 'bar_serale'],
    origin: { lat: 45.488, lon: 9.188, label: 'Isola' },
    maxTravelKm: 6,
    constraints: { lowNoise: true },
    languages: ['it', 'en'],
  },

  // Zona Porta Venezia. Cucina, fotografa, colleziona biglietti del tram.
  'u-91cd': {
    id: 'u-91cd',
    availability: [
      { day: 'gio', start: '19:00', end: '23:00' },
      { day: 'dom', start: '11:00', end: '18:00' },
    ],
    interests: ['viaggi', 'cucina', 'libri', 'fotografia', 'podcast'],
    values: ['sostenibilita', 'onesta'],
    curiosities: [
      'conservo un biglietto del tram di ogni città in cui sono stato',
      'ho imparato il greco per leggere un solo libro',
    ],
    vibes: ['libreria', 'caffe_tranquillo', 'mostra'],
    origin: { lat: 45.4772, lon: 9.2085, label: 'Porta Venezia' },
    maxTravelKm: 5,
    languages: ['it', 'en', 'el'],
  },

  // Zona Navigli. Serate, concerti, giochi. Vibe lontana dai primi due.
  'u-2b60': {
    id: 'u-2b60',
    availability: [
      { day: 'ven', start: '20:00', end: '02:00' },
      { day: 'sab', start: '19:00', end: '02:00' },
    ],
    interests: ['techno', 'concerti', 'giochi_da_tavolo', 'videogiochi'],
    values: ['spontaneita'],
    curiosities: ['ho suonato in un gruppo che ha fatto un solo concerto, in un garage'],
    vibes: ['bar_serale', 'concerto_piccolo', 'boardgame_cafe'],
    origin: { lat: 45.4507, lon: 9.1742, label: 'Navigli' },
    maxTravelKm: 7,
    languages: ['it'],
  },

  // Zona Bicocca. Compatibile come interessi, ma troppo lontana e con orari
  // che non si incrociano: serve a mostrare i gate della Fase 1.
  'u-4e12': {
    id: 'u-4e12',
    availability: [{ day: 'lun', start: '07:00', end: '09:00' }],
    interests: ['viaggi', 'libri', 'fotografia'],
    values: ['sostenibilita'],
    curiosities: ['mi sveglio alle cinque per scelta'],
    vibes: ['caffe_tranquillo'],
    origin: { lat: 45.5163, lon: 9.2126, label: 'Bicocca' },
    maxTravelKm: 2,
    languages: ['it'],
  },

  // Zona Citta Studi. Astinente e in sedia a rotelle: mette alla prova i
  // vincoli sul locale in Fase 2.
  'u-8d55': {
    id: 'u-8d55',
    availability: [
      { day: 'gio', start: '17:00', end: '21:00' },
      { day: 'dom', start: '10:00', end: '19:00' },
    ],
    interests: ['libri', 'astronomia', 'cucina', 'giochi_da_tavolo'],
    values: ['onesta', 'curiosita'],
    curiosities: ['ho un telescopio che uso tre volte l anno e lo difendo comunque'],
    vibes: ['caffe_tranquillo', 'libreria', 'museo'],
    origin: { lat: 45.4784, lon: 9.2287, label: 'Citta Studi' },
    maxTravelKm: 5,
    constraints: { noAlcohol: true, wheelchairAccess: true },
    languages: ['it'],
  },
};

/** @returns {import('../types.js').Profile} */
export function sampleProfile(id) {
  const profile = SAMPLE_PROFILES[id];
  if (!profile) throw new Error(`Profilo di esempio inesistente: ${id}`);
  return structuredClone(profile);
}
