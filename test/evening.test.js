import test from 'node:test';
import assert from 'node:assert/strict';

import {
  chiudiGioco,
  closeEvening,
  createEvening,
  rispondiAffetto,
  rispondiGioco,
  snapshotEvening,
  tickEvening,
  zittisci,
} from '../src/evening.js';

const CARD = {
  matchId: 'match-test',
  partecipanti: ['u-aaa', 'u-bbb'],
  quando: { inizio: '2026-08-13T19:00:00+02:00', durata_minuti: 120 },
  icebreakers: {
    mazzo: Array.from({ length: 40 }, (_, i) => ({
      id: `ice-${i}`,
      categoria: ['dilemma', 'contatto', 'gioco', 'abitudini'][i % 4],
      testo: `Carta numero ${i}`,
      origine: i % 2 ? 'mazzo base' : 'interesse condiviso: viaggi',
    })),
  },
};

const tuttoSi = {
  compagno: { 'u-aaa': true, 'u-bbb': true },
  affetto: { 'u-aaa': true, 'u-bbb': true },
  giochi: { 'u-aaa': true, 'u-bbb': true },
};

const serata = (opts = {}) => createEvening(CARD, { consensi: tuttoSi, ...opts });

const tick = (over = {}) => ({
  t: 1800,
  silenzioSec: 1,
  quotaParlato: 0.5,
  energia: 0.5,
  risate: 0,
  domande: 0,
  rischio: 'nessuno',
  ...over,
});

/**
 * Fa scorrere la serata finche' una fase non produce un'azione, e si ferma li.
 * Serve perche' le proposte scadono: guidare tutta la serata e rispondere alla
 * fine significa rispondere a una proposta gia' decaduta.
 */
function scorriFinoA(evening, fonte, { da = 300, a = 110 * 60, passo = 30, clima = () => ({}) } = {}) {
  for (let sec = da; sec < a; sec += passo) {
    const esito = tickEvening(evening, tick({ t: sec, ...clima(sec / 60) }));
    const trovata = esito.azioni.find((x) => x.fonte === fonte && x.tipo === 'proposta');
    if (trovata) return trovata;
  }
  return null;
}

/** Fa scorrere la serata e raccoglie tutte le azioni prodotte. */
function scorri(evening, { da = 300, a = 110 * 60, passo = 60, clima = () => ({}) } = {}) {
  const azioni = [];
  for (let sec = da; sec < a; sec += passo) {
    const esito = tickEvening(evening, tick({ t: sec, ...clima(sec / 60) }));
    azioni.push(...esito.azioni);
  }
  return azioni;
}

// --- Consensi separati ------------------------------------------------------

test('ogni funzione ha il suo consenso: accettarne una non le accetta tutte', () => {
  const e = createEvening(CARD, {
    consensi: { compagno: { 'u-aaa': true, 'u-bbb': true } },
  });
  assert.equal(e.attive.compagno, true);
  assert.equal(e.attive.affetto, false);
  assert.equal(e.attive.giochi, false);
});

test('senza nessun consenso la serata gira senza chiedere niente', () => {
  const e = createEvening(CARD, { consensi: {} });
  assert.deepEqual(scorri(e), []);
});

// --- Precedenze -------------------------------------------------------------

test('una sola cosa alla volta arriva al tavolo', () => {
  const e = serata();
  for (let sec = 300; sec < 110 * 60; sec += 30) {
    const { azioni } = tickEvening(e, tick({ t: sec, silenzioSec: 25, risate: 2, energia: 0.55 }));
    assert.ok(azioni.length <= 1, `${azioni.length} interruzioni nello stesso istante`);
  }
});

test('la sicurezza scavalca tutto e non produce niente di visibile', () => {
  const e = serata();
  const esito = tickEvening(e, tick({ rischio: 'allarme', silenzioSec: 30 }));
  assert.ok(esito.sicurezza);
  assert.deepEqual(esito.azioni, [], 'niente compare al tavolo');
  assert.equal(esito.stato, 'allerta');
});

test('un allarme spegne affetto e giochi per il resto della serata', () => {
  const e = serata();
  tickEvening(e, tick({ t: 600, rischio: 'disagio' }));
  assert.equal(e.affetto.bloccatoPerSicurezza, true);
  assert.equal(e.giochi.bloccatoPerSicurezza, true);

  const dopo = scorri(e, { da: 2400, clima: () => ({ energia: 0.7, risate: 3 }) });
  assert.ok(!dopo.some((x) => x.fonte === 'affetto' || x.fonte === 'giochi'));
});

test('una richiesta esplicita passa sempre e non consuma il budget', () => {
  const e = serata();
  const speso = e.attenzione.pesoSpeso;
  const { azioni } = tickEvening(e, tick({ richiestaDa: 'u-aaa' }));
  assert.equal(azioni.length, 1);
  assert.equal(azioni[0].richiesto, true);
  assert.equal(e.attenzione.pesoSpeso, speso, 'cio che chiedono loro non e un interruzione');
});

test('quando il clima e caldo l affetto ha la precedenza sulla battuta', () => {
  const e = serata();
  // Clima caldo: il compagno vorrebbe una battuta, l affetto una proposta.
  const azioni = scorri(e, {
    da: 2400,
    a: 3600,
    passo: 30,
    clima: () => ({ energia: 0.7, risate: 3, silenzioSec: 1 }),
  });
  assert.ok(azioni.length > 0);
  assert.equal(azioni[0].fonte, 'affetto', 'un momento caldo passa, una battuta puo aspettare');
});

// --- Escalation dei giochi --------------------------------------------------

test('nessun gioco prima che le mosse leggere abbiano fallito', () => {
  const e = createEvening(CARD, {
    consensi: { compagno: tuttoSi.compagno, giochi: tuttoSi.giochi },
  });
  // Serata piatta ma senza silenzi: il compagno non rilancia, quindi il gioco
  // non deve nemmeno essere preso in considerazione.
  const azioni = scorri(e, { clima: () => ({ energia: 0.4, silenzioSec: 2 }) });
  assert.ok(!azioni.some((x) => x.fonte === 'giochi'));
});

test('dopo due rilanci a vuoto il gioco diventa ammissibile', () => {
  const e = createEvening(CARD, {
    consensi: { compagno: tuttoSi.compagno, giochi: tuttoSi.giochi },
  });
  const azioni = scorri(e, {
    passo: 30,
    clima: (min) => (min < 45 ? { energia: 0.3, silenzioSec: 25 } : { energia: 0.4, silenzioSec: 4 }),
  });
  const carte = azioni.filter((x) => x.fonte === 'compagno');
  const giochi = azioni.filter((x) => x.fonte === 'giochi');
  assert.ok(carte.length >= 2);
  assert.ok(giochi.length >= 1, 'dopo i rilanci il gioco deve poter arrivare');
  assert.ok(
    azioni.indexOf(giochi[0]) > azioni.indexOf(carte[1]),
    'il gioco arriva dopo, mai prima',
  );
});

// --- Budget condiviso -------------------------------------------------------

test('il budget vale per tutte le fasi, non solo per una', () => {
  const e = serata();
  scorri(e, { passo: 30, clima: (min) => (min % 10 < 5
    ? { energia: 0.3, silenzioSec: 30 }
    : { energia: 0.6, risate: 3, silenzioSec: 1 }) });
  const r = e.attenzione;
  assert.ok(r.pesoSpeso <= r.maxPeso, `budget sforato: ${r.pesoSpeso}/${r.maxPeso}`);
  assert.ok(Object.keys(e.log.reduce((acc, x) => ({ ...acc, [x.fonte]: 1 }), {})).length >= 2);
});

test('una proposta aperta tiene il turno, una carta no', () => {
  const conProposta = serata();
  const proposta = scorriFinoA(conProposta, 'affetto', {
    da: 2400,
    clima: () => ({ energia: 0.7, risate: 3 }),
  });
  assert.ok(proposta, 'serve una proposta di affetto per il test');
  assert.equal(conProposta.attenzione.occupatoDa, 'affetto');

  // Una carta invece si consuma nell istante in cui viene mostrata.
  const conCarta = createEvening(CARD, { consensi: { compagno: tuttoSi.compagno } });
  let vista = null;
  for (let sec = 300; sec < 3600 && !vista; sec += 30) {
    const esito = tickEvening(conCarta, tick({ t: sec, silenzioSec: 25, energia: 0.3 }));
    vista = esito.azioni.find((x) => x.fonte === 'compagno');
  }
  assert.ok(vista);
  assert.equal(conCarta.attenzione.occupatoDa, null);
});

test('rispondere a una proposta libera il turno', () => {
  const e = serata();
  const azione = scorriFinoA(e, 'affetto', { da: 2400, clima: () => ({ energia: 0.7, risate: 3 }) });
  assert.ok(azione);
  assert.equal(e.attenzione.occupatoDa, 'affetto');

  const t = azione.proposta.t;
  rispondiAffetto(e, azione.proposta.id, 'u-aaa', { accetta: true, t: t + 10 });
  rispondiAffetto(e, azione.proposta.id, 'u-bbb', { accetta: false, t: t + 20 });
  assert.equal(e.attenzione.occupatoDa, null);
});

test('il turno resta preso per tutta la durata di una partita', () => {
  const e = createEvening(CARD, {
    consensi: { compagno: tuttoSi.compagno, giochi: tuttoSi.giochi },
  });
  const azione = scorriFinoA(e, 'giochi', {
    clima: (min) => (min < 45 ? { energia: 0.3, silenzioSec: 25 } : { energia: 0.4, silenzioSec: 4 }),
  });
  assert.ok(azione, 'serve una proposta di gioco per il test');
  const { proposta } = azione;

  rispondiGioco(e, proposta.id, 'u-aaa', { accetta: true, t: proposta.t + 10 });
  rispondiGioco(e, proposta.id, 'u-bbb', { accetta: true, t: proposta.t + 20 });
  assert.equal(e.attenzione.occupatoDa, 'giochi', 'durante il gioco il telefono e occupato');

  chiudiGioco(e, proposta.id, { t: proposta.t + 600 });
  assert.equal(e.attenzione.occupatoDa, null);
});

test('un gioco rifiutato libera subito il turno', () => {
  const e = createEvening(CARD, {
    consensi: { compagno: tuttoSi.compagno, giochi: tuttoSi.giochi },
  });
  const azione = scorriFinoA(e, 'giochi', {
    clima: (min) => (min < 45 ? { energia: 0.3, silenzioSec: 25 } : { energia: 0.4, silenzioSec: 4 }),
  });
  assert.ok(azione);
  rispondiGioco(e, azione.proposta.id, 'u-aaa', { accetta: false, t: azione.proposta.t + 10 });
  assert.equal(e.attenzione.occupatoDa, null);
});

test('il compagno rinuncia invece di accodarsi quando il telefono e occupato', () => {
  const e = serata();
  scorri(e, { passo: 20, clima: () => ({ energia: 0.6, risate: 3, silenzioSec: 20 }) });
  const rinunce = e.log.filter((x) => x.tipo === 'rinunciato');
  assert.ok(rinunce.length > 0, 'una carta buona fra dieci minuti non e piu la stessa carta');
});

test('zittire il compagno non tocca le altre funzioni', () => {
  const e = serata();
  zittisci(e, true);
  const azioni = scorri(e, { da: 2400, a: 3600, passo: 30, clima: () => ({ energia: 0.7, risate: 3 }) });
  assert.ok(!azioni.some((x) => x.fonte === 'compagno'));
  assert.ok(azioni.some((x) => x.fonte === 'affetto'), 'l affetto ha un interruttore suo');
});

// --- Chiusura e stato -------------------------------------------------------

test('la chiusura raccoglie tutto quello che serve al debrief', () => {
  const e = serata();
  scorri(e, { passo: 30, clima: () => ({ energia: 0.4, silenzioSec: 20 }) });
  const chiusa = closeEvening(e, { durataEffettivaMin: 95 });
  assert.equal(chiusa.sessione.durataMin, 95);
  assert.ok(chiusa.attenzione.interruzioni >= 1);
  assert.ok(chiusa.autonomia >= 0 && chiusa.autonomia <= 1);
  assert.ok('momentiCondivisi' in chiusa.affetto);
  assert.ok('giocati' in chiusa.giochi);
});

test('meno il telefono e servito, piu alta e l autonomia', () => {
  const tranquilla = serata({ seed: 'calma' });
  scorri(tranquilla, { clima: () => ({ energia: 0.85, silenzioSec: 1 }) });

  const faticosa = serata({ seed: 'fatica' });
  scorri(faticosa, { passo: 30, clima: () => ({ energia: 0.3, silenzioSec: 30 }) });

  assert.ok(closeEvening(tranquilla).autonomia > closeEvening(faticosa).autonomia);
});

test('lo stato della serata e serializzabile', () => {
  const e = serata();
  scorri(e, { passo: 60, clima: () => ({ energia: 0.4, silenzioSec: 20 }) });
  const snapshot = snapshotEvening(e);
  const json = JSON.stringify(snapshot);
  assert.ok(json.length > 0);
  // Lo stato dei generatori deve essere dentro, altrimenti dopo un riavvio i
  // due telefoni vedrebbero cose diverse.
  assert.equal(typeof snapshot.rng.compagno, 'number');
  assert.equal(typeof snapshot.rng.affetto, 'number');
  assert.equal(typeof snapshot.rng.giochi, 'number');
  assert.deepEqual(JSON.parse(json).log.length, e.log.length);
});

test('lo snapshot non contiene funzioni', () => {
  const e = serata();
  scorri(e, { passo: 120 });
  const cerca = (valore) => {
    if (typeof valore === 'function') return true;
    if (valore && typeof valore === 'object') return Object.values(valore).some(cerca);
    return false;
  };
  assert.equal(cerca(snapshotEvening(e)), false);
});
