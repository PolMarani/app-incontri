/**
 * Utility geografiche.
 *
 * Nota privacy: queste funzioni lavorano sulle coordinate di partenza reali,
 * che restano SEMPRE lato motore. Nulla di quanto calcolato qui viene
 * mostrato a un utente se rivela la posizione dell'altro (vedi phase2).
 */

const EARTH_RADIUS_KM = 6371;
const KM_PER_WALKING_MINUTE = 0.075; // ~4.5 km/h in citta', con semafori

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * @typedef {{ lat: number, lon: number, label?: string }} GeoPoint
 */

/**
 * Distanza in linea d'aria fra due punti (formula dell'emisenoverso).
 * @param {GeoPoint} a
 * @param {GeoPoint} b
 * @returns {number} km
 */
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Punto medio geografico (sulla sfera, non media aritmetica: alle nostre
 * latitudini la differenza e' minima ma la media aritmetica sbaglia in modo
 * sistematico sui meridiani).
 * @param {GeoPoint} a
 * @param {GeoPoint} b
 * @returns {GeoPoint}
 */
export function midpoint(a, b) {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);

  const bx = Math.cos(lat2) * Math.cos(dLon);
  const by = Math.cos(lat2) * Math.sin(dLon);
  const lat3 = Math.atan2(
    Math.sin(lat1) + Math.sin(lat2),
    Math.sqrt((Math.cos(lat1) + bx) ** 2 + by ** 2),
  );
  const lon3 = lon1 + Math.atan2(by, Math.cos(lat1) + bx);

  return { lat: toDeg(lat3), lon: ((toDeg(lon3) + 540) % 360) - 180 };
}

/**
 * Minuti a piedi stimati per una distanza in linea d'aria. Il fattore 1.3
 * approssima il rapporto fra percorso stradale e linea d'aria in citta'.
 * @param {number} km
 * @returns {number} minuti, arrotondati
 */
export function walkingMinutes(km) {
  return Math.round((km * 1.3) / KM_PER_WALKING_MINUTE);
}

/**
 * Stima del tragitto reale. Sopra il chilometro e mezzo nessuno va a piedi in
 * citta': dare "42 minuti a piedi" come unica informazione fa sembrare
 * irraggiungibile un posto che con il tram e' a un quarto d'ora, e spinge a
 * rifiutare opzioni buone.
 * @param {number} km
 * @param {{ transitNearby?: boolean }} [options]
 * @returns {{ minuti: number, modo: string }}
 */
export function travelEstimate(km, options = {}) {
  const transitNearby = options.transitNearby ?? true;
  const walk = walkingMinutes(km);
  if (!transitNearby) return { minuti: walk, modo: 'a piedi' };
  // 8 minuti fra attesa e percorso a piedi agli estremi, poi ~21 km/h medi.
  const transit = Math.round(8 + (km * 1.25) / 0.35);
  return transit < walk ? { minuti: transit, modo: 'con i mezzi' } : { minuti: walk, modo: 'a piedi' };
}

/**
 * Le due disponibilita' di spostamento si sovrappongono? Se le aree
 * raggiungibili non si intersecano non esiste nessun punto d'incontro equo e
 * il match va scartato in Fase 1.
 * @param {GeoPoint} a
 * @param {GeoPoint} b
 * @param {number} maxTravelKmA
 * @param {number} maxTravelKmB
 * @returns {boolean}
 */
export function travelZonesOverlap(a, b, maxTravelKmA, maxTravelKmB) {
  return distanceKm(a, b) <= maxTravelKmA + maxTravelKmB;
}

/**
 * Quanto e' equa una location: 1 quando i due percorsi sono identici, 0 quando
 * uno dei due fa tutta la strada. Serve a evitare il classico "ci vediamo
 * sotto casa mia".
 * @param {number} kmA distanza dell'utente A dalla location
 * @param {number} kmB distanza dell'utente B dalla location
 * @returns {number} 0..1
 */
export function fairnessScore(kmA, kmB) {
  const total = kmA + kmB;
  if (total === 0) return 1;
  return 1 - Math.abs(kmA - kmB) / total;
}
