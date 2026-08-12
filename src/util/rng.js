/**
 * RNG deterministico.
 *
 * Ogni scelta "casuale" del motore (codici di riconoscimento, pescata delle
 * carte icebreaker) deve essere riproducibile: lo stesso match deve produrre
 * la stessa scheda su ogni device dei due utenti, senza che i due client
 * debbano sincronizzarsi. Il seed e' derivato dall'id del match.
 */

/**
 * Hash a 32 bit di una stringa (FNV-1a). Usato per derivare il seed dal matchId.
 * @param {string} str
 * @returns {number} intero senza segno a 32 bit
 */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Generatore mulberry32: piccolo, veloce, con distribuzione sufficiente per
 * scegliere carte e codici.
 * @param {string|number} seed
 * @returns {() => number} funzione che ritorna un float in [0, 1)
 */
export function createRng(seed) {
  let state = (typeof seed === 'number' ? seed : hashString(String(seed))) >>> 0;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // Lo stato e' leggibile e ripristinabile: una serata in corso deve poter
  // sopravvivere al riavvio del processo, e senza questo il generatore sarebbe
  // l'unico pezzo di stato impossibile da salvare.
  Object.defineProperty(next, 'state', {
    get: () => state,
    set: (valore) => {
      state = valore >>> 0;
    },
  });
  return next;
}

/**
 * Ricrea un generatore da uno stato salvato.
 * @param {number} state
 * @returns {() => number}
 */
export function restoreRng(state) {
  const rng = createRng(0);
  rng.state = state;
  return rng;
}

/**
 * Estrae un elemento da un array.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T}
 */
export function pick(rng, items) {
  if (items.length === 0) throw new Error('pick() su array vuoto');
  return items[Math.floor(rng() * items.length)];
}

/**
 * Copia mescolata (Fisher-Yates). Non muta l'array di input.
 * @template T
 * @param {() => number} rng
 * @param {readonly T[]} items
 * @returns {T[]}
 */
export function shuffle(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
