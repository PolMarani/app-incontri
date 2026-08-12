import test from 'node:test';
import assert from 'node:assert/strict';

import { coperturaCatalogo, coperturaOraria } from '../src/diagnostics.js';
import { preferenzeDaSegnali } from '../src/phase6-debrief.js';
import { generateIcebreakers } from '../src/phase3-eventcard.js';
import { evaluateMatch } from '../src/phase1-compatibility.js';
import { sampleProfile } from '../src/data/sample-profiles.js';

// --- Copertura del catalogo -------------------------------------------------

test('la copertura misura ogni profilo di vincoli, non solo l utente mediano', () => {
  const r = coperturaCatalogo();
  assert.ok(r.totale > 0);
  const nomi = r.profili.map((p) => p.profilo);
  for (const atteso of ['nessuno', 'senza_alcolici', 'sedia_a_rotelle', 'astemio_in_sedia']) {
    assert.ok(nomi.includes(atteso));
  }
});

test('nessun profilo puo coprire piu del profilo senza vincoli', () => {
  const r = coperturaCatalogo();
  const base = r.profili.find((p) => p.profilo === 'nessuno').quota;
  for (const p of r.profili) assert.ok(p.quota <= base, `${p.profilo} supera la base`);
});

test('la copertura conta le vibe raggiungibili, non solo i locali', () => {
  const r = coperturaCatalogo();
  const sedia = r.profili.find((p) => p.profilo === 'sedia_a_rotelle');
  assert.ok(Array.isArray(sedia.vibe));
  assert.ok(sedia.vibe.length > 0, 'chi usa la sedia deve avere piu di una vibe possibile');
});

test('un catalogo povero per un profilo produce un allarme', () => {
  const soloBar = [
    {
      id: 'v1', name: 'Bar', address: 'x', location: { lat: 45, lon: 9 },
      vibes: ['bar_serale'], openingHours: [{ day: 'ven', start: '18:00', end: '02:00' }],
      features: {
        publicPlace: true, staffed: true, wellLit: true, transitNearby: true,
        servesAlcohol: true, wheelchairAccess: false, outdoor: false, noiseLevel: 'alto',
      },
      safetyScore: 0.8, atmosphere: '', recognitionSpots: ['bancone'],
    },
  ];
  const r = coperturaCatalogo({ venues: soloBar });
  assert.ok(r.allarmi.length > 0);
  assert.ok(r.allarmi.some((a) => a.includes('sedia_a_rotelle')));
});

test('la copertura oraria trova i buchi della settimana', () => {
  const r = coperturaOraria();
  assert.ok(r.griglia.dom);
  assert.ok(typeof r.griglia.gio.sera === 'number');
  assert.ok(Array.isArray(r.buchi));
});

// --- Anello di apprendimento ------------------------------------------------

const segnale = (categorie) => ({
  utilizzabile: true,
  categorieEfficaci: categorie,
});

test('senza serate alle spalle non ci sono preferenze', () => {
  assert.deepEqual(preferenzeDaSegnali([]), {});
  assert.deepEqual(preferenzeDaSegnali([{ utilizzabile: false }]), {});
});

test('le categorie che hanno funzionato prendono un peso sopra 1', () => {
  const pesi = preferenzeDaSegnali([
    segnale([
      { categoria: 'dilemma', giocate: 4, efficacia: 1.5 },
      { categoria: 'abitudini', giocate: 4, efficacia: 0.1 },
    ]),
  ]);
  assert.ok(pesi.dilemma > 1);
  assert.ok(pesi.abitudini < 1);
});

test('una sola carta giocata non sposta quasi niente', () => {
  const timido = preferenzeDaSegnali([segnale([{ categoria: 'dilemma', giocate: 1, efficacia: 2 }])]);
  const convinto = preferenzeDaSegnali([segnale([{ categoria: 'dilemma', giocate: 12, efficacia: 2 }])]);
  assert.ok(convinto.dilemma > timido.dilemma);
  assert.ok(timido.dilemma < 1.2, 'dopo una prova sola non si sa ancora niente');
});

test('le preferenze apprese cambiano davvero la composizione del mazzo', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const ev = evaluateMatch(a, b);

  const neutro = generateIcebreakers(a, b, ev, { vibe: 'caffe_tranquillo', seed: 'x' });
  const orientato = generateIcebreakers(a, b, ev, {
    vibe: 'caffe_tranquillo',
    seed: 'x',
    preferenzeCategorie: { curiosita: 1.4, divergenza: 0.6 },
  });

  assert.notDeepEqual(
    neutro.mazzo.map((c) => c.id),
    orientato.mazzo.map((c) => c.id),
  );
  assert.ok(
    (orientato.perCategoria.curiosita ?? 0) >= (neutro.perCategoria.curiosita ?? 0),
    'la categoria premiata non deve perdere spazio',
  );
});

test('le preferenze non rompono le quote: nessuna categoria monopolizza', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const ev = evaluateMatch(a, b);
  const { mazzo, perCategoria } = generateIcebreakers(a, b, ev, {
    vibe: 'caffe_tranquillo',
    preferenzeCategorie: { divergenza: 5 },
  });
  for (const [categoria, quante] of Object.entries(perCategoria)) {
    assert.ok(quante <= mazzo.length / 3, `${categoria} monopolizza il mazzo`);
  }
});
