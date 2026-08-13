/**
 * Catalogo dei luoghi di ritrovo.
 *
 * Ogni voce e' un posto pubblico verificato dallo staff: niente indirizzi
 * privati, niente locali senza personale, niente vicoli. In produzione questo
 * modulo diventa una query su un database con lo stesso schema; qui e' un seed
 * su Milano che basta a far girare il motore e i test.
 *
 * `safetyScore` e' assegnato in fase di verifica e pesa su tutta la Fase 2:
 * sotto 0.6 il locale non viene mai proposto.
 */

import { DAYS } from '../util/time.js';

/**
 * Orari uguali per un insieme di giorni.
 * @param {string[]} days
 * @param {string} start
 * @param {string} end
 * @returns {import('../util/time.js').AvailabilityWindow[]}
 */
function hours(days, start, end) {
  return days.map((day) => ({ day, start, end }));
}

const EVERY_DAY = DAYS;
const WEEKDAYS = ['lun', 'mar', 'mer', 'gio', 'ven'];
const WEEKEND = ['sab', 'dom'];

/** @type {import('../types.js').Venue[]} */
export const VENUES = [
  {
    id: 'v-brera-caffe',
    name: 'Caffe delle Rane',
    address: 'Via Fiori Chiari 12, Milano',
    location: { lat: 45.4723, lon: 9.1873 },
    vibes: ['caffe_tranquillo', 'aperitivo'],
    openingHours: hours(EVERY_DAY, '07:30', '21:00'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: true, wheelchairAccess: true, outdoor: true, noiseLevel: 'basso',
    },
    safetyScore: 0.93,
    atmosphere: 'tavolini piccoli, luce calda, si sente parlare senza alzare la voce',
    recognitionSpots: ['il tavolo vicino alla finestra', 'la panca sotto lo specchio'],
  },
  {
    id: 'v-isola-libreria',
    name: 'Libreria Controvento',
    address: 'Via Pastrengo 8, Milano',
    location: { lat: 45.4881, lon: 9.1876 },
    vibes: ['libreria', 'caffe_tranquillo'],
    openingHours: hours(EVERY_DAY, '09:00', '22:00'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: false, noiseLevel: 'basso',
    },
    safetyScore: 0.95,
    atmosphere: 'scaffali fino al soffitto e sei tavolini in fondo, sempre gente ma mai caos',
    recognitionSpots: ['lo scaffale della narrativa straniera', 'il tavolo tondo in fondo a destra'],
  },
  {
    id: 'v-sempione-parco',
    name: 'Parco Sempione - chiosco dell\'Arena',
    address: 'Viale Giorgio Byron, Milano',
    location: { lat: 45.4749, lon: 9.1739 },
    vibes: ['parco', 'passeggiata'],
    openingHours: hours(EVERY_DAY, '08:00', '20:30'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: true, noiseLevel: 'basso',
    },
    safetyScore: 0.82,
    atmosphere: 'prato aperto, chiosco con tavoli, passaggio costante di gente fino al tramonto',
    recognitionSpots: ['la terza panchina sul viale principale', 'il chiosco lato Arena'],
  },
  {
    id: 'v-navigli-bar',
    name: 'Bar Ripa 47',
    address: 'Ripa di Porta Ticinese 47, Milano',
    location: { lat: 45.4507, lon: 9.1742 },
    vibes: ['bar_serale', 'aperitivo'],
    openingHours: hours(EVERY_DAY, '17:00', '01:00'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: true, wheelchairAccess: false, outdoor: true, noiseLevel: 'alto',
    },
    safetyScore: 0.78,
    atmosphere: 'bancone lungo sul naviglio, musica di sottofondo, pieno dalle otto in poi',
    recognitionSpots: ['il fondo del bancone', 'i tavolini sotto il portico'],
  },
  {
    id: 'v-portavenezia-cafe',
    name: 'Torrefazione Malachite',
    address: 'Via Melzo 22, Milano',
    location: { lat: 45.4772, lon: 9.2085 },
    vibes: ['caffe_tranquillo', 'libreria'],
    openingHours: [...hours(WEEKDAYS, '07:00', '19:00'), ...hours(WEEKEND, '08:30', '19:30')],
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: true, noiseLevel: 'basso',
    },
    safetyScore: 0.94,
    atmosphere: 'odore di tostatura, banconi di legno, gente che legge da sola senza sentirsi strana',
    recognitionSpots: ['il tavolo lungo condiviso', 'le due poltrone accanto alla vetrina'],
  },
  {
    id: 'v-nolo-ludoteca',
    name: 'Ludoteca Meeple & Co.',
    address: 'Via Venini 40, Milano',
    location: { lat: 45.4931, lon: 9.2178 },
    vibes: ['boardgame_cafe', 'caffe_tranquillo'],
    openingHours: [...hours(WEEKDAYS, '16:00', '23:30'), ...hours(WEEKEND, '11:00', '23:30')],
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: true, wheelchairAccess: true, outdoor: false, noiseLevel: 'medio',
    },
    safetyScore: 0.9,
    atmosphere: 'tavoli grandi, scatole ovunque, lo staff spiega le regole se glielo chiedi',
    recognitionSpots: ['il tavolo 4', 'la parete dei giochi cooperativi'],
  },
  {
    id: 'v-ticinese-gelato',
    name: 'Gelateria della Darsena',
    address: 'Viale Gorizia 30, Milano',
    location: { lat: 45.4523, lon: 9.1780 },
    vibes: ['gelateria', 'passeggiata'],
    openingHours: hours(EVERY_DAY, '12:00', '23:30'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: true, noiseLevel: 'medio',
    },
    safetyScore: 0.88,
    atmosphere: 'coda breve, panchine sull\'acqua a due passi, si cammina mangiando',
    recognitionSpots: ['la panchina di fronte alla vetrina', 'il ponte pedonale'],
  },
  {
    id: 'v-cittastudi-caffe',
    name: 'Caffe Politecnico',
    address: 'Via Bonardi 5, Milano',
    location: { lat: 45.4784, lon: 9.2287 },
    vibes: ['caffe_tranquillo', 'libreria'],
    openingHours: [...hours(WEEKDAYS, '07:30', '20:00'), ...hours(['sab'], '09:00', '18:00')],
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: true, noiseLevel: 'medio',
    },
    safetyScore: 0.91,
    atmosphere: 'grande, luminoso, sempre qualcuno che studia, nessuno ti guarda',
    recognitionSpots: ['i tavoli sotto il pergolato', 'il bancone lato ingresso'],
  },
  {
    id: 'v-lambrate-mostra',
    name: 'Spazio Ventura - sala mostre',
    address: 'Via Ventura 5, Milano',
    location: { lat: 45.4846, lon: 9.2402 },
    vibes: ['mostra', 'museo'],
    openingHours: hours(['mar', 'mer', 'gio', 'ven', 'sab', 'dom'], '10:00', '19:00'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: false, noiseLevel: 'basso',
    },
    safetyScore: 0.92,
    atmosphere: 'capannone riconvertito, sale ampie, si cammina piano e si commenta a mezza voce',
    recognitionSpots: ['la biglietteria', 'la panca centrale della sala 2'],
  },
  {
    id: 'v-portaromana-mercato',
    name: 'Mercato Comunale di Porta Romana',
    address: 'Piazza Ferrara 1, Milano',
    location: { lat: 45.4459, lon: 9.2038 },
    vibes: ['mercato', 'aperitivo'],
    openingHours: [...hours(WEEKDAYS, '08:00', '22:00'), ...hours(['sab'], '08:00', '23:00')],
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: true, wheelchairAccess: true, outdoor: false, noiseLevel: 'medio',
    },
    safetyScore: 0.86,
    atmosphere: 'banchi di cibo intorno a tavoloni comuni, chiacchiericcio costante',
    recognitionSpots: ['il tavolone centrale', 'il banco del pesce fritto'],
  },
  {
    id: 'v-wagner-parco',
    name: 'Parco Solari - area chiosco',
    address: 'Via Montevideo 11, Milano',
    location: { lat: 45.4585, lon: 9.1585 },
    vibes: ['parco', 'passeggiata'],
    openingHours: hours(EVERY_DAY, '07:00', '21:00'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: true, noiseLevel: 'basso',
    },
    safetyScore: 0.84,
    atmosphere: 'piste da corsa, cani, famiglie, un chiosco con quattro tavolini',
    recognitionSpots: ['il chiosco', 'la fontanella all\'ingresso di via Montevideo'],
  },
  {
    id: 'v-loreto-live',
    name: 'Circolo Radiofonica',
    address: 'Via Padova 21, Milano',
    location: { lat: 45.4903, lon: 9.2214 },
    vibes: ['concerto_piccolo', 'bar_serale'],
    openingHours: hours(['mer', 'gio', 'ven', 'sab'], '19:00', '02:00'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: true, wheelchairAccess: true, outdoor: false, noiseLevel: 'alto',
    },
    safetyScore: 0.8,
    atmosphere: 'sala concerti piccola con un bar davanti, si parla nell\'intervallo',
    recognitionSpots: ['il bar prima della sala', 'il guardaroba'],
  },
  {
    id: 'v-duomo-museo',
    name: 'Museo del Novecento - caffetteria',
    address: 'Piazza Duomo 8, Milano',
    location: { lat: 45.4632, lon: 9.1899 },
    vibes: ['museo', 'mostra', 'caffe_tranquillo'],
    openingHours: hours(['mar', 'mer', 'gio', 'ven', 'sab', 'dom'], '10:00', '19:30'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: false, wheelchairAccess: true, outdoor: false, noiseLevel: 'basso',
    },
    safetyScore: 0.96,
    atmosphere: 'vetrate sulla piazza, poltrone basse, silenzio da museo anche al bar',
    recognitionSpots: ['il tavolino d\'angolo con vista sulla piazza', 'la scala elicoidale'],
  },
  {
    id: 'v-bicocca-bar',
    name: 'Bar Bicocca Village',
    address: 'Viale Sarca 336, Milano',
    location: { lat: 45.5163, lon: 9.2126 },
    vibes: ['bar_serale', 'aperitivo'],
    openingHours: hours(EVERY_DAY, '17:30', '00:30'),
    features: {
      publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
      servesAlcohol: true, wheelchairAccess: true, outdoor: true, noiseLevel: 'medio',
    },
    safetyScore: 0.85,
    atmosphere: 'piazzetta pedonale con dehors, cinema accanto, sempre luce e passaggio',
    recognitionSpots: ['i tavoli del dehors lato cinema', 'la fontana'],
  },
];

/**
 * Punto d accesso unico al catalogo, cosi' il resto del motore non dipende
 * dalla sorgente dei dati.
 * @returns {import('../types.js').Venue[]}
 */
export function loadVenues() {
  return VENUES;
}
