import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMatch } from '../src/phase1-compatibility.js';
import {
  proposeLocations,
  reproposeLocations,
  resolveLocationConsensus,
} from '../src/phase2-location.js';
import { sampleProfile } from '../src/data/sample-profiles.js';
import { loadVenues } from '../src/data/venues.js';

const A = () => sampleProfile('u-7f3a');
const B = () => sampleProfile('u-91cd');

function setup(a = A(), b = B()) {
  const evaluation = evaluateMatch(a, b);
  return { a, b, evaluation, proposal: proposeLocations(a, b, evaluation) };
}

test('vengono proposte al massimo tre opzioni', () => {
  const { proposal } = setup();
  assert.equal(proposal.ok, true);
  assert.ok(proposal.options.length > 0);
  assert.ok(proposal.options.length <= 3);
});

// --- Riservatezza -----------------------------------------------------------

test('la vista di un utente non contiene nome ne indirizzo del locale', () => {
  const { proposal } = setup();
  const serializzato = JSON.stringify(proposal.viewFor('u-7f3a'));
  for (const opzione of proposal.options) {
    assert.ok(
      !serializzato.includes(opzione.venue.name),
      `il nome "${opzione.venue.name}" non deve comparire prima dell accordo`,
    );
    assert.ok(!serializzato.includes(opzione.venue.address));
  }
});

/** Raccoglie ricorsivamente tutte le chiavi e tutti i valori numerici. */
function ispeziona(value, chiavi = new Set(), numeri = []) {
  if (Array.isArray(value)) {
    for (const item of value) ispeziona(item, chiavi, numeri);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      chiavi.add(key);
      ispeziona(item, chiavi, numeri);
    }
  } else if (typeof value === 'number') {
    numeri.push(value);
  }
  return { chiavi, numeri };
}

test('la vista non contiene coordinate ne il tragitto dell altra persona', () => {
  const { a, b, proposal } = setup();
  const vista = proposal.viewFor('u-7f3a');
  const { chiavi, numeri } = ispeziona(vista);

  for (const vietata of ['lat', 'lon', 'location', 'address', 'name', 'venue']) {
    assert.ok(!chiavi.has(vietata), `la chiave "${vietata}" non deve uscire dal server`);
  }
  // Nessun numero della vista deve assomigliare a una coordinata: ne quella
  // del locale, ne - soprattutto - quella di partenza dell altra persona.
  const coordinate = [a.origin.lat, a.origin.lon, b.origin.lat, b.origin.lon];
  for (const numero of numeri) {
    for (const coord of coordinate) {
      assert.ok(Math.abs(numero - coord) > 0.5, `${numero} e troppo simile a ${coord}`);
    }
  }

  for (const [i, opzione] of proposal.options.entries()) {
    // Il tempo mostrato deve essere il proprio, mai quello dell altro.
    assert.equal(vista[i].minuti_di_viaggio, opzione.travelA.minuti);
  }
});

test('le due viste presentano le stesse opzioni nello stesso ordine', () => {
  const { proposal } = setup();
  const idsA = proposal.viewFor('u-7f3a').map((o) => o.optionId);
  const idsB = proposal.viewFor('u-91cd').map((o) => o.optionId);
  assert.deepEqual(idsA, idsB);
});

test('un utente estraneo non puo chiedere la vista del match', () => {
  const { proposal } = setup();
  assert.throws(() => proposal.viewFor('u-sconosciuto'), /non fa parte/);
});

test('il tipo mostrato e quello reale del locale, non la vibe che ha fatto match', () => {
  const { proposal } = setup();
  for (const [i, opzione] of proposal.options.entries()) {
    assert.equal(proposal.viewFor('u-7f3a')[i].tipo_key, opzione.venue.vibes[0]);
  }
});

// --- Sicurezza ed equita' ---------------------------------------------------

test('tutte le opzioni sono luoghi pubblici, presidiati e sopra la soglia di sicurezza', () => {
  const { proposal } = setup();
  for (const opzione of proposal.options) {
    assert.equal(opzione.venue.features.publicPlace, true);
    assert.equal(opzione.venue.features.staffed, true);
    assert.equal(opzione.venue.features.wellLit, true);
    assert.ok(opzione.venue.safetyScore >= 0.6);
  }
});

test('nessuna opzione e fuori dal raggio di spostamento dei due profili', () => {
  const { proposal } = setup();
  for (const opzione of proposal.options) {
    assert.ok(opzione.travelA.minuti < 60);
    assert.ok(opzione.travelB.minuti < 60);
  }
});

test('le opzioni sono ragionevolmente eque fra i due', () => {
  const { proposal } = setup();
  // Nessuno dei due deve fare tutta la strada: il primo classificato in
  // particolare deve essere quasi equidistante.
  assert.ok(proposal.options[0].fairness >= 0.7);
});

test('i vincoli sul locale sono rispettati: niente alcolici, accessibile', () => {
  const a = A();
  const b = sampleProfile('u-8d55'); // noAlcohol + wheelchairAccess
  const evaluation = evaluateMatch(a, b, { threshold: 0 });
  const proposal = proposeLocations(a, b, evaluation);
  assert.equal(proposal.ok, true);
  for (const opzione of proposal.options) {
    assert.notEqual(opzione.venue.features.servesAlcohol, true);
    assert.equal(opzione.venue.features.wheelchairAccess, true);
  }
});

test('un vincolo impossibile da soddisfare produce un rifiuto motivato', () => {
  const a = A();
  const b = B();
  a.constraints = { outdoorOnly: true, noAlcohol: true, lowNoise: true };
  b.constraints = { wheelchairAccess: true };
  const evaluation = evaluateMatch(a, b, { threshold: 0 });
  const proposal = proposeLocations(a, b, evaluation, { venues: [loadVenues()[3]] });
  assert.equal(proposal.ok, false);
  assert.ok(proposal.reason.length > 0);
  assert.ok(proposal.rejected.length > 0);
});

test('gli orari del locale devono coprire la finestra comune', () => {
  const { proposal } = setup();
  for (const { venue, slot } of proposal.options) {
    const apertura = venue.openingHours.filter((h) => h.day === slot.day);
    assert.ok(apertura.length > 0, `${venue.name} deve essere aperto di ${slot.day}`);
    assert.ok(slot.endMin - slot.startMin >= 90);
  }
});

test('l orario proposto cade sempre su un mezz ora tonda', () => {
  const { proposal } = setup();
  for (const opzione of proposal.options) {
    assert.equal(opzione.slot.startMin % 30, 0);
  }
});

// --- Consenso ---------------------------------------------------------------

test('con preferenze concordi vince l opzione preferita da entrambi', () => {
  const { proposal } = setup();
  const esito = resolveLocationConsensus(proposal, ['opt-2', 'opt-1'], ['opt-2', 'opt-3']);
  assert.equal(esito.ok, true);
  assert.equal(esito.chosen.optionId, 'opt-2');
});

test('con preferenze opposte vince la somma dei piazzamenti piu bassa', () => {
  const { proposal } = setup();
  const esito = resolveLocationConsensus(
    proposal,
    ['opt-1', 'opt-2', 'opt-3'],
    ['opt-2', 'opt-1', 'opt-3'],
  );
  assert.equal(esito.ok, true);
  assert.ok(['opt-1', 'opt-2'].includes(esito.chosen.optionId));
  assert.equal(esito.tally[0].rankSum, 1);
});

test('se le scelte non si incrociano non c e consenso', () => {
  const { proposal } = setup();
  const esito = resolveLocationConsensus(proposal, ['opt-1'], ['opt-2']);
  assert.equal(esito.ok, false);
  assert.match(esito.reason, /rilancia/i);
});

test('se uno rifiuta tutto non c e consenso', () => {
  const { proposal } = setup();
  assert.equal(resolveLocationConsensus(proposal, ['opt-1'], []).ok, false);
});

test('le opzioni inesistenti nel voto vengono ignorate', () => {
  const { proposal } = setup();
  const esito = resolveLocationConsensus(
    proposal,
    ['opt-99', 'opt-1'],
    ['opt-1', 'opt-42'],
  );
  assert.equal(esito.ok, true);
  assert.equal(esito.chosen.optionId, 'opt-1');
});

test('il rilancio non ripropone i locali gia scartati', () => {
  const { a, b, evaluation, proposal } = setup();
  const secondo = reproposeLocations(a, b, evaluation, proposal);
  if (secondo.ok) {
    const primi = proposal.options.map((o) => o.venue.id);
    for (const opzione of secondo.options) {
      assert.ok(!primi.includes(opzione.venue.id));
    }
  } else {
    assert.ok(secondo.reason.length > 0);
  }
});
