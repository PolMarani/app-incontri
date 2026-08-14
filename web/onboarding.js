/**
 * Primo avvio: si costruisce un profilo vero.
 *
 * Due ragioni per cui questa schermata non è un ornamento.
 *
 * La prima: **il motore ha cancelli di consenso separati** per il compagno che
 * ascolta, per i momenti di affetto e per i giochi, e finché non esisteva un
 * onboarding l'app li metteva tutti a `true` per conto suo. Un'app che concede
 * da sola un consenso che nessuno le ha dato è peggio di un'app che non lo
 * chiede affatto, perché il codice attorno sembra prudente e non lo è.
 *
 * La seconda: **zero chat è una promessa che va spiegata prima**, non scoperta
 * al primo abbinamento. Chi arriva da altre app cerca la casella dei messaggi e
 * se non la trova pensa che sia rotta.
 *
 * Il profilo costruito qui passa da `validateProfile()` del motore prima di
 * essere salvato: le stesse regole dei test, compreso il controllo che i campi
 * liberi non contengano un contatto.
 */

import { VIBE_LABELS } from '../src/data/taxonomy.js';

/** Zone di partenza. Niente indirizzo: basta il quartiere. */
export const ZONE = [
  { id: 'isola', nome: 'Isola', lat: 45.488, lon: 9.188 },
  { id: 'porta-venezia', nome: 'Porta Venezia', lat: 45.4772, lon: 9.2085 },
  { id: 'navigli', nome: 'Navigli', lat: 45.4507, lon: 9.1742 },
  { id: 'citta-studi', nome: 'Città Studi', lat: 45.4784, lon: 9.2287 },
  { id: 'porta-romana', nome: 'Porta Romana', lat: 45.4459, lon: 9.2038 },
  { id: 'sempione', nome: 'Sempione', lat: 45.4749, lon: 9.1739 },
  { id: 'nolo', nome: 'NoLo', lat: 45.4931, lon: 9.2178 },
  { id: 'bicocca', nome: 'Bicocca', lat: 45.5163, lon: 9.2126 },
];

export const GIORNI = [
  { id: 'lun', nome: 'lun' }, { id: 'mar', nome: 'mar' }, { id: 'mer', nome: 'mer' },
  { id: 'gio', nome: 'gio' }, { id: 'ven', nome: 'ven' }, { id: 'sab', nome: 'sab' },
  { id: 'dom', nome: 'dom' },
];

export const FASCE = [
  { id: 'pomeriggio', nome: 'pomeriggio', start: '15:00', end: '19:00' },
  { id: 'aperitivo', nome: 'aperitivo', start: '18:00', end: '21:30' },
  { id: 'sera', nome: 'sera', start: '19:00', end: '23:30' },
];

/** Un sottoinsieme leggibile della tassonomia: sceglierne 24 non 200. */
export const INTERESSI = [
  'viaggi', 'cucina', 'libri', 'cinema', 'concerti', 'fotografia',
  'arrampicata', 'trekking', 'bici', 'yoga', 'corsa', 'nuoto',
  'vinili', 'jazz', 'techno', 'teatro', 'musei', 'fumetti',
  'giochi_da_tavolo', 'videogiochi', 'astronomia', 'filosofia', 'cani', 'piante',
];

export const VALORI = ['sostenibilità', 'onestà', 'curiosità', 'spontaneità', 'famiglia', 'indipendenza'];

const bello = (t) => String(t).replace(/_/g, ' ');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Stato iniziale della compilazione. */
export function datiVuoti() {
  return {
    zona: null,
    raggioKm: 5,
    giorni: [],
    fascia: 'sera',
    interessi: [],
    valori: [],
    curiosita: '',
    consensi: { compagno: false, affetto: false, giochi: false },
    contattoFidato: '',
  };
}

export const PASSI = ['benvenuto', 'quando', 'dove', 'interessi', 'curiosita', 'consensi', 'fine'];

/** Il passo corrente è compilato abbastanza da poter proseguire? */
export function puoiProseguire(passo, d) {
  if (passo === 'quando') return d.giorni.length > 0;
  if (passo === 'dove') return Boolean(d.zona);
  if (passo === 'interessi') return d.interessi.length >= 2;
  return true;
}

const chip = (id, testo, attivo, gruppo) =>
  `<button class="chip-ob" data-ob="${gruppo}" data-valore="${id}" aria-pressed="${attivo}">${esc(testo)}</button>`;

// ---------------------------------------------------------------------------
// Le schermate
// ---------------------------------------------------------------------------

export function vistaOnboarding(ob) {
  const d = ob.dati;
  const passo = PASSI[ob.passo];
  const indice = ob.passo;

  const corpo = {
    benvenuto: () => `
      <p class="occhiello">Benvenuto</p>
      <h1>Niente messaggi.<br><em>Solo l’incontro.</em></h1>
      <p class="testo">BlindStep abbina due persone e propone un posto pubblico a metà strada. Poi si esce e ci si vede.</p>
      <div class="pannello">
        <div class="punto"><span class="segnale">01</span><div><b>Non potrete scrivervi.</b> Né prima né dopo. Quello che c’è da dire si dice al tavolo.</div></div>
        <div class="punto"><span class="segnale">02</span><div><b>Nessuna foto, nessun nome.</b> Vi riconoscerete con una parola chiave e un segno sul tavolo.</div></div>
        <div class="punto"><span class="segnale">03</span><div><b>Il posto lo scegliete in due</b>, senza sapere dove abita l’altro.</div></div>
      </div>
      <p class="nota">Se stai cercando una casella dei messaggi: non c’è, e non è un errore.</p>`,

    quando: () => `
      <p class="occhiello">Quando</p>
      <h1>Quando puoi<br><em>uscire davvero.</em></h1>
      <p class="testo piccolo">Meglio poche sere vere che tante di cortesia: se non c’è una sera in comune, il motore scarta l’abbinamento invece di parcheggiarlo.</p>
      <div class="pannello">
        <p class="occhiello muto">Giorni</p>
        <div class="chip-riga">${GIORNI.map((g) => chip(g.id, g.nome, d.giorni.includes(g.id), 'giorno')).join('')}</div>
      </div>
      <div class="pannello">
        <p class="occhiello muto">Fascia</p>
        <div class="chip-riga">${FASCE.map((f) => chip(f.id, f.nome, d.fascia === f.id, 'fascia')).join('')}</div>
      </div>`,

    dove: () => `
      <p class="occhiello">Da dove parti</p>
      <h1>La tua zona<br><em>resta tua.</em></h1>
      <p class="testo piccolo">Serve solo a trovare un punto equo. Non viene mostrata a nessuno, e nemmeno tu vedrai quella dell’altra persona.</p>
      <div class="pannello">
        <div class="chip-riga">${ZONE.map((z) => chip(z.id, z.nome, d.zona === z.id, 'zona')).join('')}</div>
      </div>
      <div class="pannello">
        <p class="occhiello muto">Quanto ti sposti</p>
        <div class="chip-riga">${[3, 5, 8, 12].map((k) => chip(String(k), `${k} km`, d.raggioKm === k, 'raggio')).join('')}</div>
      </div>`,

    interessi: () => `
      <p class="occhiello">Cosa ti interessa</p>
      <h1>Almeno due,<br><em>quelli veri.</em></h1>
      <p class="testo piccolo">Contano i legami forti, non la lunghezza della lista: dieci interessi vaghi valgono meno di due su cui hai davvero qualcosa da dire.</p>
      <div class="pannello">
        <div class="chip-riga">${INTERESSI.map((t) => chip(t, bello(t), d.interessi.includes(t), 'interesse')).join('')}</div>
      </div>
      <div class="pannello">
        <p class="occhiello muto">Valori</p>
        <div class="chip-riga">${VALORI.map((v) => chip(v, v, d.valori.includes(v), 'valore')).join('')}</div>
      </div>
      <div class="pannello">
        <p class="occhiello muto">Che serata cerchi</p>
        <div class="chip-riga">${['caffe_tranquillo', 'bar_serale', 'libreria', 'parco', 'museo', 'boardgame_cafe']
          .map((v) => chip(v, VIBE_LABELS[v] ?? v, (d.vibes ?? []).includes(v), 'vibe')).join('')}</div>
      </div>`,

    curiosita: () => `
      <p class="occhiello">Una cosa strana su di te</p>
      <h1>Il dettaglio<br><em>che non diresti.</em></h1>
      <p class="testo piccolo">Finisce nelle carte che legge l’altra persona durante la serata. È la materia prima migliore che il motore abbia.</p>
      <div class="pannello">
        <textarea id="campo-curiosita" class="campo" rows="3" maxlength="240"
          placeholder="Ho un lievito madre di quattro anni e gli ho dato un nome.">${esc(d.curiosita)}</textarea>
        <p class="conta"><span id="conta-curiosita">${d.curiosita.length}</span>/240</p>
        ${ob.erroreCuriosita ? `<p class="errore-campo">${esc(ob.erroreCuriosita)}</p>` : ''}
      </div>
      <p class="nota">Niente numeri, indirizzi o nomi utente: l’app li rifiuta, perché quella riga viene letta prima che vi incontriate.</p>`,

    consensi: () => `
      <p class="occhiello">Cosa può fare l’app</p>
      <h1>Tre cose separate,<br><em>tre risposte.</em></h1>
      <p class="testo piccolo">Accettarne una non accetta le altre. Si possono cambiare quando vuoi.</p>

      ${interruttore('compagno', 'Il compagno di serata',
        'Ascolta dal telefono e rilancia quando la conversazione si inceppa. L’audio non esce dal dispositivo e non viene registrato: al server arrivano solo numeri.', d.consensi.compagno)}

      ${interruttore('affetto', 'Momenti di affetto',
        'Ogni tanto propone un gesto — un brindisi, un abbraccio. La proposta la vedi solo tu, serve il sì di entrambi, e se rifiuti non lo sa nessuno.', d.consensi.affetto)}

      ${interruttore('giochi', 'Giochi in due',
        'Cose brevi da fare su un telefono solo nei momenti piatti. Mai mentre la conversazione gira.', d.consensi.giochi)}

      <div class="pannello">
        <p class="occhiello muto">Contatto fidato (facoltativo)</p>
        <input id="campo-contatto" class="campo" type="text" inputmode="text" maxlength="60"
          placeholder="Chi avvisare se premi il pulsante" value="${esc(d.contattoFidato)}">
        <p class="nota" style="margin-bottom:0">Riceve luogo, orario e posizione live solo se sei tu a chiederlo.</p>
      </div>`,

    fine: () => `
      <p class="occhiello">Tutto pronto</p>
      <h1>Ci pensiamo noi<br><em>a trovarti qualcuno.</em></h1>
      <p class="testo">Quando arriva un abbinamento te lo diciamo. Non c’è una lista da sfogliare, e non c’è nessuno da mettere “mi piace”.</p>
      <div class="pannello">
        <div class="punto"><span class="segnale">✓</span><div>${d.giorni.length} ${d.giorni.length === 1 ? 'sera' : 'sere'} a settimana, ${esc(FASCE.find((f) => f.id === d.fascia).nome)}</div></div>
        <div class="punto"><span class="segnale">✓</span><div>${esc(ZONE.find((z) => z.id === d.zona)?.nome ?? '')}, fino a ${d.raggioKm} km</div></div>
        <div class="punto"><span class="segnale">✓</span><div>${d.interessi.length} interessi</div></div>
        <div class="punto"><span class="segnale">${Object.values(d.consensi).some(Boolean) ? '✓' : '–'}</span><div>${
          Object.entries(d.consensi).filter(([, v]) => v).map(([k]) => k).join(', ') || 'nessuna funzione durante la serata'
        }</div></div>
      </div>`,
  }[passo]();

  const ultimo = ob.passo === PASSI.length - 1;
  const puo = puoiProseguire(passo, d);

  return `
    <div class="schermata onboarding">
      <div class="avanzamento" role="progressbar" aria-valuenow="${indice + 1}" aria-valuemin="1" aria-valuemax="${PASSI.length}">
        ${PASSI.map((_, i) => `<span class="${i <= indice ? 'fatto' : ''}"></span>`).join('')}
      </div>
      ${corpo}
      <div class="azioni">
        <button class="btn" data-azione="ob-avanti" ${puo ? '' : 'disabled'}>
          ${ultimo ? 'Comincia' : puo ? 'Avanti' : suggerimento(passo)}
        </button>
        ${ob.passo > 0 ? '<button class="btn fantasma" data-azione="ob-indietro">Indietro</button>' : ''}
      </div>
    </div>`;
}

function suggerimento(passo) {
  return {
    quando: 'Scegli almeno una sera',
    dove: 'Scegli la tua zona',
    interessi: 'Scegline almeno due',
  }[passo] ?? 'Avanti';
}

function interruttore(id, titolo, descrizione, attivo) {
  return `
    <button class="interruttore" data-ob="consenso" data-valore="${id}" aria-pressed="${attivo}">
      <span class="testi">
        <span class="t">${esc(titolo)}</span>
        <span class="d">${esc(descrizione)}</span>
      </span>
      <span class="leva" aria-hidden="true"><span></span></span>
    </button>`;
}

// ---------------------------------------------------------------------------
// Interazione
// ---------------------------------------------------------------------------

/** Applica un tocco su una scelta. Ritorna true se qualcosa è cambiato. */
export function scegli(ob, gruppo, valore) {
  const d = ob.dati;
  const alterna = (lista, v) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

  switch (gruppo) {
    case 'giorno': d.giorni = alterna(d.giorni, valore); return true;
    case 'fascia': d.fascia = valore; return true;
    case 'zona': d.zona = valore; return true;
    case 'raggio': d.raggioKm = Number(valore); return true;
    case 'interesse': d.interessi = alterna(d.interessi, valore); return true;
    case 'valore': d.valori = alterna(d.valori, valore); return true;
    case 'vibe': d.vibes = alterna(d.vibes ?? [], valore); return true;
    case 'consenso': d.consensi[valore] = !d.consensi[valore]; return true;
    default: return false;
  }
}

/**
 * Costruisce il profilo nella forma che il motore si aspetta.
 * @param {ReturnType<typeof datiVuoti>} d
 * @param {string} id
 */
export function costruisciProfilo(d, id) {
  const fascia = FASCE.find((f) => f.id === d.fascia) ?? FASCE[2];
  const zona = ZONE.find((z) => z.id === d.zona) ?? ZONE[0];
  const curiosita = d.curiosita.trim();

  return {
    id,
    availability: d.giorni.map((g) => ({ day: g, start: fascia.start, end: fascia.end })),
    interests: d.interessi,
    values: d.valori,
    curiosities: curiosita ? [curiosita] : [],
    vibes: d.vibes?.length ? d.vibes : ['caffe_tranquillo', 'bar_serale'],
    origin: { lat: zona.lat, lon: zona.lon, label: zona.nome },
    maxTravelKm: d.raggioKm,
  };
}
