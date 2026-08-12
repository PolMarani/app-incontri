/**
 * Validazione dei profili in ingresso.
 *
 * Il motore si fidava di tutto quello che gli arrivava: una latitudine
 * scambiata con la longitudine produceva un match a quattromila chilometri, e
 * un orario scritto male esplodeva a meta' della Fase 1 con un messaggio
 * incomprensibile. Qui i problemi vengono trovati al confine, dove si possono
 * ancora spiegare.
 *
 * ── Il buco piu' serio: i campi liberi ────────────────────────────────────
 *
 * Le curiosita' dichiarate nel profilo finiscono **testuali** nelle carte che
 * legge l'altra persona (Fase 3). Tutto il lavoro sull'anonimato - niente nomi,
 * niente foto, riconoscimento senza descrizioni fisiche - viene annullato da
 * una curiosita' che contiene un numero di telefono, un indirizzo o un handle
 * social. Non serve nemmeno malafede: basta scrivere "mi trovi su instagram
 * come ..." pensando sia simpatico.
 *
 * Quindi i campi liberi vengono controllati qui, e la Fase 3 li ricontrolla
 * prima di stamparli su una carta: due volte, perche' un errore su questo non
 * si recupera piu'.
 */

import { DAYS, normalizeWindow } from './util/time.js';
import { VIBES, familiesOf } from './data/taxonomy.js';

/** Lunghezza massima di un campo libero: oltre, non e' piu' una curiosita'. */
const MAX_TESTO_LIBERO = 240;

/**
 * Segnali di un contatto nascosto in un campo libero.
 * Volutamente larghi: un falso positivo costa una riscrittura, un falso
 * negativo costa l'anonimato di una persona.
 */
const SEGNALI_DI_CONTATTO = [
  { nome: 'numero di telefono', re: /(?:\+?\d[\s.\-]?){8,}/ },
  { nome: 'indirizzo email', re: /[\w.+-]+@[\w-]+\.[a-z]{2,}/i },
  { nome: 'indirizzo web', re: /(https?:\/\/|www\.)\S+/i },
  { nome: 'handle social', re: /(?:^|\s)@[a-z0-9._]{3,}/i },
  { nome: 'social nominato', re: /\b(instagram|telegram|whatsapp|tiktok|snapchat|facebook)\b/i },
];

/**
 * Il testo contiene qualcosa che permette di contattare o identificare?
 * @param {string} testo
 * @returns {{ pulito: boolean, motivo: string|null }}
 */
export function contieneContatti(testo) {
  if (typeof testo !== 'string') return { pulito: false, motivo: 'non e testo' };
  for (const segnale of SEGNALI_DI_CONTATTO) {
    if (segnale.re.test(testo)) return { pulito: false, motivo: segnale.nome };
  }
  return { pulito: true, motivo: null };
}

/**
 * Valida un profilo.
 *
 * Distingue errori (il profilo non e' utilizzabile) da avvisi (funziona, ma
 * qualcosa non torna e conviene dirlo a chi lo ha scritto).
 *
 * @param {import('./types.js').Profile} profilo
 * @returns {{ valido: boolean, errori: string[], avvisi: string[] }}
 */
export function validateProfile(profilo) {
  const errori = [];
  const avvisi = [];

  if (!profilo || typeof profilo !== 'object') {
    return { valido: false, errori: ['profilo assente o non e un oggetto'], avvisi };
  }
  if (typeof profilo.id !== 'string' || profilo.id.trim() === '') {
    errori.push('id mancante');
  }

  // --- Disponibilita' -------------------------------------------------------
  if (!Array.isArray(profilo.availability) || profilo.availability.length === 0) {
    errori.push('nessuna disponibilita dichiarata');
  } else {
    for (const finestra of profilo.availability) {
      try {
        const { startMin, endMin } = normalizeWindow(finestra);
        if (endMin - startMin < 60) {
          avvisi.push(
            `finestra molto corta (${finestra.day} ${finestra.start}-${finestra.end}): ` +
              'sotto i 90 minuti non produrra mai un incontro',
          );
        }
      } catch (errore) {
        errori.push(`disponibilita non valida: ${errore.message}`);
      }
    }
  }

  // --- Vibe -----------------------------------------------------------------
  if (!Array.isArray(profilo.vibes) || profilo.vibes.length === 0) {
    errori.push('nessuna vibe dichiarata: senza, il match e sempre bloccato');
  } else {
    for (const vibe of profilo.vibes) {
      if (!VIBES.includes(vibe)) errori.push(`vibe sconosciuta: "${vibe}"`);
    }
  }

  // --- Posizione ------------------------------------------------------------
  const origine = profilo.origin;
  if (!origine || typeof origine.lat !== 'number' || typeof origine.lon !== 'number') {
    errori.push('zona di partenza mancante o incompleta');
  } else {
    if (origine.lat < -90 || origine.lat > 90) errori.push(`latitudine fuori range: ${origine.lat}`);
    if (origine.lon < -180 || origine.lon > 180) errori.push(`longitudine fuori range: ${origine.lon}`);
    if (origine.lat === 0 && origine.lon === 0) {
      errori.push('coordinate (0, 0): quasi sempre significa posizione non impostata');
    }
    // Alle latitudini europee lat > lon quasi sempre: se sono invertite lo si
    // vede, ed e' l'errore piu' comune di chi integra una mappa.
    if (Math.abs(origine.lat) < 20 && Math.abs(origine.lon) > 35) {
      avvisi.push('latitudine e longitudine sembrano invertite');
    }
  }

  const raggio = profilo.maxTravelKm;
  if (raggio !== undefined) {
    if (typeof raggio !== 'number' || raggio <= 0) {
      errori.push('maxTravelKm deve essere un numero positivo');
    } else if (raggio < 0.5) {
      avvisi.push(`raggio di ${raggio} km: quasi nessun locale sara raggiungibile`);
    } else if (raggio > 30) {
      avvisi.push(`raggio di ${raggio} km: gli incontri proposti saranno scomodi`);
    }
  }

  // --- Interessi e valori ---------------------------------------------------
  for (const campo of ['interests', 'values', 'curiosities', 'dealbreakers', 'incontriPrecedenti']) {
    if (profilo[campo] !== undefined && !Array.isArray(profilo[campo])) {
      errori.push(`${campo} deve essere una lista`);
    }
  }
  if (Array.isArray(profilo.interests)) {
    if (profilo.interests.length === 0) {
      avvisi.push('nessun interesse: le carte saranno tutte generiche');
    }
    for (const tag of profilo.interests) {
      if (familiesOf(tag).size === 0) {
        avvisi.push(`interesse fuori tassonomia: "${tag}" (non fara mai match parziale)`);
      }
    }
  }

  // --- Campi liberi ---------------------------------------------------------
  // Sono l'unico testo scritto dall'utente che finisce sotto gli occhi
  // dell'altra persona: qui l'anonimato si vince o si perde.
  for (const [indice, curiosita] of (profilo.curiosities ?? []).entries()) {
    if (typeof curiosita !== 'string') {
      errori.push(`curiosita ${indice + 1}: deve essere testo`);
      continue;
    }
    if (curiosita.length > MAX_TESTO_LIBERO) {
      errori.push(
        `curiosita ${indice + 1}: ${curiosita.length} caratteri, il massimo e ${MAX_TESTO_LIBERO}`,
      );
    }
    const { pulito, motivo } = contieneContatti(curiosita);
    if (!pulito) {
      errori.push(
        `curiosita ${indice + 1}: sembra contenere un ${motivo}. I campi liberi ` +
          'vengono letti dall altra persona prima di incontrarti.',
      );
    }
  }

  // --- Vincoli --------------------------------------------------------------
  const vincoliNoti = ['noAlcohol', 'wheelchairAccess', 'lowNoise', 'outdoorOnly'];
  for (const chiave of Object.keys(profilo.constraints ?? {})) {
    if (!vincoliNoti.includes(chiave)) avvisi.push(`vincolo sconosciuto, ignorato: "${chiave}"`);
  }

  return { valido: errori.length === 0, errori, avvisi };
}

/**
 * Valida un intero lotto, per il ciclo di abbinamento.
 * @param {import('./types.js').Profile[]} profili
 */
export function validateBatch(profili) {
  const validi = [];
  const scartati = [];
  for (const profilo of profili) {
    const esito = validateProfile(profilo);
    if (esito.valido) validi.push(profilo);
    else scartati.push({ id: profilo?.id ?? '(senza id)', errori: esito.errori });
  }
  return { validi, scartati, giorniNoti: DAYS };
}
