/**
 * Il ciclo di abbinamento: da una lista di profili a una lista di coppie.
 *
 * `rankCandidates` risponde alla domanda "chi va bene per questa persona", ed
 * e' la domanda sbagliata quando si abbina un'intera citta' nello stesso
 * momento: se il migliore di A e' B, e il migliore di C e' ancora B, un
 * matcher per-utente assegna B due volte. In un'app dove l'unico esito e'
 * uscire di casa, quello e' letteralmente il sistema che organizza un buco -
 * e la persona che lo subisce non ha modo di distinguerlo da un no-show.
 *
 * Qui l'abbinamento e' globale: ogni persona compare in una coppia sola.
 *
 * ── Perche' bastano gli avidi ─────────────────────────────────────────────
 *
 * Si prendono tutte le coppie ammissibili, si ordinano per punteggio
 * decrescente e si accettano quelle in cui nessuno dei due e' gia' impegnato.
 * Sembra una scorciatoia, e invece su punteggi **simmetrici** produce un
 * abbinamento *stabile*, cioe' senza coppie bloccanti:
 *
 *   Sia (x, y) una coppia non formata in cui entrambi preferirebbero l'altro
 *   al proprio partner. L'algoritmo ha esaminato (x, y) a un certo punto e
 *   l'ha scartata solo perche' uno dei due - diciamo x - era gia' impegnato
 *   con z. Ma z era stato preso prima, quindi w(x, z) >= w(x, y): x non
 *   preferisce y. Contraddizione, quindi coppie bloccanti non ne esistono.
 *
 * Il punteggio della Fase 1 e' simmetrico per costruzione (c'e' un test che lo
 * verifica), quindi l'ipotesi regge. `coppieBloccanti()` lo ricontrolla sui
 * dati veri: se un giorno il punteggio smettesse di essere simmetrico, quella
 * funzione se ne accorgerebbe invece di lasciar passare abbinamenti peggiori
 * in silenzio.
 */

import {
  DEFAULT_THRESHOLD,
  evaluateMatch,
  sogliaAdattiva,
} from './phase1-compatibility.js';
import { prioritaDiRecupero } from './reputation.js';

/**
 * Tutte le coppie ammissibili con il loro punteggio.
 * @param {import('./types.js').Profile[]} profili
 * @param {object} [options]
 */
function tutteLeCoppie(profili, options = {}) {
  const coppie = [];
  for (let i = 0; i < profili.length; i++) {
    for (let j = i + 1; j < profili.length; j++) {
      const a = profili[i];
      const b = profili[j];
      const evaluation = evaluateMatch(a, b, options);
      if (!evaluation.eligible) continue;
      // La spinta di recupero e' il massimo delle due, non la somma: cosi'
      // resta simmetrica e non rompe la stabilita' dimostrata sopra.
      const spinta = Math.max(
        prioritaDiRecupero(a.storico),
        prioritaDiRecupero(b.storico),
      );
      coppie.push({
        a,
        b,
        score: evaluation.score,
        // Il punteggio usato per ordinare tiene conto di chi ha subito un buco
        // e merita di passare avanti.
        peso: evaluation.score * spinta,
        spinta,
        evaluation,
      });
    }
  }
  return coppie;
}

/**
 * Esegue un ciclo di abbinamento su un insieme di profili.
 *
 * @param {import('./types.js').Profile[]} profili
 * @param {{
 *   threshold?: number,
 *   adattiva?: boolean,
 *   obiettivo?: number,
 *   sogliaMinima?: number,
 * }} [options]
 * @returns {{
 *   coppie: any[],
 *   nonAbbinati: Array<{ id: string, motivo: string }>,
 *   soglia: number,
 *   adattamento: object|null,
 *   statistiche: object,
 * }}
 */
export function runMatchingRound(profili, options = {}) {
  const idsUnici = new Set(profili.map((p) => p.id));
  if (idsUnici.size !== profili.length) {
    throw new Error('Due profili hanno lo stesso id: il ciclo non puo procedere');
  }

  const ammissibili = tutteLeCoppie(profili, options);

  // --- Soglia ---------------------------------------------------------------
  let soglia = options.threshold ?? DEFAULT_THRESHOLD;
  let adattamento = null;
  if (options.adattiva) {
    // La soglia si adatta alla densita' dell'intero ciclo, non a quella vista
    // dal singolo utente: e' la stessa citta' per tutti.
    adattamento = sogliaAdattiva(ammissibili.map((c) => c.score), {
      ideale: soglia,
      obiettivo: options.obiettivo ?? Math.max(1, Math.floor(profili.length / 4)),
      minima: options.sogliaMinima,
    });
    soglia = adattamento.soglia;
  }

  const candidate = ammissibili
    .filter((c) => c.score >= soglia)
    .sort(
      (x, y) =>
        y.peso - x.peso ||
        y.score - x.score ||
        // Ordine finale deterministico: due cicli sugli stessi dati devono
        // produrre le stesse coppie, altrimenti non sono riproducibili.
        `${x.a.id}${x.b.id}`.localeCompare(`${y.a.id}${y.b.id}`),
    );

  // --- Assegnazione avida ---------------------------------------------------
  const impegnati = new Set();
  const coppie = [];
  for (const candidata of candidate) {
    if (impegnati.has(candidata.a.id) || impegnati.has(candidata.b.id)) continue;
    impegnati.add(candidata.a.id);
    impegnati.add(candidata.b.id);
    coppie.push({
      partecipanti: [candidata.a.id, candidata.b.id],
      a: candidata.a,
      b: candidata.b,
      score: candidata.score,
      spinta: Math.round(candidata.spinta * 100) / 100,
      evaluation: candidata.evaluation,
    });
  }

  // --- Chi resta fuori, e perche' -------------------------------------------
  // La distinzione conta: "non c'era nessuno per te" e "c'era, ma ha trovato di
  // meglio" sono due esperienze diverse, e la seconda non va raccontata come la
  // prima. Chi resta fuori per congestione ha la precedenza al ciclo dopo.
  const nonAbbinati = profili
    .filter((p) => !impegnati.has(p.id))
    .map((p) => {
      const compatibili = ammissibili.filter(
        (c) => (c.a.id === p.id || c.b.id === p.id) && c.score >= soglia,
      );
      if (compatibili.length === 0) {
        const soloBassi = ammissibili.some((c) => c.a.id === p.id || c.b.id === p.id);
        return {
          id: p.id,
          motivo: soloBassi ? 'nessun abbinamento sopra soglia' : 'nessun profilo compatibile',
          precedenzaProssimoCiclo: false,
        };
      }
      return {
        id: p.id,
        motivo: 'tutti i profili compatibili erano gia impegnati',
        compatibiliOccupati: compatibili.length,
        precedenzaProssimoCiclo: true,
      };
    });

  const punteggi = coppie.map((c) => c.score);
  return {
    coppie,
    nonAbbinati,
    soglia,
    adattamento,
    statistiche: {
      profili: profili.length,
      coppieAmmissibili: ammissibili.length,
      coppieFormate: coppie.length,
      copertura: profili.length ? (coppie.length * 2) / profili.length : 0,
      punteggioMedio: punteggi.length
        ? Math.round((punteggi.reduce((s, x) => s + x, 0) / punteggi.length) * 10) / 10
        : null,
      punteggioMinimo: punteggi.length ? Math.min(...punteggi) : null,
    },
  };
}

/**
 * Coppie bloccanti: due persone che, guardando l'abbinamento uscito, starebbero
 * entrambe meglio insieme.
 *
 * Su un ciclo prodotto da `runMatchingRound` questa lista deve essere vuota. Se
 * non lo e', il punteggio ha smesso di essere simmetrico o qualcuno ha cambiato
 * l'ordinamento: in entrambi i casi e' un difetto, non una sfumatura.
 *
 * @param {ReturnType<typeof runMatchingRound>} esito
 * @param {import('./types.js').Profile[]} profili
 * @param {object} [options]
 */
export function coppieBloccanti(esito, profili, options = {}) {
  /** @type {Map<string, number>} */
  const punteggioAssegnato = new Map();
  for (const coppia of esito.coppie) {
    punteggioAssegnato.set(coppia.a.id, coppia.score);
    punteggioAssegnato.set(coppia.b.id, coppia.score);
  }
  const partner = new Map();
  for (const coppia of esito.coppie) {
    partner.set(coppia.a.id, coppia.b.id);
    partner.set(coppia.b.id, coppia.a.id);
  }

  const bloccanti = [];
  for (const candidata of tutteLeCoppie(profili, options)) {
    const { a, b, score } = candidata;
    if (score < esito.soglia) continue;
    if (partner.get(a.id) === b.id) continue;
    // Chi non e' stato abbinato preferisce qualsiasi cosa al niente.
    const miglioreDiA = score > (punteggioAssegnato.get(a.id) ?? -Infinity);
    const miglioreDiB = score > (punteggioAssegnato.get(b.id) ?? -Infinity);
    if (miglioreDiA && miglioreDiB) {
      bloccanti.push({ coppia: [a.id, b.id], score });
    }
  }
  return bloccanti;
}
