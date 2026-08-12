import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closeCompanionSession,
  createCompanionSession,
  observe,
  setMuto,
  sogliaSilenzio,
} from '../src/phase5-companion.js';
import {
  APERTURA,
  BATTUTE,
  CHIUSURA,
  RIEQUILIBRIO,
  RILANCIO_SILENZIO,
  SU_RICHIESTA,
  VIETATE,
} from '../src/data/companion-lines.js';

const CARD = {
  matchId: 'match-test',
  partecipanti: ['u-aaa', 'u-bbb'],
  quando: { inizio: '2026-08-13T19:00:00+02:00', durata_minuti: 120 },
  icebreakers: {
    mazzo: Array.from({ length: 30 }, (_, i) => ({
      id: `ice-${i}`,
      categoria: ['dilemma', 'contatto', 'gioco', 'abitudini'][i % 4],
      testo: `Carta numero ${i}`,
      origine: i % 2 ? 'mazzo base' : 'interesse condiviso: viaggi',
    })),
  },
};

const consensoPieno = { 'u-aaa': true, 'u-bbb': true };
const sessione = (opts = {}) =>
  createCompanionSession(CARD, { consenso: consensoPieno, ...opts });

/** Tick "neutro": conversazione viva, niente da fare. */
const tick = (over = {}) => ({
  t: 600,
  silenzioSec: 1,
  quotaParlato: 0.5,
  energia: 0.5,
  risate: 0,
  domande: 0,
  rischio: 'nessuno',
  ...over,
});

// --- Consenso ---------------------------------------------------------------

test('senza il consenso di entrambi il compagno non si accende', () => {
  const s = createCompanionSession(CARD, { consenso: { 'u-aaa': true } });
  assert.equal(s.attivo, false);
  assert.equal(s.modo, 'spento');
  assert.deepEqual(s.mancanti, ['u-bbb']);
});

test('un compagno spento non elabora nessun segnale', () => {
  const s = createCompanionSession(CARD, { consenso: {} });
  const esito = observe(s, tick({ silenzioSec: 60 }));
  assert.equal(esito.stato, 'spento');
  assert.equal(esito.intervento, null);
  assert.equal(s.osservazioni.tick, 0, 'nemmeno gli aggregati vengono raccolti');
});

test('con il consenso di entrambi si accende e dichiara le garanzie', () => {
  const s = sessione();
  assert.equal(s.attivo, true);
  assert.ok(APERTURA.includes(s.apertura));
  assert.ok(s.garanzie.some((g) => /non esce dal telefono/i.test(g)));
  assert.ok(s.garanzie.some((g) => /solo numeri/i.test(g)));
  assert.ok(s.indicatore.includes('spia accesa'));
});

test('di default scrive sullo schermo, non parla ad alta voce', () => {
  assert.equal(sessione().modo, 'schermo');
  assert.equal(sessione({ modo: 'voce' }).modo, 'voce');
});

// --- Sicurezza --------------------------------------------------------------

test('un allarme scavalca tutto e non passa mai dal tavolo', () => {
  const s = sessione();
  const esito = observe(s, tick({ rischio: 'allarme' }));
  assert.ok(esito.sicurezza);
  assert.equal(esito.sicurezza.motivoSupporto, 'mi_sento_in_pericolo');
  assert.equal(esito.sicurezza.visibileAlTavolo, false);
  assert.equal(esito.intervento, null, 'niente viene detto ad alta voce');
});

test('il disagio instrada verso il supporto della Fase 4', () => {
  const s = sessione();
  const esito = observe(s, tick({ rischio: 'disagio' }));
  assert.equal(esito.sicurezza.motivoSupporto, 'disagio_durante');
});

test('la sicurezza funziona anche a compagno zittito', () => {
  const s = sessione();
  setMuto(s, true);
  assert.ok(observe(s, tick({ rischio: 'allarme' })).sicurezza);
});

// --- Quando parlare ---------------------------------------------------------

test('la soglia del silenzio cresce con il passare della serata', () => {
  assert.ok(sogliaSilenzio(0) < sogliaSilenzio(30));
  assert.ok(sogliaSilenzio(30) < sogliaSilenzio(60));
  assert.ok(sogliaSilenzio(0) >= 7);
  assert.ok(sogliaSilenzio(120) <= 20);
});

test('lo stesso silenzio e imbarazzante presto e accettabile tardi', () => {
  const presto = sessione();
  assert.ok(observe(presto, tick({ t: 300, silenzioSec: 12 })).intervento);

  const tardi = sessione();
  const esito = observe(tardi, tick({ t: 3300, silenzioSec: 12 }));
  assert.equal(esito.intervento, null);
  assert.equal(esito.stato, 'in_ascolto');
});

test('non interrompe chi sta raccontando', () => {
  const s = sessione();
  const esito = observe(s, tick({ energia: 0.9, silenzioSec: 0 }));
  assert.equal(esito.stato, 'non_interrompo');
});

test('dopo un intervento resta zitto per il cooldown', () => {
  const s = sessione();
  assert.ok(observe(s, tick({ t: 300, silenzioSec: 15 })).intervento);
  const subito = observe(s, tick({ t: 400, silenzioSec: 15 }));
  assert.equal(subito.intervento, null);
  assert.equal(subito.stato, 'in_pausa');
});

test('il cooldown si allunga a ogni intervento: il compagno si fa da parte', () => {
  const s = sessione();
  const istanti = [];
  for (let t = 300; t < 7200; t += 30) {
    if (observe(s, tick({ t, silenzioSec: 25 })).intervento) istanti.push(t);
  }
  assert.ok(istanti.length >= 3);
  const primoIntervallo = istanti[1] - istanti[0];
  const ultimoIntervallo = istanti[istanti.length - 1] - istanti[istanti.length - 2];
  assert.ok(
    ultimoIntervallo > primoIntervallo,
    `gli intervalli devono crescere (${primoIntervallo} -> ${ultimoIntervallo})`,
  );
});

test('il budget di interventi non richiesti e limitato', () => {
  const s = sessione();
  for (let t = 300; t < 20000; t += 30) observe(s, tick({ t, silenzioSec: 25 }));
  const spontanei = s.interventi.filter((i) => !i.richiesto && !i.silenzioso);
  assert.ok(spontanei.length <= 6, `troppi interventi: ${spontanei.length}`);
});

test('una richiesta esplicita ha sempre risposta, anche in cooldown', () => {
  const s = sessione();
  observe(s, tick({ t: 300, silenzioSec: 15 }));
  const esito = observe(s, tick({ t: 360, richiestaDa: 'u-aaa' }));
  assert.ok(esito.intervento);
  assert.equal(esito.intervento.tipo, 'su_richiesta');
  assert.ok(esito.intervento.carta);
  assert.ok(SU_RICHIESTA.includes(esito.intervento.frase));
});

test('zittito, il compagno tace anche davanti a un silenzio lungo', () => {
  const s = sessione();
  setMuto(s, true);
  const esito = observe(s, tick({ t: 600, silenzioSec: 40 }));
  assert.equal(esito.intervento, null);
  assert.equal(esito.stato, 'muto');
});

// --- Tipi di intervento -----------------------------------------------------

test('il silenzio lungo produce un rilancio con una carta', () => {
  const s = sessione();
  const intervento = observe(s, tick({ t: 300, silenzioSec: 15 })).intervento;
  assert.equal(intervento.tipo, 'rilancio');
  assert.ok(RILANCIO_SILENZIO.includes(intervento.frase));
  assert.ok(intervento.carta.testo.length > 0);
});

test('uno squilibrio prolungato dei turni gira la carta a chi ascolta', () => {
  const s = sessione();
  let intervento = null;
  for (let t = 300; t <= 600 && !intervento; t += 60) {
    intervento = observe(s, tick({ t, quotaParlato: 0.85, energia: 0.5 })).intervento;
  }
  assert.ok(intervento, 'lo squilibrio deve produrre un intervento');
  assert.equal(intervento.tipo, 'riequilibrio');
  assert.ok(RIEQUILIBRIO.includes(intervento.frase));
});

test('lo squilibrio non scatta al primo tick', () => {
  const s = sessione();
  assert.equal(observe(s, tick({ quotaParlato: 0.9 })).intervento, null);
});

test('la battuta arriva solo se si sta gia ridendo', () => {
  const tesa = sessione();
  const senzaRisate = observe(tesa, tick({ t: 900, risate: 0, energia: 0.5, silenzioSec: 1 }));
  assert.equal(senzaRisate.intervento, null);

  const allegra = sessione();
  const conRisate = observe(allegra, tick({ t: 900, risate: 3, energia: 0.6, silenzioSec: 1 }));
  assert.equal(conRisate.intervento.tipo, 'battuta');
  assert.ok(BATTUTE.includes(conRisate.intervento.frase));
});

test('mai una battuta dentro un silenzio teso', () => {
  const s = sessione();
  const esito = observe(s, tick({ t: 900, silenzioSec: 20, risate: 0, energia: 0.1 }));
  assert.notEqual(esito.intervento?.tipo, 'battuta');
});

test('le battute sono contingentate', () => {
  const s = sessione();
  for (let t = 900; t < 20000; t += 60) {
    observe(s, tick({ t, risate: 2, energia: 0.6, silenzioSec: 1 }));
  }
  assert.ok(s.interventi.filter((i) => i.tipo === 'battuta').length <= 2);
});

test('a fine serata spenta propone la chiusura, una volta sola', () => {
  const s = sessione();
  let chiusure = 0;
  for (let t = 5500; t < 9000; t += 60) {
    const esito = observe(s, tick({ t, energia: 0.1, silenzioSec: 30 }));
    if (esito.intervento?.tipo === 'chiusura') chiusure += 1;
  }
  assert.equal(chiusure, 1);
  assert.ok(CHIUSURA.some((c) => /nessuno dei due deve dirlo per primo|si continua|si va/.test(c)));
});

test('non ripete mai la stessa carta', () => {
  const s = sessione();
  for (let t = 300; t < 20000; t += 30) {
    observe(s, tick({ t, silenzioSec: 25 }));
    observe(s, tick({ t: t + 5, richiestaDa: 'u-aaa' }));
  }
  const usate = s.interventi.filter((i) => i.carta).map((i) => i.carta.id);
  assert.equal(new Set(usate).size, usate.length);
});

// --- Tono -------------------------------------------------------------------

test('nessuna frase del compagno giudica le due persone', () => {
  const tutte = [...APERTURA, ...RILANCIO_SILENZIO, ...RIEQUILIBRIO, ...SU_RICHIESTA, ...BATTUTE, ...CHIUSURA];
  for (const frase of tutte) {
    for (const vietata of VIETATE) {
      assert.ok(!vietata.test(frase), `frase vietata: "${frase}"`);
    }
  }
});

test('il riequilibrio non nomina nessuno e non accusa chi parla poco', () => {
  for (const frase of RIEQUILIBRIO) {
    assert.ok(!/u-|tu che/i.test(frase));
    assert.ok(!/parli poco|stai zitt/i.test(frase));
  }
});

// --- Chiusura della sessione ------------------------------------------------

test('la chiusura restituisce metriche e dichiara cancellati i segnali grezzi', () => {
  const s = sessione();
  for (let t = 300; t < 3600; t += 60) {
    observe(s, tick({ t, silenzioSec: 4, risate: t % 300 === 0 ? 1 : 0, domande: 1 }));
  }
  const chiusa = closeCompanionSession(s, { durataEffettivaMin: 95 });
  assert.equal(chiusa.durataMin, 95);
  assert.ok(chiusa.metriche.risate > 0);
  assert.ok(chiusa.metriche.domande > 0);
  assert.equal(chiusa.segnaliGrezziCancellati, true);
  assert.ok(chiusa.interventi.every((i) => !i.silenzioso), 'niente eventi interni nel riepilogo');
});

test('la sessione chiusa non contiene testo della conversazione', () => {
  const s = sessione();
  for (let t = 300; t < 3600; t += 60) observe(s, tick({ t, silenzioSec: 20 }));
  const chiusa = closeCompanionSession(s);
  const { chiavi } = (function raccogli(value, chiavi = new Set()) {
    if (Array.isArray(value)) value.forEach((v) => raccogli(v, chiavi));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        chiavi.add(k);
        raccogli(v, chiavi);
      }
    }
    return { chiavi };
  })(chiusa);
  for (const vietata of ['audio', 'trascrizione', 'transcript', 'testoDetto', 'registrazione']) {
    assert.ok(!chiavi.has(vietata));
  }
});
