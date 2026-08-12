import test from 'node:test';
import assert from 'node:assert/strict';

import { contieneContatti, validateBatch, validateProfile } from '../src/validation.js';
import { generateIcebreakers } from '../src/phase3-eventcard.js';
import { evaluateMatch } from '../src/phase1-compatibility.js';
import { sampleProfile } from '../src/data/sample-profiles.js';

const buono = () => sampleProfile('u-7f3a');

test('i profili di esempio sono tutti validi', () => {
  for (const id of ['u-7f3a', 'u-91cd', 'u-2b60', 'u-4e12', 'u-8d55']) {
    const esito = validateProfile(sampleProfile(id));
    assert.equal(esito.valido, true, `${id}: ${esito.errori.join('; ')}`);
  }
});

// --- Errori bloccanti -------------------------------------------------------

test('un profilo senza disponibilita non e utilizzabile', () => {
  const p = buono();
  p.availability = [];
  assert.equal(validateProfile(p).valido, false);
});

test('un orario scritto male viene spiegato al confine, non esplode dentro', () => {
  const p = buono();
  p.availability = [{ day: 'gio', start: '25:00', end: '26:00' }];
  const esito = validateProfile(p);
  assert.equal(esito.valido, false);
  assert.ok(esito.errori.some((e) => /disponibilita non valida/.test(e)));
});

test('un giorno inesistente viene rifiutato', () => {
  const p = buono();
  p.availability = [{ day: 'giovedi', start: '19:00', end: '22:00' }];
  assert.equal(validateProfile(p).valido, false);
});

test('una vibe sconosciuta viene rifiutata invece di bloccare ogni match in silenzio', () => {
  const p = buono();
  p.vibes = ['discoteca'];
  const esito = validateProfile(p);
  assert.equal(esito.valido, false);
  assert.ok(esito.errori.some((e) => /vibe sconosciuta/.test(e)));
});

test('le coordinate (0, 0) sono un errore, non una posizione', () => {
  const p = buono();
  p.origin = { lat: 0, lon: 0 };
  assert.ok(validateProfile(p).errori.some((e) => /0, 0/.test(e)));
});

test('coordinate fuori range vengono prese', () => {
  const p = buono();
  p.origin = { lat: 145, lon: 9 };
  assert.ok(validateProfile(p).errori.some((e) => /latitudine fuori range/.test(e)));
});

test('latitudine e longitudine invertite producono un avviso', () => {
  const p = buono();
  p.origin = { lat: 9.19, lon: 45.47 };
  const esito = validateProfile(p);
  assert.ok(esito.avvisi.some((a) => /invertite/.test(a)));
});

test('un raggio negativo e un errore, uno enorme solo un avviso', () => {
  const p = buono();
  p.maxTravelKm = -3;
  assert.equal(validateProfile(p).valido, false);
  p.maxTravelKm = 80;
  const esito = validateProfile(p);
  assert.equal(esito.valido, true);
  assert.ok(esito.avvisi.some((a) => /scomodi/.test(a)));
});

test('una lista scritta come stringa viene rifiutata', () => {
  const p = buono();
  p.interests = 'viaggi';
  assert.ok(validateProfile(p).errori.some((e) => /deve essere una lista/.test(e)));
});

// --- Campi liberi e anonimato ----------------------------------------------

test('riconosce i contatti nascosti in un campo libero', () => {
  assert.equal(contieneContatti('ho un lievito madre di quattro anni').pulito, true);
  assert.equal(contieneContatti('scrivimi a mario.rossi@example.com').pulito, false);
  assert.equal(contieneContatti('il mio numero e 333 456 7890').pulito, false);
  assert.equal(contieneContatti('mi trovi su instagram').pulito, false);
  assert.equal(contieneContatti('sono @mariorossi').pulito, false);
  assert.equal(contieneContatti('guarda https://esempio.it/io').pulito, false);
});

test('una curiosita con un contatto dentro blocca il profilo, e spiega perche', () => {
  const p = buono();
  p.curiosities = ['colleziono mappe, comunque il mio numero e 3331234567'];
  const esito = validateProfile(p);
  assert.equal(esito.valido, false);
  assert.ok(esito.errori.some((e) => /numero di telefono/.test(e)));
  assert.ok(esito.errori.some((e) => /letti dall altra persona/.test(e)));
});

test('una curiosita lunghissima viene rifiutata', () => {
  const p = buono();
  p.curiosities = ['a'.repeat(500)];
  assert.equal(validateProfile(p).valido, false);
});

test('la Fase 3 non stampa comunque una curiosita con dentro un contatto', () => {
  // Seconda barriera: anche saltando la validazione, la carta non deve uscire.
  const a = buono();
  const b = sampleProfile('u-91cd');
  a.curiosities = ['scrivimi su telegram, sono @qualcuno'];
  b.curiosities = ['ho imparato il greco per leggere un solo libro'];

  const { mazzo } = generateIcebreakers(a, b, evaluateMatch(a, b), { vibe: 'libreria' });
  const testo = mazzo.map((c) => c.testo).join(' ');
  assert.ok(!testo.includes('@qualcuno'));
  assert.ok(!/telegram/i.test(testo));
  // La curiosita' pulita dell altro invece resta.
  assert.ok(testo.includes('greco'));
});

// --- Lotti ------------------------------------------------------------------

test('il lotto separa i validi dagli scartati con i motivi', () => {
  const rotto = buono();
  rotto.id = 'u-rotto';
  rotto.vibes = [];
  const esito = validateBatch([buono(), rotto, sampleProfile('u-91cd')]);
  assert.equal(esito.validi.length, 2);
  assert.equal(esito.scartati.length, 1);
  assert.equal(esito.scartati[0].id, 'u-rotto');
  assert.ok(esito.scartati[0].errori.length > 0);
});

test('un profilo nullo non fa esplodere il lotto', () => {
  const esito = validateBatch([null, undefined, buono()]);
  assert.equal(esito.validi.length, 1);
  assert.equal(esito.scartati.length, 2);
});
