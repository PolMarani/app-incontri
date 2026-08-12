import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateMatch } from '../src/phase1-compatibility.js';
import { proposeLocations, resolveLocationConsensus } from '../src/phase2-location.js';
import {
  buildEventCard,
  eventCardFor,
  generateIcebreakers,
  isAcceptableCard,
} from '../src/phase3-eventcard.js';
import { BANNED_PATTERNS } from '../src/data/icebreakers.js';
import { sampleProfile } from '../src/data/sample-profiles.js';

const NOW = new Date('2026-08-12T10:00:00+02:00');

function scheda(overrides = {}) {
  const a = overrides.a ?? sampleProfile('u-7f3a');
  const b = overrides.b ?? sampleProfile('u-91cd');
  const evaluation = evaluateMatch(a, b);
  const proposal = proposeLocations(a, b, evaluation);
  const consensus = resolveLocationConsensus(
    proposal,
    proposal.options.map((o) => o.optionId),
    proposal.options.map((o) => o.optionId),
  );
  return {
    a,
    b,
    evaluation,
    card: buildEventCard(a, b, evaluation, consensus.chosen, {
      now: NOW,
      matchId: overrides.matchId ?? 'match-test',
    }),
  };
}

// --- Scheda dell'evento -----------------------------------------------------

test('la scheda contiene luogo e orario esatti', () => {
  const { card } = scheda();
  assert.ok(card.luogo.nome.length > 0);
  assert.ok(card.luogo.indirizzo.length > 0);
  assert.match(card.quando.ora, /^\d{2}:\d{2}$/);
  assert.match(card.quando.data, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(new Date(card.quando.inizio) > NOW, 'l incontro deve essere nel futuro');
  assert.ok(card.quando.durata_minuti >= 90);
});

test('la data cade davvero nel giorno della settimana indicato', () => {
  const { card } = scheda();
  const giorni = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'];
  assert.equal(giorni[new Date(card.quando.inizio).getDay()], card.quando.giorno);
});

// --- Codice di riconoscimento ----------------------------------------------

test('il codice di riconoscimento ha parola chiave, risposta e punto di ritrovo', () => {
  const { card } = scheda();
  const r = card.riconoscimento;
  assert.ok(r.parolaChiave.apertura.length > 0);
  assert.ok(r.parolaChiave.risposta.length > 0);
  assert.ok(r.puntoDiRitrovo.length > 0);
  assert.ok(card.luogo.atmosfera.length > 0);
});

test('i due segni visivi sono diversi fra loro', () => {
  const { a, b, card } = scheda();
  const segni = card.riconoscimento.segnoVisivo;
  assert.notEqual(segni[a.id], segni[b.id]);
});

test('il codice non descrive mai le persone', () => {
  const { card } = scheda();
  const testo = JSON.stringify(card.riconoscimento).toLowerCase();
  for (const parola of ['capelli', 'alto', 'bassa', 'maglietta rossa', 'occhiali', 'barba']) {
    assert.ok(!testo.includes(parola), `il codice non deve dire "${parola}"`);
  }
});

test('arriva per primo chi ha il tragitto piu breve', () => {
  const { a, b, card } = scheda();
  const minuti = (id) => Number(/(\d+)/.exec(card.tragitto[id])[1]);
  if (minuti(a.id) !== minuti(b.id)) {
    const atteso = minuti(a.id) < minuti(b.id) ? a.id : b.id;
    assert.equal(card.riconoscimento.arrivaPerPrimo, atteso);
  }
});

test('la stessa coppia produce sempre la stessa scheda', () => {
  const uno = scheda().card;
  const due = scheda().card;
  assert.deepEqual(uno.riconoscimento, due.riconoscimento);
  assert.deepEqual(
    uno.icebreakers.mazzo.map((c) => c.testo),
    due.icebreakers.mazzo.map((c) => c.testo),
  );
});

test('coppie diverse ricevono codici diversi', () => {
  const uno = scheda({ matchId: 'match-uno' }).card;
  const due = scheda({ matchId: 'match-due' }).card;
  assert.notDeepEqual(uno.riconoscimento, due.riconoscimento);
});

// --- Icebreaker -------------------------------------------------------------

test('ci sono da 3 a 5 spunti in evidenza e un mazzo molto piu lungo', () => {
  const { card } = scheda();
  const { inEvidenza, mazzo } = card.icebreakers;
  assert.ok(inEvidenza.length >= 3 && inEvidenza.length <= 5);
  assert.ok(mazzo.length >= 20, `mazzo troppo corto: ${mazzo.length}`);
});

test('gli spunti in evidenza sono quasi tutti costruiti sui profili', () => {
  const { card } = scheda();
  const personalizzati = card.icebreakers.inEvidenza.filter(
    (c) => c.origine !== 'mazzo base',
  );
  assert.ok(
    personalizzati.length >= 3,
    'le carte di apertura devono nascere dai profili, non dal mazzo generico',
  );
});

test('gli spunti in evidenza non ripetono la stessa categoria', () => {
  const { card } = scheda();
  const categorie = card.icebreakers.inEvidenza.map((c) => c.categoria);
  assert.equal(new Set(categorie).size, categorie.length);
});

test('nessuna carta e una domanda da colloquio', () => {
  const { card } = scheda();
  for (const carta of card.icebreakers.mazzo) {
    for (const vietata of BANNED_PATTERNS) {
      assert.ok(!vietata.test(carta.testo), `carta vietata: "${carta.testo}"`);
    }
  }
});

test('il filtro delle domande banali funziona', () => {
  assert.equal(isAcceptableCard('Allora, che lavoro fai?'), false);
  assert.equal(isAcceptableCard('Quanti anni hai?'), false);
  assert.equal(isAcceptableCard('Chi sopravviverebbe di piu su un isola deserta?'), true);
});

test('il mazzo non contiene doppioni', () => {
  const { card } = scheda();
  const testi = card.icebreakers.mazzo.map((c) => c.testo);
  assert.equal(new Set(testi).size, testi.length);
});

test('nessuna categoria domina il mazzo', () => {
  const { card } = scheda();
  const { mazzo, perCategoria } = card.icebreakers;
  assert.ok(Object.keys(perCategoria).length >= 5, 'servono almeno cinque categorie');
  for (const [categoria, quante] of Object.entries(perCategoria)) {
    assert.ok(
      quante <= mazzo.length / 3,
      `la categoria ${categoria} occupa troppo mazzo (${quante}/${mazzo.length})`,
    );
  }
});

test('il mazzo mescola carte personalizzate e carte del mazzo base', () => {
  const { card } = scheda();
  const origini = new Set(card.icebreakers.mazzo.map((c) => c.origine === 'mazzo base'));
  assert.equal(origini.size, 2, 'devono esserci sia carte su misura sia carte base');
});

test('gli interessi condivisi finiscono davvero nelle carte', () => {
  const { card } = scheda();
  const testi = card.icebreakers.mazzo.map((c) => c.testo.toLowerCase()).join(' ');
  assert.ok(testi.includes('viagg'), 'il viaggio e un interesse condiviso dalla coppia');
});

test('le curiosita dichiarate diventano spunti', () => {
  const { card } = scheda();
  const curiosita = card.icebreakers.mazzo.filter((c) => c.categoria === 'curiosita');
  assert.ok(curiosita.length > 0);
  assert.ok(curiosita.some((c) => c.testo.includes('lievito madre')));
});

test('senza interessi in comune il mazzo regge lo stesso', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  a.interests = [];
  b.interests = [];
  a.curiosities = [];
  b.curiosities = [];
  a.values = [];
  b.values = [];
  const evaluation = evaluateMatch(a, b, { threshold: 0 });
  const { inEvidenza, mazzo } = generateIcebreakers(a, b, evaluation, { vibe: 'libreria' });
  assert.ok(inEvidenza.length >= 3);
  assert.ok(mazzo.length >= 20);
});

// --- Vista per singolo utente ----------------------------------------------

test('la scheda di un utente mostra solo il proprio tragitto', () => {
  const { a, b, card } = scheda();
  const vista = eventCardFor(card, a.id);
  assert.equal(typeof vista.tragitto, 'string');
  assert.ok(!JSON.stringify(vista.tragitto).includes(b.id));
});

test('la scheda personale distingue il proprio segno da quello dell altro', () => {
  const { a, card } = scheda();
  const vista = eventCardFor(card, a.id);
  const segni = vista.riconoscimento.segnoVisivo;
  assert.equal(segni.il_tuo, card.riconoscimento.segnoVisivo[a.id]);
  assert.ok(segni.quello_dell_altra_persona.length > 0);
  assert.notEqual(segni.il_tuo, segni.quello_dell_altra_persona);
});

test('un estraneo non puo leggere la scheda', () => {
  const { card } = scheda();
  assert.throws(() => eventCardFor(card, 'u-nessuno'), /non fa parte/);
});

test('la data della scheda e quella locale, anche a cavallo della mezzanotte', () => {
  // Un incontro che comincia sabato alle 00:30 e venerdi 22:30 in UTC: la
  // scheda deve dire sabato, con la data di sabato.
  const notturno = {
    optionId: 'opt-1',
    venue: {
      name: 'Locale notturno',
      address: 'Via Notte 1',
      location: { lat: 45.46, lon: 9.19 },
      vibes: ['bar_serale'],
      features: { wheelchairAccess: true, transitNearby: true, noiseLevel: 'alto' },
      atmosphere: 'aperto tardi',
      recognitionSpots: ['il bancone'],
    },
    slot: { day: 'sab', startMin: 30, endMin: 150 },
    vibe: 'bar_serale',
    travelA: { minuti: 12, modo: 'con i mezzi' },
    travelB: { minuti: 14, modo: 'con i mezzi' },
  };
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const card = buildEventCard(a, b, evaluateMatch(a, b), notturno, { now: NOW });

  const inizio = new Date(card.quando.inizio);
  const giorni = ['Domenica', 'Lunedi', 'Martedi', 'Mercoledi', 'Giovedi', 'Venerdi', 'Sabato'];
  assert.equal(card.quando.giorno, 'Sabato');
  assert.equal(giorni[inizio.getDay()], card.quando.giorno);
  // La data stampata deve coincidere con il giorno indicato.
  const atteso = `${inizio.getFullYear()}-${String(inizio.getMonth() + 1).padStart(2, '0')}-${String(inizio.getDate()).padStart(2, '0')}`;
  assert.equal(card.quando.data, atteso);
});
