/**
 * Utility su disponibilita' e fasce orarie.
 *
 * Le disponibilita' sono espresse come finestre settimanali ricorrenti:
 *   { day: 'gio', start: '19:00', end: '23:00' }
 * Il motore le interseca e poi ancora la prima finestra utile a una data reale.
 *
 * Le finestre che scavalcano la mezzanotte ("ven 20:00-02:00") sono normali in
 * un'app di uscite serali e vengono tenute come un unico blocco appartenente
 * alla sera di partenza: l'orario di fine diventa semplicemente maggiore di
 * 1440 minuti (02:00 -> 1560). E' il modo in cui le pensa chi le scrive
 * ("venerdi sera fino alle due"), e l'intersezione continua a funzionare senza
 * casi speciali.
 */

export const DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];

/** Indice ISO (1 = lunedi') -> indice del nostro array DAYS. */
const JS_DAY_TO_INDEX = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

/**
 * @typedef {{ day: string, start: string, end: string }} AvailabilityWindow
 * @typedef {{ day: string, startMin: number, endMin: number }} MinuteWindow
 */

/**
 * "19:30" -> 1170 (minuti da mezzanotte).
 * @param {string} hhmm
 * @returns {number}
 */
export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`Orario non valido: ${hhmm}`);
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Orario fuori range: ${hhmm}`);
  return hours * 60 + minutes;
}

/**
 * 1170 -> "19:30". Gli orari oltre la mezzanotte rientrano: 1560 -> "02:00".
 * @param {number} min
 * @returns {string}
 */
export function toHHMM(min) {
  const wrapped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Normalizza una finestra in minuti. Un orario di fine minore o uguale a
 * quello di inizio significa "il giorno dopo": 20:00-02:00 diventa 1200-1560.
 * @param {AvailabilityWindow} w
 * @returns {MinuteWindow}
 */
export function normalizeWindow(w) {
  if (!DAYS.includes(w.day)) throw new Error(`Giorno non valido: ${w.day}`);
  const startMin = toMinutes(w.start);
  let endMin = toMinutes(w.end);
  if (endMin <= startMin) endMin += 1440;
  if (endMin - startMin > 20 * 60) {
    throw new Error(
      `Finestra troppo lunga per essere reale (${w.day} ${w.start}-${w.end})`,
    );
  }
  return { day: w.day, startMin, endMin };
}

/**
 * Interseca due insiemi di disponibilita' e restituisce solo le finestre comuni
 * lunghe almeno `minDurationMin`. Un caffe' da mezz'ora non e' un incontro:
 * la soglia di default e' 90 minuti.
 * @param {AvailabilityWindow[]} a
 * @param {AvailabilityWindow[]} b
 * @param {number} [minDurationMin]
 * @returns {MinuteWindow[]} ordinate per giorno e poi per ora di inizio
 */
export function overlappingWindows(a, b, minDurationMin = 90) {
  const out = [];
  for (const rawA of a) {
    const wa = normalizeWindow(rawA);
    for (const rawB of b) {
      const wb = normalizeWindow(rawB);
      if (wa.day !== wb.day) continue;
      const startMin = Math.max(wa.startMin, wb.startMin);
      const endMin = Math.min(wa.endMin, wb.endMin);
      if (endMin - startMin >= minDurationMin) {
        out.push({ day: wa.day, startMin, endMin });
      }
    }
  }
  return out.sort(
    (x, y) => DAYS.indexOf(x.day) - DAYS.indexOf(y.day) || x.startMin - y.startMin,
  );
}

/**
 * Minuti totali di sovrapposizione, usati per il punteggio di Fase 1.
 * @param {MinuteWindow[]} windows
 * @returns {number}
 */
export function totalOverlapMinutes(windows) {
  return windows.reduce((sum, w) => sum + (w.endMin - w.startMin), 0);
}

/**
 * Prima occorrenza futura di un giorno della settimana, a partire da `from`.
 * @param {Date} from
 * @param {string} day uno di DAYS
 * @param {number} startMin minuti da mezzanotte
 * @returns {Date}
 */
export function nextOccurrence(from, day, startMin) {
  const targetIndex = DAYS.indexOf(day);
  if (targetIndex === -1) throw new Error(`Giorno non valido: ${day}`);

  const date = new Date(from);
  const currentIndex = JS_DAY_TO_INDEX[date.getDay()];
  let deltaDays = (targetIndex - currentIndex + 7) % 7;

  date.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  // Se e' oggi ma l'orario e' gia' passato, si va alla settimana successiva.
  if (deltaDays === 0 && date.getTime() <= from.getTime()) deltaDays = 7;
  date.setDate(date.getDate() + deltaDays);
  return date;
}

/**
 * Data in forma AAAA-MM-GG nel fuso locale.
 *
 * `toISOString().slice(0, 10)` sembra equivalente e non lo e': lavora in UTC.
 * Un incontro che comincia sabato alle 00:30 a Milano e' venerdi' alle 22:30
 * in UTC, quindi la scheda direbbe "Sabato 14 agosto" con il 14 che e'
 * venerdi'. Le fasce che scavalcano la mezzanotte rendono il caso reale, non
 * teorico.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalDate(date) {
  const mese = String(date.getMonth() + 1).padStart(2, '0');
  const giorno = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mese}-${giorno}`;
}

/**
 * Nome esteso del giorno, per la scheda dell'evento.
 * @param {string} day
 * @returns {string}
 */
export function dayLabel(day) {
  return {
    lun: 'Lunedi',
    mar: 'Martedi',
    mer: 'Mercoledi',
    gio: 'Giovedi',
    ven: 'Venerdi',
    sab: 'Sabato',
    dom: 'Domenica',
  }[day] ?? day;
}
