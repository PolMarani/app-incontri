import test from 'node:test';
import assert from 'node:assert/strict';

import { coppieBloccanti, runMatchingRound } from '../src/matching-round.js';
import { sampleProfile, SAMPLE_PROFILES } from '../src/data/sample-profiles.js';

const tutti = () => Object.keys(SAMPLE_PROFILES).map(sampleProfile);

/** Costruisce N profili compatibili fra loro, con piccole variazioni. */
function popolazione(n, seed = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `u-${String(i + seed * 100).padStart(3, '0')}`,
    availability: [{ day: 'gio', start: '18:30', end: '23:30' }],
    interests: [
      ['viaggi', 'cucina', 'libri', 'fotografia', 'astronomia'][i % 5],
      ['arrampicata', 'vinili', 'cinema', 'yoga', 'scacchi'][(i * 3) % 5],
    ],
    values: [['sostenibilita', 'onesta', 'curiosita'][i % 3]],
    vibes: ['caffe_tranquillo', 'libreria'],
    origin: { lat: 45.47 + (i % 7) * 0.004, lon: 9.19 + (i % 5) * 0.004 },
    maxTravelKm: 6,
  }));
}

// --- Nessuno viene abbinato due volte ---------------------------------------

test('ogni persona compare in una coppia sola', () => {
  const esito = runMatchingRound(popolazione(12), { threshold: 60 });
  const visti = new Set();
  for (const coppia of esito.coppie) {
    for (const id of coppia.partecipanti) {
      assert.ok(!visti.has(id), `${id} abbinato due volte`);
      visti.add(id);
    }
  }
});

test('chi e in coppia non compare fra i non abbinati', () => {
  const esito = runMatchingRound(popolazione(11), { threshold: 60 });
  const inCoppia = new Set(esito.coppie.flatMap((c) => c.partecipanti));
  for (const fuori of esito.nonAbbinati) {
    assert.ok(!inCoppia.has(fuori.id));
  }
  assert.equal(inCoppia.size + esito.nonAbbinati.length, 11);
});

test('con un numero dispari resta fuori esattamente una persona', () => {
  const esito = runMatchingRound(popolazione(9), { threshold: 60 });
  assert.equal(esito.coppie.length * 2 + esito.nonAbbinati.length, 9);
  assert.ok(esito.nonAbbinati.length >= 1);
});

test('due profili con lo stesso id fermano il ciclo invece di produrre danni', () => {
  const doppio = [...popolazione(2), sampleProfile('u-7f3a'), sampleProfile('u-7f3a')];
  assert.throws(() => runMatchingRound(doppio), /stesso id/);
});

// --- Stabilita' -------------------------------------------------------------

test('l abbinamento non contiene coppie bloccanti', () => {
  const profili = popolazione(14);
  const esito = runMatchingRound(profili, { threshold: 60 });
  assert.deepEqual(coppieBloccanti(esito, profili, { threshold: 60 }), []);
});

test('la stabilita regge su popolazioni diverse', () => {
  for (const n of [4, 7, 10, 16, 21]) {
    const profili = popolazione(n, n);
    const esito = runMatchingRound(profili, { threshold: 55 });
    assert.deepEqual(
      coppieBloccanti(esito, profili, { threshold: 55 }),
      [],
      `coppie bloccanti con ${n} profili`,
    );
  }
});

test('un abbinamento fatto male produce coppie bloccanti: il controllo funziona', () => {
  const profili = popolazione(4);
  const buono = runMatchingRound(profili, { threshold: 55 });
  assert.ok(buono.coppie.length >= 2);
  // Si scambiano i partner: se il controllo e sensato, deve accorgersene.
  const [uno, due] = buono.coppie;
  const scambiato = {
    ...buono,
    coppie: [
      { ...uno, a: uno.a, b: due.b, partecipanti: [uno.a.id, due.b.id], score: 0 },
      { ...due, a: due.a, b: uno.b, partecipanti: [due.a.id, uno.b.id], score: 0 },
    ],
  };
  assert.ok(coppieBloccanti(scambiato, profili, { threshold: 55 }).length > 0);
});

// --- Determinismo -----------------------------------------------------------

test('due cicli sugli stessi dati producono le stesse coppie', () => {
  const uno = runMatchingRound(popolazione(13), { threshold: 60 });
  const due = runMatchingRound(popolazione(13), { threshold: 60 });
  assert.deepEqual(
    uno.coppie.map((c) => c.partecipanti),
    due.coppie.map((c) => c.partecipanti),
  );
});

test('l ordine in cui arrivano i profili non cambia il risultato', () => {
  const profili = popolazione(12);
  const dritto = runMatchingRound(profili, { threshold: 60 });
  const rovescio = runMatchingRound([...profili].reverse(), { threshold: 60 });
  const normalizza = (e) =>
    e.coppie.map((c) => [...c.partecipanti].sort().join('+')).sort();
  assert.deepEqual(normalizza(dritto), normalizza(rovescio));
});

// --- Motivi di esclusione ---------------------------------------------------

test('chi resta fuori per congestione lo sa, ed e diverso dal non avere nessuno', () => {
  // Tre profili compatibili fra loro: uno resta fuori perche gli altri due si
  // sono presi, non perche non ci fosse nessuno.
  const esito = runMatchingRound(popolazione(3), { threshold: 55 });
  assert.equal(esito.coppie.length, 1);
  const fuori = esito.nonAbbinati[0];
  assert.match(fuori.motivo, /gia impegnati/);
  assert.equal(fuori.precedenzaProssimoCiclo, true);
});

test('chi non ha nessun profilo compatibile riceve un motivo diverso', () => {
  const isolato = sampleProfile('u-4e12'); // orari che non si incrociano con nessuno
  const esito = runMatchingRound([...popolazione(4), isolato], { threshold: 55 });
  const fuori = esito.nonAbbinati.find((x) => x.id === isolato.id);
  assert.ok(fuori);
  assert.match(fuori.motivo, /nessun profilo compatibile/);
  assert.equal(fuori.precedenzaProssimoCiclo, false);
});

test('chi era compatibile ma sempre sotto soglia riceve il terzo motivo', () => {
  const esito = runMatchingRound(tutti(), { threshold: 99 });
  assert.equal(esito.coppie.length, 0);
  assert.ok(esito.nonAbbinati.every((x) => x.precedenzaProssimoCiclo === false));
  assert.ok(esito.nonAbbinati.some((x) => /sopra soglia/.test(x.motivo)));
});

// --- Priorita' di recupero --------------------------------------------------

test('chi ha subito un buco passa avanti a parita di punteggio', () => {
  const profili = popolazione(4);
  // Tutti equivalenti; solo l ultimo ha subito un no-show.
  profili[3].storico = { noShowSubiti: 2 };
  const esito = runMatchingRound(profili, { threshold: 55 });
  const abbinati = new Set(esito.coppie.flatMap((c) => c.partecipanti));
  assert.ok(abbinati.has(profili[3].id), 'chi ha aspettato a un tavolo deve rientrare');
  assert.ok(esito.coppie.some((c) => c.spinta > 1));
});

// --- Soglia adattiva --------------------------------------------------------

test('la soglia adattiva guarda la densita di tutto il ciclo', () => {
  const profili = tutti();
  const fisso = runMatchingRound(profili, { threshold: 85 });
  const adattivo = runMatchingRound(profili, { threshold: 85, adattiva: true, obiettivo: 1 });
  assert.ok(adattivo.coppie.length >= fisso.coppie.length);
  assert.ok(adattivo.adattamento);
});

test('le statistiche raccontano il ciclo', () => {
  const esito = runMatchingRound(popolazione(10), { threshold: 60 });
  const s = esito.statistiche;
  assert.equal(s.profili, 10);
  assert.ok(s.coppieFormate > 0);
  assert.ok(s.copertura > 0 && s.copertura <= 1);
  assert.ok(s.punteggioMinimo >= esito.soglia);
});

test('un ciclo vuoto non esplode', () => {
  const esito = runMatchingRound([]);
  assert.deepEqual(esito.coppie, []);
  assert.deepEqual(esito.nonAbbinati, []);
  assert.equal(esito.statistiche.punteggioMedio, null);
});

test('una persona sola non viene abbinata a se stessa', () => {
  const esito = runMatchingRound([sampleProfile('u-7f3a')]);
  assert.equal(esito.coppie.length, 0);
  assert.equal(esito.nonAbbinati.length, 1);
});
