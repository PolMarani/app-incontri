import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMatch, rankCandidates } from '../src/phase1-compatibility.js';
import { sampleProfile } from '../src/data/sample-profiles.js';
import { overlappingWindows, totalOverlapMinutes } from '../src/util/time.js';

const A = () => sampleProfile('u-7f3a');
const B = () => sampleProfile('u-91cd');

test('una coppia ben assortita supera la soglia dell 80%', () => {
  const ev = evaluateMatch(A(), B());
  assert.equal(ev.eligible, true);
  assert.equal(ev.proceed, true);
  assert.ok(ev.score >= 80, `atteso >= 80, ottenuto ${ev.score}`);
  assert.deepEqual(ev.blockers, []);
});

test('il punteggio non dipende dall ordine dei due profili', () => {
  assert.equal(evaluateMatch(A(), B()).score, evaluateMatch(B(), A()).score);
});

test('senza finestre orarie in comune il match e bloccato, non solo basso', () => {
  const ev = evaluateMatch(A(), sampleProfile('u-4e12'));
  assert.equal(ev.eligible, false);
  assert.equal(ev.proceed, false);
  assert.ok(ev.blockers.some((b) => /finestra comune/i.test(b)));
});

test('le finestre piu corte del minimo non contano come disponibilita', () => {
  const a = A();
  const b = B();
  a.availability = [{ day: 'gio', start: '19:00', end: '20:00' }];
  b.availability = [{ day: 'gio', start: '19:00', end: '20:00' }];
  const ev = evaluateMatch(a, b);
  assert.equal(ev.commonWindows.length, 0);
  assert.equal(ev.eligible, false);
});

test('le finestre che scavalcano la mezzanotte si intersecano correttamente', () => {
  const windows = overlappingWindows(
    [{ day: 'ven', start: '20:00', end: '02:00' }],
    [{ day: 'ven', start: '23:00', end: '01:00' }],
    90,
  );
  assert.equal(windows.length, 1);
  assert.equal(windows[0].startMin, 23 * 60);
  assert.equal(windows[0].endMin, 25 * 60); // 01:00 del giorno dopo
  assert.equal(totalOverlapMinutes(windows), 120);
});

test('aree di spostamento disgiunte bloccano il match', () => {
  const a = A();
  const b = B();
  a.maxTravelKm = 0.3;
  b.maxTravelKm = 0.3;
  const ev = evaluateMatch(a, b);
  assert.equal(ev.eligible, false);
  assert.ok(ev.blockers.some((x) => /disgiunte|meta strada/i.test(x)));
});

test('un dealbreaker dichiarato blocca il match a prescindere dal punteggio', () => {
  const a = A();
  const b = B();
  a.dealbreakers = ['fotografia']; // interesse dichiarato da B
  const ev = evaluateMatch(a, b);
  assert.equal(ev.eligible, false);
  assert.ok(ev.blockers.some((x) => /dealbreaker/i.test(x)));
});

test('il dealbreaker vale in entrambe le direzioni', () => {
  const a = A();
  const b = B();
  b.dealbreakers = ['arrampicata']; // interesse dichiarato da A
  assert.equal(evaluateMatch(a, b).eligible, false);
});

test('vibe inconciliabili bloccano il match', () => {
  const a = A();
  const b = B();
  a.vibes = ['concerto_piccolo'];
  b.vibes = ['museo'];
  const ev = evaluateMatch(a, b);
  assert.equal(ev.eligible, false);
  assert.ok(ev.blockers.some((x) => /vibe/i.test(x)));
});

test('interessi identici penalizzano lo spark rispetto a una divergenza moderata', () => {
  const base = A();
  const clone = { ...B(), interests: [...base.interests] };
  const diverso = { ...B(), interests: [...base.interests.slice(0, 2), 'astronomia', 'teatro'] };
  const sparkClone = evaluateMatch(base, clone).breakdown.spark;
  const sparkDiverso = evaluateMatch(base, diverso).breakdown.spark;
  assert.ok(
    sparkDiverso > sparkClone,
    `la divergenza moderata (${sparkDiverso}) deve battere il clone (${sparkClone})`,
  );
});

test('gli interessi della stessa famiglia contano meno di quelli identici', () => {
  const a = A();
  const b = B();
  a.interests = ['arrampicata'];
  b.interests = ['arrampicata'];
  const identici = evaluateMatch(a, b).breakdown.interests;
  b.interests = ['trekking'];
  const cugini = evaluateMatch(a, b).breakdown.interests;
  assert.ok(identici > cugini);
  assert.ok(cugini > 0);
});

test('molti interessi della stessa famiglia non gonfiano il punteggio', () => {
  const a = A();
  const b = B();
  a.interests = ['techno', 'jazz', 'vinili', 'concerti'];
  b.interests = ['opera'];
  // Un solo argomento in comune ("musica"), per quanto declinato in piu tag.
  assert.ok(evaluateMatch(a, b).breakdown.interests <= 0.25);
});

test('rankCandidates restituisce solo chi supera la soglia, ordinato', () => {
  const candidati = ['u-91cd', 'u-2b60', 'u-4e12', 'u-8d55'].map(sampleProfile);
  const risultati = rankCandidates(A(), candidati);
  assert.ok(risultati.length >= 1);
  assert.ok(risultati.every((r) => r.evaluation.score >= 80));
  const punteggi = risultati.map((r) => r.evaluation.score);
  assert.deepEqual(punteggi, [...punteggi].sort((x, y) => y - x));
});

test('una soglia piu alta restringe i risultati', () => {
  const candidati = ['u-91cd', 'u-2b60', 'u-8d55'].map(sampleProfile);
  const larghi = rankCandidates(A(), candidati, { threshold: 60 });
  const stretti = rankCandidates(A(), candidati, { threshold: 95 });
  assert.ok(larghi.length > stretti.length);
});
