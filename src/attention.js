/**
 * Budget di attenzione: l'arbitro fra tutto cio' che vuole il telefono.
 *
 * Con il compagno che rilancia carte, le battute, le proposte di affetto e ora
 * i giochi, il rischio non e' piu' che l'app dica la cosa sbagliata: e' che
 * chieda attenzione **tre volte in cinque minuti**. Ogni modulo, preso da solo,
 * si comporta bene - il problema nasce dalla somma, e nessuno dei moduli puo'
 * vederla.
 *
 * Quindi esiste un solo posto che tiene il conto: una richiesta alla volta, una
 * pausa dopo ognuna proporzionale a quanto e' stata invadente, e un tetto per
 * la serata. Chi non ottiene il turno non insiste: riprova piu' tardi o lascia
 * perdere.
 */

/** Quanto "pesa" ogni tipo di interruzione. Un gioco costa quanto quattro carte. */
export const PESI = {
  carta: 1,
  battuta: 1,
  chiusura: 1,
  affetto: 2,
  gioco: 4,
};

/** Minuti di pausa per unita' di peso, dopo un'interruzione. */
const PAUSA_PER_PESO_MIN = 3;

/**
 * @param {{ durataPrevistaMin?: number, maxPeso?: number }} [options]
 */
export function createAttentionBudget(options = {}) {
  const durata = options.durataPrevistaMin ?? 120;
  return {
    // Un tetto proporzionato alla serata: circa un'interruzione leggera ogni
    // otto minuti nel caso limite, molte meno nella pratica.
    maxPeso: options.maxPeso ?? Math.max(6, Math.round(durata / 8)),
    pesoSpeso: 0,
    occupatoDa: null,
    liberoDaSec: -Infinity,
    concessioni: [],
  };
}

/**
 * Il turno sarebbe disponibile? Non consuma niente.
 *
 * Serve a chi deve ancora decidere se vuole davvero parlare: chiedere il turno
 * per poi restituirlo aprirebbe la pausa fra le interruzioni, e una fase che si
 * limita a valutare finirebbe per zittire tutte le altre senza aver detto una
 * parola.
 *
 * @param {ReturnType<typeof createAttentionBudget>} budget
 * @param {{ fase: string, tipo: keyof typeof PESI, t: number }} richiesta
 * @returns {{ disponibile: boolean, motivo: string }}
 */
export function attenzioneDisponibile(budget, { fase, tipo, t }) {
  const peso = PESI[tipo] ?? 1;
  if (budget.occupatoDa && budget.occupatoDa !== fase) {
    return { disponibile: false, motivo: `turno occupato da ${budget.occupatoDa}` };
  }
  if (t < budget.liberoDaSec) {
    return { disponibile: false, motivo: 'pausa fra due interruzioni' };
  }
  if (budget.pesoSpeso + peso > budget.maxPeso) {
    return { disponibile: false, motivo: 'budget di attenzione della serata esaurito' };
  }
  return { disponibile: true, motivo: 'disponibile' };
}

/**
 * Chiede e prende il turno. Va chiamata subito prima di mostrare qualcosa.
 *
 * @param {ReturnType<typeof createAttentionBudget>} budget
 * @param {{ fase: string, tipo: keyof typeof PESI, t: number }} richiesta
 * @returns {{ concesso: boolean, motivo: string }}
 */
export function richiediAttenzione(budget, { fase, tipo, t }) {
  const check = attenzioneDisponibile(budget, { fase, tipo, t });
  if (!check.disponibile) return { concesso: false, motivo: check.motivo };

  budget.occupatoDa = fase;
  budget.pesoSpeso += PESI[tipo] ?? 1;
  budget.concessioni.push({ fase, tipo, peso: PESI[tipo] ?? 1, t });
  return { concesso: true, motivo: 'concesso' };
}

/**
 * Restituisce il turno e apre la pausa. Va chiamata anche quando la cosa
 * proposta non e' andata in porto: il telefono ha comunque chiesto attenzione.
 * @param {ReturnType<typeof createAttentionBudget>} budget
 * @param {{ fase: string, t: number }} params
 */
export function rilasciaAttenzione(budget, { fase, t }) {
  if (budget.occupatoDa !== fase) return { ok: false };
  const ultima = budget.concessioni[budget.concessioni.length - 1];
  budget.occupatoDa = null;
  budget.liberoDaSec = t + (ultima?.peso ?? 1) * PAUSA_PER_PESO_MIN * 60;
  return { ok: true, liberoDaSec: budget.liberoDaSec };
}

/**
 * Quanto il telefono si e' fatto sentire. Finisce nei segnali al matcher:
 * una serata con poche interruzioni e' una serata che si e' retta da sola.
 * @param {ReturnType<typeof createAttentionBudget>} budget
 */
export function riepilogoAttenzione(budget) {
  const perFase = {};
  for (const c of budget.concessioni) {
    perFase[c.fase] = (perFase[c.fase] ?? 0) + c.peso;
  }
  return {
    interruzioni: budget.concessioni.length,
    pesoSpeso: budget.pesoSpeso,
    maxPeso: budget.maxPeso,
    quotaUsata: Math.round((budget.pesoSpeso / budget.maxPeso) * 100) / 100,
    perFase,
  };
}
