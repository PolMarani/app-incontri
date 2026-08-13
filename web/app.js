/**
 * BlindStep — applicazione.
 *
 * Non è una simulazione dell'app: importa `src/engine.js` e chiama le stesse
 * funzioni che girano nei test. Il punteggio che vedi a schermo esce da
 * `evaluateMatch`, le tre opzioni da `proposeLocations`, il codice di
 * riconoscimento da `buildEventCard`, e ciò che succede durante la serata da
 * `tickEvening`. Non c'è nessun dato finto se non i profili di esempio e i
 * segnali del microfono, che su un telefono vero arriverebbero dal
 * riconoscimento sul dispositivo.
 *
 * L'unica finzione è il tempo: un appuntamento è fra giorni, quindi c'è un
 * orologio simulato e una striscia in alto per farlo avanzare.
 */

import {
  autoRanking,
  buildDebrief,
  buildEventCard,
  checkIn,
  chiudiGioco,
  closeEvening,
  confirmCheckpoint,
  createEvening,
  createMeetingPlan,
  eventCardFor,
  openSupportChannel,
  proposeLocations,
  rankCandidates,
  resolveLocationConsensus,
  rispondiAffetto,
  rispondiGioco,
  summarizePlan,
  tickEvening,
} from '../src/engine.js';
import { EMERGENCY_RESOURCES, SAFETY_ACTIONS } from '../src/phase4-safety.js';
import { sampleProfile, SAMPLE_PROFILES } from '../src/data/sample-profiles.js';

// ---------------------------------------------------------------------------
// Stato
// ---------------------------------------------------------------------------

const IO = 'u-7f3a';
const INIZIO_SIMULAZIONE = '2026-08-12T10:00:00+02:00';

const stato = {
  scheda: 'oggi',
  fase: 'ricerca', // ricerca | match | luogo | attesa | serata | dopo
  adesso: new Date(INIZIO_SIMULAZIONE),
  io: sampleProfile(IO),
  altro: null,
  valutazione: null,
  proposta: null,
  scelte: [],
  card: null,
  mia: null,
  piano: null,
  serata: null,
  secondi: 0,
  momenti: [],
  inCorso: null,
  timer: null,
  chiusa: null,
  canale: null,
  avviso: null,
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tocco = (ms = 8) => navigator.vibrate?.(ms);

// ---------------------------------------------------------------------------
// Icone
// ---------------------------------------------------------------------------

const ICONE = {
  oggi: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10Z"/><circle cx="12" cy="11" r="2.4"/></svg>',
  profilo: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.6-3.6 3.4-5.6 7-5.6s6.4 2 7 5.6"/></svg>',
  scudo: '<svg viewBox="0 0 24 24"><path d="M12 3.5 20 7v5.4c0 4.4-3.2 7.6-8 8.6-4.8-1-8-4.2-8-8.6V7l8-3.5Z"/><path d="M12 9v4"/><circle cx="12" cy="16" r=".7" fill="currentColor"/></svg>',
  uscita: '<svg viewBox="0 0 24 24"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 8 6 12l4 4"/><path d="M6 12h9"/></svg>',
  staff: '<svg viewBox="0 0 24 24"><path d="M4 20c.6-3.4 3.2-5.2 6.5-5.2S16.4 16.6 17 20"/><circle cx="10.5" cy="8" r="3.2"/><path d="M17 5.5a3 3 0 0 1 0 6"/></svg>',
  posizione: '<svg viewBox="0 0 24 24"><path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10Z"/><circle cx="12" cy="11" r="2.4"/></svg>',
  parla: '<svg viewBox="0 0 24 24"><path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z"/></svg>',
  emergenza: '<svg viewBox="0 0 24 24"><path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".7" fill="currentColor"/></svg>',
};

const ICONA_SOS = {
  uscita_assistita: ICONE.uscita,
  avvisa_staff: ICONE.staff,
  condividi_posizione: ICONE.posizione,
  supporto: ICONE.parla,
  emergenza: ICONE.emergenza,
};

// ---------------------------------------------------------------------------
// Formati
// ---------------------------------------------------------------------------

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/** "giovedì 13 agosto", non "2026-08-13". */
function dataLeggibile(iso) {
  const d = new Date(iso);
  const giorno = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'][d.getDay()];
  return `${giorno} ${d.getDate()} ${MESI[d.getMonth()]}`;
}

function mancanoA(iso) {
  const ms = new Date(iso) - stato.adesso;
  if (ms <= 0) return { n: 'ora', e: 'è il momento' };
  const min = Math.round(ms / 60000);
  if (min < 60) return { n: String(min), e: min === 1 ? 'minuto all’incontro' : 'minuti all’incontro' };
  const ore = Math.round(min / 60);
  if (ore < 36) return { n: String(ore), e: ore === 1 ? 'ora all’incontro' : 'ore all’incontro' };
  const giorni = Math.round(ore / 24);
  return { n: String(giorni), e: giorni === 1 ? 'giorno all’incontro' : 'giorni all’incontro' };
}

const bello = (tag) => String(tag).replace(/_/g, ' ');

// ---------------------------------------------------------------------------
// Passaggi del flusso
// ---------------------------------------------------------------------------

function cercaAbbinamento() {
  const candidati = Object.keys(SAMPLE_PROFILES).filter((id) => id !== IO).map(sampleProfile);
  const risultati = rankCandidates(stato.io, candidati, { adattiva: true, obiettivo: 1 });
  if (risultati.length === 0) return false;

  stato.altro = risultati[0].candidate;
  stato.valutazione = risultati[0].evaluation;
  stato.proposta = proposeLocations(stato.io, stato.altro, stato.valutazione);
  stato.fase = 'match';
  return true;
}

function confermaLuogo() {
  // L'altra persona vota usando solo la propria vista anonima: è la stessa
  // funzione che girerebbe sul suo telefono.
  const suo = autoRanking(stato.altro, stato.proposta.viewFor(stato.altro.id));
  const consenso = resolveLocationConsensus(stato.proposta, stato.scelte, suo);
  if (!consenso.ok) return { ok: false, motivo: consenso.reason };

  stato.card = buildEventCard(stato.io, stato.altro, stato.valutazione, consenso.chosen, {
    now: stato.adesso,
    matchId: `${stato.io.id}-${stato.altro.id}`,
  });
  stato.mia = eventCardFor(stato.card, IO);
  stato.piano = createMeetingPlan(stato.card, { now: stato.adesso });
  stato.fase = 'attesa';
  return { ok: true };
}

function avviaSerata() {
  stato.serata = createEvening(stato.card, {
    consensi: {
      compagno: { [stato.io.id]: true, [stato.altro.id]: true },
      affetto: { [stato.io.id]: true, [stato.altro.id]: true },
      giochi: { [stato.io.id]: true, [stato.altro.id]: true },
    },
  });
  stato.secondi = 0;
  stato.momenti = [];
  stato.fase = 'serata';
}

/** Andamento simulato: imbarazzo, decollo, calo, ripresa, chiusura. */
function clima(minuti) {
  if (minuti < 9) return { energia: 0.22, silenzioSec: 13, risate: 0, quotaParlato: 0.5 };
  if (minuti < 28) return { energia: 0.78, silenzioSec: 1, risate: 2, domande: 3, quotaParlato: 0.58 };
  if (minuti < 52) return { energia: 0.36, silenzioSec: 21, risate: 0, quotaParlato: 0.72 };
  if (minuti < 84) return { energia: 0.63, silenzioSec: 2, risate: 2, domande: 2, quotaParlato: 0.52 };
  return { energia: 0.26, silenzioSec: 24, risate: 0, quotaParlato: 0.5 };
}

function passoSerata() {
  if (stato.inCorso) return;
  stato.secondi += 60;
  const minuti = stato.secondi / 60;
  const { azioni } = tickEvening(stato.serata, { t: stato.secondi, rischio: 'nessuno', ...clima(minuti) });

  for (const azione of azioni) {
    stato.momenti.push(azione);
    if (azione.tipo === 'proposta') stato.inCorso = azione;
  }

  if (minuti >= 100 || stato.inCorso) fermaOrologio();
  if (minuti >= 100) concludiSerata();
  render();
}

function avviaOrologio() {
  if (stato.timer) return;
  stato.timer = setInterval(passoSerata, 420);
}
function fermaOrologio() {
  clearInterval(stato.timer);
  stato.timer = null;
}

function concludiSerata() {
  fermaOrologio();
  stato.chiusa = closeEvening(stato.serata, { durataEffettivaMin: Math.max(1, Math.round(stato.secondi / 60)) });
  stato.fase = 'dopo';
}

// ---------------------------------------------------------------------------
// Schermate
// ---------------------------------------------------------------------------

function schermataOggi() {
  return {
    ricerca: vistaRicerca,
    match: vistaMatch,
    luogo: vistaLuogo,
    attesa: vistaAttesa,
    serata: vistaSerata,
    dopo: vistaDopo,
  }[stato.fase]();
}

function vistaRicerca() {
  const giorni = { lun: 'lunedì', mar: 'martedì', mer: 'mercoledì', gio: 'giovedì', ven: 'venerdì', sab: 'sabato', dom: 'domenica' };
  return `
    <div class="schermata">
      <p class="occhiello">Stasera</p>
      <h1>Nessun incontro<br><em>in programma.</em></h1>
      <p class="testo">Quando arriva un abbinamento non c’è niente da scriversi: c’è un posto, un orario, e ci si va.</p>

      <div class="pannello ritardo-1">
        <p class="occhiello muto">Quando sei libero</p>
        ${stato.io.availability
          .map(
            (f) => `<div class="tappa" data-stato="fatto">
              <span class="cerchio">✓</span>
              <div class="testi">
                <div class="q">${esc(giorni[f.day])}, ${esc(f.start)} – ${esc(f.end)}</div>
                <div class="s">${esc(stato.io.origin.label)} · fino a ${stato.io.maxTravelKm} km</div>
              </div>
            </div>`,
          )
          .join('')}
      </div>

      <div class="azioni ritardo-2">
        <button class="btn" data-azione="cerca">Cercami un incontro</button>
      </div>
      <p class="nota">Il motore scarta chi non ha una sera libera in comune con te, chi è troppo lontano perché esista un punto equo, e chi hai già incontrato.</p>
    </div>`;
}

function vistaMatch() {
  const v = stato.valutazione;
  const dimensioni = {
    availability: 'Orari',
    geography: 'Distanza',
    vibe: 'Che serata',
    interests: 'Interessi',
    values: 'Valori',
    spark: 'Scintilla',
  };
  return `
    <div class="schermata">
      <p class="occhiello">Abbinamento trovato</p>
      <h1>Qualcuno con cui<br><em>vale la pena</em> uscire.</h1>

      <div class="pannello acceso ritardo-1">
        <div class="quadrante"><span class="n">${Math.round(v.score)}</span><span class="u">%</span></div>
        <p class="mono">compatibilità su sei dimensioni</p>
        <div class="barre">
          ${Object.entries(dimensioni)
            .map(
              ([k, etichetta]) => `
            <div class="barra">
              <span class="k">${etichetta}</span>
              <span class="t"><span class="f" style="--w:${Math.round(v.breakdown[k] * 100)}%"></span></span>
              <span class="v">${Math.round(v.breakdown[k] * 100)}</span>
            </div>`,
            )
            .join('')}
        </div>
      </div>

      <div class="pannello ritardo-2">
        <div class="blocco"><i>Avete in comune</i>
          <div class="tag-riga">${v.sharedInterests.map((t) => `<span class="tag acceso">${esc(bello(t))}</span>`).join('')}</div>
        </div>
        <div class="divisorio scuro"></div>
        <div class="blocco"><i>Su cui siete lontani</i>
          <div class="tag-riga">${v.complementaryInterests.slice(0, 6).map((t) => `<span class="tag">${esc(bello(t))}</span>`).join('')}</div>
        </div>
        <p class="nota" style="margin-bottom:0">La distanza conta quanto le somiglianze: due profili identici fanno una serata piatta.</p>
      </div>

      <div class="azioni ritardo-3">
        <button class="btn" data-azione="vai-luogo">Scegliete dove</button>
      </div>
    </div>`;
}

function vistaLuogo() {
  const viste = stato.proposta.viewFor(IO);
  return `
    <div class="schermata">
      <p class="occhiello">Dove vedersi</p>
      <h1>Tre posti<br><em>a metà strada.</em></h1>
      <p class="testo piccolo">Nessun nome e nessun indirizzo finché non siete d’accordo: chi conosce la città capirebbe da che parte abita l’altra persona.</p>

      ${viste
        .map((o, i) => {
          const scelto = stato.scelte.includes(o.optionId);
          const deciso = stato.scelte.length > 0;
          return `
        <button class="opzione ritardo-${Math.min(i + 1, 4)}" data-opzione="${o.optionId}"
                data-scelta="${scelto ? 'si' : deciso ? 'no' : ''}">
          <span class="segno-scelta">${scelto ? stato.scelte.indexOf(o.optionId) + 1 : ''}</span>
          <span class="num">${esc(o.etichetta)}</span>
          <span class="riga-alta"><span class="tipo">${esc(o.tipo)}</span></span>
          <p class="atm">${esc(o.atmosfera)}</p>
          <span class="meta">
            <span class="viaggio">${esc(o.dal_tuo_punto_di_partenza)}</span>
            <span>rumore ${esc(o.rumore)}</span>
            <span>${esc(o.quando)}</span>
          </span>
        </button>`;
        })
        .join('')}

      <p class="nota">Tocca le opzioni in ordine di preferenza. L’altra persona vede le stesse tre, nello stesso ordine, con il proprio tempo di viaggio al posto del tuo.</p>

      <div class="azioni">
        <button class="btn" data-azione="conferma-luogo" ${stato.scelte.length === 0 ? 'disabled' : ''}>
          ${stato.scelte.length === 0 ? 'Scegli almeno un posto' : 'Manda le tue preferenze'}
        </button>
      </div>
    </div>`;
}

function vistaAttesa() {
  const c = stato.mia;
  const conto = mancanoA(c.quando.inizio);
  const riepilogo = summarizePlan(stato.piano);
  const spunti = c.icebreakers.inEvidenza.slice(0, 3);
  const tutteConfermate = riepilogo.conferme.every((cp) => cp.stato === 'confermato');

  return `
    <div class="schermata">
      <div class="conto ritardo-1">
        <div class="n">${esc(conto.n)}</div>
        <div class="e">${esc(conto.e)}</div>
      </div>

      <div class="carta-chiara ritardo-2">
        <div class="dove-quando">
          <div class="luogo">${esc(c.luogo.nome)}</div>
          <div class="via">${esc(c.luogo.indirizzo)}</div>
          <div class="ora">${esc(c.quando.ora)}</div>
          <div class="giorno">${esc(dataLeggibile(c.quando.inizio))}</div>
        </div>

        <div class="divisorio"></div>

        <div class="blocco">
          <i>Per riconoscervi</i>
          <div class="parola">
            <p>“${esc(c.riconoscimento.parolaChiave.apertura)}”</p>
            <p class="risposta">“${esc(c.riconoscimento.parolaChiave.risposta)}”</p>
          </div>
        </div>

        <div class="blocco" style="margin-top:18px">
          <div class="segno"><span class="p tu"></span><span><span class="l">Il tuo segno</span>${esc(c.riconoscimento.segnoVisivo.il_tuo)}</span></div>
          <div class="segno"><span class="p altro"></span><span><span class="l">Cerca questo</span>${esc(c.riconoscimento.segnoVisivo.quello_dell_altra_persona)}</span></div>
          <div class="segno"><span class="p" style="background:#b9ad97"></span><span><span class="l">Punto di ritrovo</span>${esc(c.riconoscimento.puntoDiRitrovo)}</span></div>
        </div>
      </div>

      <div class="pannello ritardo-3" style="margin-top:14px">
        <p class="occhiello muto">Conferme</p>
        ${riepilogo.conferme
          .map((cp) => {
            const fatto = cp.stato === 'confermato';
            const miaMancante = cp.mancano.includes(IO);
            return `
          <div class="tappa" data-stato="${fatto ? 'fatto' : 'attesa'}">
            <span class="cerchio">${fatto ? '✓' : ''}</span>
            <div class="testi">
              <div class="q">${esc(cp.quando)}</div>
              <div class="s">${fatto ? 'confermato da entrambi' : miaMancante ? 'tocca a te' : 'manca l’altra persona'}</div>
            </div>
            ${!fatto && miaMancante ? `<button class="btn piccolo stretto" data-azione="conferma" data-cp="${esc(cp.quando)}">Ci sono</button>` : ''}
          </div>`;
          })
          .join('')}
      </div>

      <div class="pannello ritardo-4">
        <p class="occhiello muto">Se si blocca, parti da qui</p>
        ${spunti.map((s) => `<div class="carta-spunto"><span class="cat">${esc(s.categoria)}</span><p>${esc(s.testo)}</p></div>`).join('')}
      </div>

      <div class="azioni">
        <button class="btn" data-azione="arrivato" ${tutteConfermate ? '' : 'disabled'}>
          ${tutteConfermate ? 'Sono arrivato' : 'Prima conferma tutte le tappe'}
        </button>
      </div>
      <p class="nota">Non esiste una chat fra voi. Quello che c’è da dire si dice lì.</p>
    </div>`;
}

function vistaSerata() {
  const minuti = Math.round(stato.secondi / 60);
  return `
    <div class="schermata">
      <p class="occhiello">In corso · minuto ${minuti}</p>
      <h1>Ci siete.<br><em>Il resto</em> lo fate voi.</h1>

      ${stato.serata.apertura ? `<div class="pannello"><p class="mono" style="line-height:1.7">${esc(stato.serata.apertura)}</p></div>` : ''}

      ${stato.momenti.length === 0 ? '<p class="testo piccolo">Il compagno resta in ascolto e interviene solo se serve.</p>' : ''}

      <div>${stato.momenti.map((m, i) => momento(m, i === stato.momenti.length - 1)).join('')}</div>

      ${stato.inCorso ? rispostaAperta() : ''}

      <div class="azioni doppia">
        <button class="btn fantasma" data-azione="${stato.timer ? 'pausa' : 'play'}" ${stato.inCorso ? 'disabled' : ''}>
          ${stato.timer ? 'Pausa' : 'Scorri la serata'}
        </button>
        <button class="btn piano" data-azione="chiudi-serata">Finisce qui</button>
      </div>
    </div>`;
}

function momento(a, ultimo = false) {
  const min = Math.round(a.t / 60);
  const nuovo = ultimo ? ' nuovo' : '';
  if (a.fonte === 'compagno') {
    return `<div class="momento${nuovo}" data-fonte="compagno">
      <span class="t">${min}′</span>
      <div><span class="f">il compagno</span>
        <div class="d">${esc(a.frase ?? '')}</div>
        ${a.carta ? `<div class="bolla"><p style="margin:0">${esc(a.carta.testo)}</p></div>` : ''}
      </div></div>`;
  }
  if (a.fonte === 'affetto') {
    const p = a.proposta;
    const esito = p.stato === 'accettata'
      ? '<div class="sotto">Ci state tutti e due.</div>'
      : p.stato === 'aperta'
        ? ''
        : '<div class="sotto">Per stavolta niente. Nessun motivo da cercare.</div>';
    return `<div class="momento${nuovo}" data-fonte="affetto">
      <span class="t">${min}′</span>
      <div><span class="f">momento</span>
        <div class="d">${esc(p.schermata.titolo)}</div>
        <div class="bolla affetto"><p style="margin:0">${esc(p.schermata.istruzione)}</p></div>
        ${esito}
      </div></div>`;
  }
  if (a.fonte === 'giochi') {
    const p = a.proposta;
    const esito = p.stato === 'finito'
      ? '<div class="sotto">Telefono giù. Il resto lo fate voi.</div>'
      : p.stato === 'rifiutata'
        ? '<div class="sotto">Niente gioco.</div>'
        : '';
    return `<div class="momento${nuovo}" data-fonte="giochi">
      <span class="t">${min}′</span>
      <div><span class="f">gioco · ${p.schermata.durataMin} min</span>
        <div class="d">${esc(p.schermata.titolo)}</div>
        <div class="bolla gioco"><p style="margin:0">${esc(p.schermata.premessa)}</p></div>
        ${esito}
      </div></div>`;
  }
  return '';
}

function rispostaAperta() {
  const a = stato.inCorso;
  const testo = a.fonte === 'affetto' ? a.proposta.schermata.cornice : a.proposta.schermata.uscita;
  return `
    <div class="pannello acceso">
      <p class="occhiello">${a.fonte === 'affetto' ? 'Solo sul tuo schermo' : 'Vi va?'}</p>
      <p class="testo piccolo" style="margin-bottom:14px">${esc(testo)}</p>
      <div class="azioni doppia" style="margin-top:0">
        <button class="btn" data-azione="accetta">${a.fonte === 'affetto' ? 'Mi va' : 'Giochiamo'}</button>
        <button class="btn fantasma" data-azione="rifiuta">Non ora</button>
      </div>
    </div>`;
}

function vistaDopo() {
  const d = buildDebrief(stato.chiusa.sessione, IO);
  const att = stato.chiusa.attenzione;
  return `
    <div class="schermata">
      <p class="occhiello">Il giorno dopo</p>
      <h1>Com’è andata,<br><em>solo per te.</em></h1>

      <div class="pannello ritardo-1">
        <p class="occhiello muto">Cosa ha funzionato</p>
        ${d.cosaHaFunzionato.map((r) => `<div class="riga-buona"><span class="p">+</span><p>${esc(r)}</p></div>`).join('')}
        ${
          d.daProvare
            ? `<div class="provare"><p class="oss">${esc(d.daProvare.osservazione)}</p><p class="pr">${esc(d.daProvare.prova)}</p></div>`
            : '<div class="provare"><p class="pr">Niente da correggere. Non inventiamo una critica per riempire lo spazio.</p></div>'
        }
        <p class="nota" style="margin-bottom:0">${esc(d.privacy)}</p>
      </div>

      <div class="pannello ritardo-2">
        <p class="occhiello muto">La serata in tre numeri</p>
        <div class="griglia-numeri">
          <div><div class="n">${stato.chiusa.sessione.metriche.risate}</div><span class="e">risate</span></div>
          <div><div class="n">${att.interruzioni}</div><span class="e">volte il telefono</span></div>
          <div><div class="n">${Math.round(stato.chiusa.autonomia * 100)}<span style="font-size:14px">%</span></div><span class="e">autonomia</span></div>
        </div>
      </div>

      <div class="pannello ritardo-3">
        <p class="occhiello muto">Vi scambiate un contatto?</p>
        <p class="testo piccolo">Lo vedrete solo se lo volete tutti e due, e non saprai mai cosa ha risposto l’altra persona.</p>
        <div class="azioni doppia" style="margin-top:6px">
          <button class="btn" data-azione="contatto-si">Sì</button>
          <button class="btn fantasma" data-azione="contatto-no">No</button>
        </div>
      </div>

      <div class="azioni">
        <button class="btn piano" data-azione="ricomincia">Ricomincia da capo</button>
      </div>
    </div>`;
}

function schermataProfilo() {
  const p = stato.io;
  return `
    <div class="schermata">
      <p class="occhiello">Il tuo profilo</p>
      <h1>Nessuna foto.<br><em>Nessun nome.</em></h1>
      <p class="testo piccolo">Chi ti viene abbinato vede cosa ti interessa e quando sei libero. Non vede dove abiti, e tu non vedrai dove abita lui.</p>

      <div class="pannello ritardo-1">
        <p class="occhiello muto">Interessi</p>
        <div class="tag-riga">${p.interests.map((t) => `<span class="tag acceso">${esc(bello(t))}</span>`).join('')}</div>
      </div>

      <div class="pannello ritardo-2">
        <p class="occhiello muto">Che serata cerchi</p>
        <div class="tag-riga">${p.vibes.map((t) => `<span class="tag freddo">${esc(bello(t))}</span>`).join('')}</div>
      </div>

      <div class="pannello ritardo-3">
        <p class="occhiello muto">Curiosità</p>
        ${p.curiosities.map((c) => `<div class="carta-spunto"><p>${esc(c)}</p></div>`).join('')}
        <p class="nota" style="margin-bottom:0">Queste finiscono nelle carte che legge l’altra persona. Per questo l’app rifiuta numeri, indirizzi e handle social.</p>
      </div>

      <div class="pannello ritardo-4">
        <p class="occhiello muto">Zona e spostamento</p>
        <div class="tappa" data-stato="fatto">
          <span class="cerchio">✓</span>
          <div class="testi">
            <div class="q">${esc(p.origin.label)}</div>
            <div class="s">fino a ${p.maxTravelKm} km · mai mostrata a nessuno</div>
          </div>
        </div>
      </div>
    </div>`;
}

function schermataSicurezza() {
  return `
    <div class="schermata">
      <p class="occhiello">Sempre attivo</p>
      <h1>Se qualcosa<br><em>non va.</em></h1>
      <p class="testo piccolo">Quasi tutto qui dentro è discreto: non produce nessun segnale visibile a chi ti sta di fronte.</p>

      <div class="pannello ritardo-1" style="padding-top:6px">
        ${SAFETY_ACTIONS.filter((a) => a.id !== 'arrivato')
          .map(
            (a) => `
          <button class="voce-sos ${a.id === 'emergenza' ? 'grave' : ''}" data-azione="sos" data-id="${a.id}">
            <span class="ic">${ICONA_SOS[a.id] ?? ICONE.scudo}</span>
            <span style="flex:1">
              <span class="t">${esc(a.etichetta)}</span>
              <span class="d">${esc(a.descrizione)}</span>
              ${a.discreto ? '<span class="discreto">discreto</span>' : ''}
            </span>
          </button>`,
          )
          .join('')}
      </div>

      ${
        stato.canale
          ? `<div class="pannello acceso ritardo-2">
              <p class="occhiello">${stato.canale.canale === 'operatore_umano' ? 'Operatore' : 'Assistente'}</p>
              <p class="testo" style="margin-bottom:10px">${esc(stato.canale.apertura)}</p>
              <p class="nota" style="margin:0">${esc(stato.canale.trasparenza)}</p>
            </div>`
          : ''
      }

      <div class="pannello ritardo-3">
        <p class="occhiello muto">Numeri presidiati adesso</p>
        <div class="numeri">
          ${EMERGENCY_RESOURCES.map(
            (r) => `<div class="numero">
              <span><div>${esc(r.nome)}</div><span class="q">${esc(r.quando)}</span></span>
              <span class="n">${esc(r.numero)}</span>
            </div>`,
          ).join('')}
        </div>
      </div>

      ${!stato.piano ? '<p class="nota">Le azioni legate a un incontro si attivano quando ne hai uno in programma.</p>' : ''}
    </div>`;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

function render() {
  const corpo =
    stato.scheda === 'oggi' ? schermataOggi() : stato.scheda === 'profilo' ? schermataProfilo() : schermataSicurezza();

  $('#corpo').innerHTML = (stato.avviso ? avvisoHtml() : '') + corpo;
  stato.avviso = null;

  for (const b of document.querySelectorAll('.barra button')) {
    b.setAttribute('aria-current', String(b.dataset.scheda === stato.scheda));
  }

  const data = stato.adesso.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  const ora = stato.adesso.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  $('#orologio').textContent = `${data} · ${ora}`;
}

function avvisoHtml() {
  return `<div class="avviso">${esc(stato.avviso)}</div>`;
}

// ---------------------------------------------------------------------------
// Interazioni
// ---------------------------------------------------------------------------

document.addEventListener('click', (evento) => {
  const scheda = evento.target.closest('.barra button');
  if (scheda) {
    stato.scheda = scheda.dataset.scheda;
    tocco();
    render();
    return;
  }

  const opzione = evento.target.closest('[data-opzione]');
  if (opzione) {
    const id = opzione.dataset.opzione;
    stato.scelte = stato.scelte.includes(id) ? stato.scelte.filter((x) => x !== id) : [...stato.scelte, id];
    tocco();
    render();
    return;
  }

  const bottone = evento.target.closest('[data-azione]');
  if (!bottone) return;
  tocco(12);
  azione(bottone.dataset.azione, bottone);
});

function azione(nome, bottone) {
  switch (nome) {
    case 'cerca':
      if (!cercaAbbinamento()) stato.avviso = 'Nessun abbinamento sopra soglia in questo momento.';
      break;

    case 'vai-luogo':
      stato.fase = 'luogo';
      break;

    case 'conferma-luogo': {
      const esito = confermaLuogo();
      if (!esito.ok) {
        stato.avviso = `${esito.motivo}. Si rilancia con altri tre locali.`;
        stato.scelte = [];
      }
      break;
    }

    case 'conferma': {
      const cp = stato.piano.checkpoints.find((c) => c.label === bottone.dataset.cp);
      if (!cp) break;
      // Si porta l'orologio alla finestra della conferma; l'altra persona
      // conferma subito dopo, perché in una demo non c'è nessuno dall'altra parte.
      stato.adesso = new Date(cp.dueAt.getTime() + 60000);
      confirmCheckpoint(stato.piano, IO, cp.id, { now: stato.adesso });
      confirmCheckpoint(stato.piano, stato.altro.id, cp.id, { now: stato.adesso });
      break;
    }

    case 'arrivato':
      stato.adesso = new Date(new Date(stato.card.quando.inizio).getTime() - 5 * 60000);
      checkIn(stato.piano, IO, { now: stato.adesso });
      checkIn(stato.piano, stato.altro.id, { now: stato.adesso });
      avviaSerata();
      break;

    case 'play':
      avviaOrologio();
      break;

    case 'pausa':
      fermaOrologio();
      break;

    case 'accetta':
    case 'rifiuta': {
      const accetta = nome === 'accetta';
      const a = stato.inCorso;
      const t = stato.secondi + 20;
      if (a.fonte === 'affetto') {
        rispondiAffetto(stato.serata, a.proposta.id, IO, { accetta, t });
        rispondiAffetto(stato.serata, a.proposta.id, stato.altro.id, { accetta: true, t });
      } else {
        rispondiGioco(stato.serata, a.proposta.id, IO, { accetta, t });
        if (accetta) {
          rispondiGioco(stato.serata, a.proposta.id, stato.altro.id, { accetta: true, t });
          chiudiGioco(stato.serata, a.proposta.id, { t: t + a.proposta.schermata.durataMin * 60 });
          stato.secondi += a.proposta.schermata.durataMin * 60;
        }
      }
      stato.inCorso = null;
      avviaOrologio();
      break;
    }

    case 'chiudi-serata':
      concludiSerata();
      break;

    case 'sos': {
      const id = bottone.dataset.id;
      if (id === 'supporto' && stato.piano) {
        stato.canale = openSupportChannel(stato.piano, {
          utente: IO,
          motivo: stato.fase === 'serata' ? 'disagio_durante' : 'ansia_pre_date',
          now: stato.adesso,
        });
      } else if (id === 'emergenza') {
        stato.avviso = 'Chiamata al 112. La posizione del locale è già pronta da leggere.';
      } else {
        stato.avviso = 'Fatto, in silenzio. Nessun segnale all’altra persona.';
      }
      break;
    }

    case 'contatto-si':
    case 'contatto-no':
      stato.avviso =
        nome === 'contatto-si'
          ? 'Segnato. Se anche l’altra persona vuole, vi arriva il contatto.'
          : 'Segnato, e non lo saprà nessuno.';
      break;

    case 'ricomincia':
      fermaOrologio();
      Object.assign(stato, {
        fase: 'ricerca',
        adesso: new Date(INIZIO_SIMULAZIONE),
        altro: null, valutazione: null, proposta: null, scelte: [],
        card: null, mia: null, piano: null, serata: null,
        secondi: 0, momenti: [], inCorso: null, chiusa: null, canale: null,
      });
      break;

    case 'avanti-tempo':
      stato.adesso = new Date(stato.adesso.getTime() + 6 * 3600000);
      break;

    default:
      break;
  }
  render();
}

// ---------------------------------------------------------------------------
// Avvio
// ---------------------------------------------------------------------------

$('#barra').innerHTML = [
  ['oggi', 'Oggi', ICONE.oggi],
  ['profilo', 'Profilo', ICONE.profilo],
  ['sicurezza', 'Sicurezza', ICONE.scudo],
]
  .map(
    ([id, testo, icona]) =>
      `<button data-scheda="${id}" class="${id === 'sicurezza' ? 'sos' : ''}">${icona}<span>${testo}</span></button>`,
  )
  .join('');

render();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/web/sw.js').catch(() => {});
}
