import test from 'node:test';
import assert from 'node:assert/strict';

import {
  affidabilita,
  blocchiDiReputazione,
  fattoreAffidabilita,
  percorsoDiRientro,
  prioritaDiRecupero,
  SOGLIA_BLOCCO,
} from '../src/reputation.js';
import { evaluateMatch, rankCandidates, sogliaAdattiva } from '../src/phase1-compatibility.js';
import { sampleProfile } from '../src/data/sample-profiles.js';

const A = () => sampleProfile('u-7f3a');
const B = () => sampleProfile('u-91cd');

// --- Affidabilita' ----------------------------------------------------------

test('un profilo nuovo parte affidabile, non sospetto', () => {
  const { valore, nuovo } = affidabilita();
  assert.equal(valore, 1);
  assert.equal(nuovo, true);
});

test('chi onora sempre gli incontri resta in alto', () => {
  assert.ok(affidabilita({ incontriFissati: 6, incontriOnorati: 6 }).valore >= 0.95);
});

test('annullare per tempo costa molto meno che non presentarsi', () => {
  const corretto = affidabilita({ incontriFissati: 4, incontriOnorati: 3, annullamentiPerTempo: 1 });
  const assente = affidabilita({ incontriFissati: 4, incontriOnorati: 3, noShow: 1 });
  assert.ok(corretto.valore > assente.valore);
  assert.ok(corretto.valore >= 0.75, 'disdire in tempo e un comportamento corretto');
});

test('i no-show ripetuti portano sotto la soglia di blocco', () => {
  const { valore } = affidabilita({ incontriFissati: 4, incontriOnorati: 1, noShow: 3 });
  assert.ok(valore < SOGLIA_BLOCCO, `atteso sotto ${SOGLIA_BLOCCO}, ottenuto ${valore}`);
});

test('le segnalazioni confermate non si compensano con la puntualita', () => {
  const { valore } = affidabilita({
    incontriFissati: 20,
    incontriOnorati: 20,
    segnalazioniRicevute: 1,
  });
  assert.ok(valore <= 0.3);
});

test('il fattore vale 1 quando entrambi sono nuovi o affidabili', () => {
  assert.equal(fattoreAffidabilita(), 1);
  assert.equal(fattoreAffidabilita({ incontriFissati: 3, incontriOnorati: 3 }, undefined), 1);
});

test('il fattore penalizza ma non ribalta la classifica', () => {
  const f = fattoreAffidabilita({ incontriFissati: 4, incontriOnorati: 2, noShow: 1 }, undefined);
  assert.ok(f < 1);
  assert.ok(f >= 0.85, 'l affidabilita pesa, ma non e l unica cosa che conta');
});

test('il percorso di rientro esiste e non e un condono', () => {
  const storico = { incontriFissati: 4, incontriOnorati: 1, noShow: 3 };
  const rientro = percorsoDiRientro(storico);
  assert.equal(rientro.necessario, true);
  assert.equal(rientro.passi.length, 3);
  assert.match(rientro.messaggio, /non e una condanna/i);
  assert.equal(percorsoDiRientro({ incontriFissati: 3, incontriOnorati: 3 }).necessario, false);
});

test('chi ha subito un buco passa avanti in coda', () => {
  assert.equal(prioritaDiRecupero(), 1);
  assert.ok(prioritaDiRecupero({ noShowSubiti: 1 }) > 1);
  assert.ok(prioritaDiRecupero({ noShowSubiti: 10 }) <= 2.5, 'la priorita e limitata');
});

// --- Integrazione con la Fase 1 --------------------------------------------

test('un profilo sotto soglia non viene abbinato a nessuno', () => {
  const a = A();
  const b = B();
  b.storico = { incontriFissati: 4, incontriOnorati: 1, noShow: 3 };
  const ev = evaluateMatch(a, b);
  assert.equal(ev.eligible, false);
  assert.ok(ev.blockers.some((x) => /saltati/i.test(x)));
});

test('senza storico il punteggio resta identico a prima', () => {
  const conStorico = evaluateMatch(A(), { ...B(), storico: { incontriFissati: 5, incontriOnorati: 5 } });
  assert.equal(evaluateMatch(A(), B()).score, conStorico.score);
});

test('lo storico peggiore abbassa il punteggio del match', () => {
  const pulito = evaluateMatch(A(), B()).score;
  const b = B();
  b.storico = { incontriFissati: 6, incontriOnorati: 3, annullamentiTardivi: 2 };
  const sporco = evaluateMatch(A(), b);
  assert.ok(sporco.score < pulito);
  assert.ok(sporco.affidabilita.fattore < 1);
});

test('due persone che si sono gia incontrate non vengono riproposte', () => {
  const a = A();
  const b = B();
  a.incontriPrecedenti = [b.id];
  const ev = evaluateMatch(a, b);
  assert.equal(ev.eligible, false);
  assert.ok(ev.blockers.some((x) => /gia incontrate/i.test(x)));
});

test('il blocco vale anche se lo storico e registrato solo da una parte', () => {
  const a = A();
  const b = B();
  b.incontriPrecedenti = [a.id];
  assert.equal(evaluateMatch(a, b).eligible, false);
});

// --- Soglia adattiva --------------------------------------------------------

test('con abbastanza candidati sopra soglia non si abbassa niente', () => {
  const esito = sogliaAdattiva([88, 84, 81, 60]);
  assert.equal(esito.soglia, 80);
  assert.equal(esito.adattata, false);
});

test('con una citta vuota la soglia scende quel tanto che basta', () => {
  const esito = sogliaAdattiva([76, 72, 55]);
  assert.equal(esito.adattata, true);
  assert.equal(esito.soglia, 72, 'scende fino al secondo candidato, non oltre');
  assert.match(esito.motivo, /densita insufficiente/i);
});

test('la soglia non scende mai sotto il pavimento', () => {
  const esito = sogliaAdattiva([50, 40, 30]);
  assert.ok(esito.soglia >= 65);
});

test('la soglia adattiva non serve se i candidati sono pochissimi', () => {
  const esito = sogliaAdattiva([70]);
  assert.equal(esito.adattata, false);
  assert.match(esito.motivo, /troppo pochi/i);
});

test('rankCandidates adattivo propone qualcosa dove quello fisso non trova nulla', () => {
  const candidati = ['u-2b60', 'u-8d55'].map(sampleProfile);
  const fisso = rankCandidates(A(), candidati);
  const adattivo = rankCandidates(A(), candidati, { adattiva: true, obiettivo: 1 });
  assert.equal(fisso.length, 0);
  assert.ok(adattivo.length >= 1);
  assert.equal(adattivo.adattamento.adattata, true);
});

test('anche in modalita adattiva i gate restano gate', () => {
  const candidati = ['u-4e12'].map(sampleProfile); // nessuna finestra in comune
  const esito = rankCandidates(A(), candidati, { adattiva: true, obiettivo: 3 });
  assert.equal(esito.length, 0, 'un match impossibile resta impossibile');
});
