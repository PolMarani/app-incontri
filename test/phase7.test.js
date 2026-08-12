import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bloccaPerSicurezza,
  createAffectionTrack,
  maybePropose,
  respond,
  scadiProposte,
  summarizeAffection,
} from '../src/phase7-affection.js';
import { ESITO_NEUTRO, MOMENTI } from '../src/data/affection-moments.js';

const CARD = {
  matchId: 'match-test',
  partecipanti: ['u-aaa', 'u-bbb'],
  quando: { durata_minuti: 120 },
};

const consensoPieno = { 'u-aaa': true, 'u-bbb': true };
const traccia = (opts = {}) =>
  createAffectionTrack(CARD, { consenso: consensoPieno, ...opts });

/** Tick con clima caldo: risate, energia alta, nessun silenzio. */
const caldo = (over = {}) => ({
  t: 3000,
  silenzioSec: 1,
  energia: 0.7,
  risate: 2,
  rischio: 'nessuno',
  ...over,
});

/** Forza la proposta ignorando il caso: si prova finche' non esce. */
function proponi(track, tick) {
  for (let i = 0; i < 80; i++) {
    const { proposta } = maybePropose(track, { ...tick, t: tick.t + i });
    if (proposta) return proposta;
  }
  return null;
}

/** Entrambi accettano la proposta corrente. */
function accettaEntrambi(track, proposta) {
  respond(track, proposta.id, 'u-aaa', { accetta: true });
  return respond(track, proposta.id, 'u-bbb', { accetta: true });
}

// --- Cancelli di accesso ----------------------------------------------------

test('serve il consenso esplicito di entrambi', () => {
  const t = createAffectionTrack(CARD, { consenso: { 'u-aaa': true } });
  assert.equal(t.attivo, false);
  assert.match(t.motivo, /consenso esplicito/i);
});

test('chi non vuole contatto fisico non vede mai una proposta', () => {
  const t = createAffectionTrack(CARD, {
    consenso: consensoPieno,
    profili: { 'u-bbb': { contattoFisico: false } },
  });
  assert.equal(t.attivo, false);
  assert.match(t.motivo, /non volere contatto fisico/i);
  assert.equal(maybePropose(t, caldo()).proposta, null);
});

test('una traccia spenta non propone niente', () => {
  const t = createAffectionTrack(CARD, { consenso: {} });
  assert.equal(maybePropose(t, caldo()).motivo, 'spento');
});

test('la promessa fatta all utente e esplicita', () => {
  const t = traccia();
  assert.ok(t.promessa.some((p) => /solo tu/i.test(p)));
  assert.ok(t.promessa.some((p) => /non saprai mai/i.test(p)));
  assert.ok(t.promessa.some((p) => /non lascia traccia/i.test(p)));
});

// --- Quando NON proporre ----------------------------------------------------

test('mai dentro una serata fredda', () => {
  const t = traccia();
  assert.equal(maybePropose(t, caldo({ energia: 0.2, risate: 0 })).motivo, 'clima_non_adatto');
});

test('mai dentro un silenzio', () => {
  const t = traccia();
  assert.equal(maybePropose(t, caldo({ silenzioSec: 20 })).motivo, 'clima_non_adatto');
});

test('un segnale di rischio blocca la funzione per tutta la serata', () => {
  const t = traccia();
  assert.equal(maybePropose(t, caldo({ rischio: 'disagio' })).motivo, 'bloccato_per_sicurezza');
  // Anche se dopo il clima torna ottimo, non si riapre.
  assert.equal(maybePropose(t, caldo({ t: 5000 })).motivo, 'bloccato_per_sicurezza');
  assert.equal(t.bloccatoPerSicurezza, true);
});

test('il blocco per sicurezza non e reversibile', () => {
  const t = traccia();
  bloccaPerSicurezza(t);
  assert.equal(proponi(t, caldo()), null);
});

test('troppo presto per il primo gradino non si propone', () => {
  const t = traccia();
  assert.equal(maybePropose(t, caldo({ t: 60 })).motivo, 'nessun_gradino_disponibile');
});

test('due proposte non si sovrappongono', () => {
  const t = traccia();
  assert.ok(proponi(t, caldo()));
  assert.equal(maybePropose(t, caldo({ t: 3200 })).motivo, 'proposta_in_corso');
});

test('fra due proposte passa un intervallo lungo', () => {
  const t = traccia();
  const prima = proponi(t, caldo());
  accettaEntrambi(t, prima);
  assert.equal(maybePropose(t, caldo({ t: prima.t + 300 })).motivo, 'in_pausa');
});

test('due rifiuti spengono la funzione per la serata', () => {
  const t = traccia();
  for (let giro = 0; giro < 2; giro++) {
    const p = proponi(t, caldo({ t: 3000 + giro * 2000 }));
    assert.ok(p, `serve una proposta al giro ${giro}`);
    respond(t, p.id, 'u-aaa', { accetta: true });
    respond(t, p.id, 'u-bbb', { accetta: false });
  }
  assert.equal(maybePropose(t, caldo({ t: 9000 })).motivo, 'rifiuti_ripetuti');
});

test('il numero di proposte per serata e limitato', () => {
  const t = traccia();
  let proposte = 0;
  for (let sec = 2400; sec < 20000; sec += 30) {
    const { proposta } = maybePropose(t, caldo({ t: sec }));
    if (proposta) {
      proposte += 1;
      accettaEntrambi(t, proposta);
    }
  }
  assert.ok(proposte <= 3, `troppe proposte: ${proposte}`);
});

// --- La scala ---------------------------------------------------------------

test('si parte sempre dal gradino piu basso', () => {
  const t = traccia();
  assert.equal(proponi(t, caldo()).momento.intensita, 1);
});

test('non si salta un gradino', () => {
  const t = traccia();
  let atteso = 1;
  for (let sec = 2400; sec < 30000; sec += 60) {
    const { proposta } = maybePropose(t, caldo({ t: sec }));
    if (!proposta) continue;
    assert.equal(proposta.momento.intensita, atteso);
    accettaEntrambi(t, proposta);
    atteso += 1;
  }
  assert.ok(atteso > 1);
});

test('l abbraccio lungo esiste ed e l ultimo gradino', () => {
  const lungo = MOMENTI.find((m) => m.id === 'abbraccio_lungo');
  assert.equal(lungo.durataSec, 20);
  assert.equal(lungo.finaleSerata, true);
  assert.equal(Math.max(...MOMENTI.map((m) => m.intensita)), lungo.intensita);
});

test('i gesti da commiato non arrivano a meta serata', () => {
  const t = traccia();
  // Si portano gli accettati fino al gradino 5 restando pero' a meta serata.
  t.accettati = MOMENTI.filter((m) => m.intensita <= 4);
  t.ultimaPropostaSec = -Infinity;
  const esito = maybePropose(t, caldo({ t: 60 * 60 })); // minuto 60 su 120
  assert.equal(esito.proposta, null);
  assert.equal(esito.motivo, 'nessun_gradino_disponibile');
});

test('a fine serata il gesto da commiato diventa disponibile', () => {
  const t = traccia();
  t.accettati = MOMENTI.filter((m) => m.intensita <= 4);
  t.ultimaPropostaSec = -Infinity;
  const proposta = proponi(t, caldo({ t: 105 * 60 }));
  assert.ok(proposta);
  assert.equal(proposta.momento.id, 'abbraccio_lungo');
});

// --- Doppio consenso e riservatezza ----------------------------------------

test('la proposta non nomina mai l altra persona', () => {
  const t = traccia();
  const proposta = proponi(t, caldo());
  const testo = JSON.stringify(proposta.schermata);
  assert.ok(!testo.includes('u-aaa'));
  assert.ok(!testo.includes('u-bbb'));
  assert.match(proposta.schermata.cornice, /solo per te|non lo sapra|vale zero/i);
});

test('serve il si di entrambi perche il momento accada', () => {
  const t = traccia();
  const proposta = proponi(t, caldo());
  const primo = respond(t, proposta.id, 'u-aaa', { accetta: true });
  assert.equal(primo.stato, 'in_attesa');
  assert.equal(primo.condiviso, undefined);

  const secondo = respond(t, proposta.id, 'u-bbb', { accetta: true });
  assert.equal(secondo.stato, 'accettata');
  assert.ok(secondo.condiviso.istruzione.length > 0);
});

test('chi accetta non scopre mai che l altro ha rifiutato', () => {
  const t = traccia();
  const proposta = proponi(t, caldo());
  respond(t, proposta.id, 'u-aaa', { accetta: true });
  const esito = respond(t, proposta.id, 'u-bbb', { accetta: false });

  assert.equal(esito.stato, 'non_riuscita');
  assert.equal(esito.messaggio, ESITO_NEUTRO);
  assert.ok(!/rifiut|no |negat/i.test(esito.messaggio));
  assert.ok(!JSON.stringify(esito).includes('u-bbb'));
});

test('rifiuto e scadenza producono lo stesso identico messaggio', () => {
  const rifiutata = traccia({ seed: 'uno' });
  const p1 = proponi(rifiutata, caldo());
  respond(rifiutata, p1.id, 'u-aaa', { accetta: true });
  const perRifiuto = respond(rifiutata, p1.id, 'u-bbb', { accetta: false }).messaggio;

  const ignorata = traccia({ seed: 'due' });
  const p2 = proponi(ignorata, caldo());
  const perScadenza = scadiProposte(ignorata, p2.scadeA + 1).messaggio;

  assert.equal(perRifiuto, perScadenza);
});

test('rifiutare costa un tocco e non chiede spiegazioni', () => {
  const t = traccia();
  const proposta = proponi(t, caldo());
  const esito = respond(t, proposta.id, 'u-aaa', { accetta: false });
  assert.match(esito.messaggio, /non risulta da nessuna parte/i);
  assert.equal(proposta.schermata.rifiuto.etichetta, 'Non ora');
});

test('una proposta ignorata scade in silenzio', () => {
  const t = traccia();
  const proposta = proponi(t, caldo());
  const esito = scadiProposte(t, proposta.scadeA + 1);
  assert.deepEqual(esito.scadute, [proposta.id]);
  assert.equal(proposta.stato, 'scaduta');
});

test('rispondere a una proposta scaduta non la resuscita', () => {
  const t = traccia();
  const proposta = proponi(t, caldo());
  scadiProposte(t, proposta.scadeA + 1);
  const esito = respond(t, proposta.id, 'u-aaa', { accetta: true });
  assert.equal(esito.stato, 'scaduta');
});

test('un estraneo non puo rispondere', () => {
  const t = traccia();
  const proposta = proponi(t, caldo());
  assert.throws(() => respond(t, proposta.id, 'u-zzz', { accetta: true }), /non fa parte/);
});

// --- Riepilogo --------------------------------------------------------------

test('il riepilogo elenca solo cio che e stato condiviso', () => {
  const t = traccia();
  const primo = proponi(t, caldo());
  accettaEntrambi(t, primo);

  const secondo = proponi(t, caldo({ t: primo.t + 1500 }));
  if (secondo) {
    respond(t, secondo.id, 'u-aaa', { accetta: true });
    respond(t, secondo.id, 'u-bbb', { accetta: false });
  }

  const riepilogo = summarizeAffection(t);
  assert.equal(riepilogo.momentiCondivisi.length, 1);
  assert.equal(riepilogo.rifiutiRegistrati, false);
  assert.ok(!JSON.stringify(riepilogo).includes('non_riuscita'));
});

test('il caso decide il momento, non se sia opportuno', () => {
  // Con lo stesso clima e seed diversi, l istante della proposta cambia:
  // e la prova che il "quando" e imprevedibile.
  const istanti = ['a', 'b', 'c', 'd'].map((seed) => {
    const t = traccia({ seed });
    for (let sec = 2400; sec < 4000; sec += 30) {
      const { proposta } = maybePropose(t, caldo({ t: sec }));
      if (proposta) return proposta.t;
    }
    return null;
  });
  assert.ok(new Set(istanti).size > 1, 'il momento deve variare');
  // ...ma dentro una serata fredda nessun seed produce mai una proposta.
  for (const seed of ['a', 'b', 'c', 'd']) {
    const t = traccia({ seed });
    assert.equal(proponi(t, caldo({ energia: 0.1, risate: 0 })), null);
  }
});
