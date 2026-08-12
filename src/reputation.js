/**
 * Affidabilita': la vera valuta di un'app senza chat.
 *
 * Qui l'unica cosa che un utente "spende" e' presentarsi. Non ci sono messaggi
 * da scambiare per mesi, non c'e' un profilo da curare: c'e' una persona che
 * esce di casa o non esce. Quindi l'affidabilita' non e' un pannello
 * anti-abuso in fondo alle impostazioni, e' un ingrediente del matching.
 *
 * Il principio: chi si presenta va abbinato con chi si presenta. Non e' una
 * punizione per gli altri, e' protezione per chi ha attraversato la citta'.
 */

/**
 * @typedef {Object} StoricoUtente
 * @property {number} [incontriFissati]
 * @property {number} [incontriOnorati]      presente e con check-in
 * @property {number} [annullamentiPerTempo] annullati prima di T-6h
 * @property {number} [annullamentiTardivi]  annullati dopo T-6h
 * @property {number} [noShow]               non presentato, senza avvisare
 * @property {number} [segnalazioniRicevute] segnalazioni confermate dal team
 */

/** Sotto questa soglia il profilo non viene abbinato a nessuno. */
export const SOGLIA_BLOCCO = 0.35;
/** Peso massimo che l'affidabilita' puo' togliere al punteggio di un match. */
const IMPATTO_MAX = 0.15;

/**
 * Affidabilita' 0..1 a partire dallo storico.
 *
 * Chi non ha storico vale 1: un profilo nuovo non e' un profilo sospetto, e
 * partire da un valore basso significherebbe che nessuno riesce mai a fare il
 * primo incontro. Il rischio del nuovo arrivato lo assorbe l'app, non l'utente
 * che gli si trova davanti.
 *
 * @param {StoricoUtente} [storico]
 * @returns {{ valore: number, nuovo: boolean, dettaglio: object }}
 */
export function affidabilita(storico = {}) {
  const fissati = storico.incontriFissati ?? 0;
  if (fissati === 0) {
    return { valore: 1, nuovo: true, dettaglio: { motivo: 'nessuno storico' } };
  }

  const onorati = storico.incontriOnorati ?? 0;
  const perTempo = storico.annullamentiPerTempo ?? 0;
  const tardivi = storico.annullamentiTardivi ?? 0;
  const noShow = storico.noShow ?? 0;
  const segnalazioni = storico.segnalazioniRicevute ?? 0;

  // Annullare per tempo e' un comportamento corretto, non una colpa: costa
  // pochissimo. Annullare all'ultimo costa. Non presentarsi costa moltissimo,
  // perche' e' l'unico caso in cui qualcuno resta seduto ad aspettare.
  const penalita = perTempo * 0.05 + tardivi * 0.35 + noShow * 1.5;
  const grezzo = (onorati + perTempo * 0.5) / Math.max(1, fissati);
  const valore = Math.max(0, Math.min(1, grezzo - penalita / Math.max(3, fissati)));

  // Le segnalazioni confermate non si compensano con la puntualita': chi si
  // comporta male non si riscatta presentandosi in orario.
  const finale = segnalazioni > 0 ? Math.min(valore, 0.3 / segnalazioni) : valore;

  return {
    valore: Math.round(finale * 100) / 100,
    nuovo: false,
    dettaglio: { fissati, onorati, perTempo, tardivi, noShow, segnalazioni },
  };
}

/**
 * Fattore da applicare al punteggio di un match. Vale 1 quando entrambi sono
 * affidabili (o nuovi) e scende fino a 0.85: abbastanza da riordinare la coda,
 * non abbastanza da diventare l'unica cosa che conta.
 * @param {StoricoUtente} [storicoA]
 * @param {StoricoUtente} [storicoB]
 */
export function fattoreAffidabilita(storicoA, storicoB) {
  const a = affidabilita(storicoA).valore;
  const b = affidabilita(storicoB).valore;
  return 1 - IMPATTO_MAX * (1 - Math.min(a, b));
}

/**
 * Motivi di blocco legati alla reputazione.
 * @param {import('./types.js').Profile} a
 * @param {import('./types.js').Profile} b
 * @returns {string[]}
 */
export function blocchiDiReputazione(a, b) {
  const blocchi = [];
  for (const profilo of [a, b]) {
    const { valore, nuovo } = affidabilita(profilo.storico);
    if (!nuovo && valore < SOGLIA_BLOCCO) {
      blocchi.push(
        `${profilo.id}: troppi incontri saltati di recente (affidabilita ${valore})`,
      );
    }
  }
  return blocchi;
}

/**
 * Percorso di rientro per chi e' finito sotto soglia.
 *
 * Un blocco definitivo su un'app di incontri e' sproporzionato: la gente
 * attraversa periodi storti. Ma il rientro deve costare qualcosa a chi rientra
 * e niente a chi gli si trovera' davanti - quindi si riparte da incontri con
 * conferma stretta, non da un condono.
 * @param {StoricoUtente} storico
 */
export function percorsoDiRientro(storico) {
  const { valore, nuovo } = affidabilita(storico);
  if (nuovo || valore >= SOGLIA_BLOCCO) return { necessario: false };
  return {
    necessario: true,
    valore,
    passi: [
      'Il prossimo abbinamento richiede la conferma a T-24h, T-6h e T-1h senza saltarne nessuna.',
      'Fino al rientro vieni abbinato solo con chi ha accettato di incontrare profili in rientro.',
      'Due incontri onorati di fila riportano il profilo in circolo normalmente.',
    ],
    messaggio:
      'Capita di dover disdire, e capita di stare male. Non e una condanna: ' +
      'servono due incontri andati a buon fine e si riparte.',
  };
}

/**
 * Priorita' di riabbinamento per chi ha subito un buco non suo.
 * Chi e' rimasto ad aspettare a un tavolo deve trovare qualcosa di buono
 * subito dopo, altrimenti l'app ha estratto solo un costo dalla sua serata.
 * @param {{ noShowSubiti?: number, annullamentiSubitiTardivi?: number }} storico
 * @returns {number} moltiplicatore di priorita' in coda
 */
export function prioritaDiRecupero(storico = {}) {
  const subiti = (storico.noShowSubiti ?? 0) * 2 + (storico.annullamentiSubitiTardivi ?? 0);
  return 1 + Math.min(1.5, subiti * 0.5);
}
