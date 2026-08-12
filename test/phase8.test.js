import test from 'node:test';
import assert from 'node:assert/strict';

import {
  completeGame,
  createGameTrack,
  maybeProposeGame,
  respondGame,
  scadiProposteGioco,
  summarizeGames,
} from '../src/phase8-games.js';
import { GIOCHI, GIOCO_NON_FATTO } from '../src/data/games.js';
import {
  createAttentionBudget,
  richiediAttenzione,
  riepilogoAttenzione,
  rilasciaAttenzione,
} from '../src/attention.js';

const CARD = {
  matchId: 'match-test',
  partecipanti: ['u-aaa', 'u-bbb'],
  quando: { durata_minuti: 120 },
};

const consensoPieno = { 'u-aaa': true, 'u-bbb': true };
const traccia = (opts = {}) => createGameTrack(CARD, { consenso: consensoPieno, ...opts });

/** Momento piatto: la serata gira a vuoto ma il clima non e' brutto. */
const piatto = (over = {}) => ({
  t: 2400,
  energia: 0.4,
  silenzioSec: 5,
  risate: 0,
  rischio: 'nessuno',
  ...over,
});

function proponi(track, tick) {
  for (let i = 0; i < 100; i++) {
    const { proposta } = maybeProposeGame(track, { ...tick, t: tick.t + i });
    if (proposta) return proposta;
  }
  return null;
}

function accettaEntrambi(track, proposta, t) {
  respondGame(track, proposta.id, 'u-aaa', { accetta: true, t });
  return respondGame(track, proposta.id, 'u-bbb', { accetta: true, t });
}

// --- Il catalogo ------------------------------------------------------------

test('ogni gioco dichiara durata, quanto occupa lo schermo e come si chiude', () => {
  for (const gioco of GIOCHI) {
    assert.ok(gioco.durataMin > 0 && gioco.durataMin <= 15, `${gioco.id}: durata fuori scala`);
    assert.ok(['solo_avvio', 'a_turno', 'condiviso'].includes(gioco.schermo));
    assert.ok(gioco.regole.length >= 3, `${gioco.id}: regole troppo scarne`);
    assert.ok(gioco.chiusura.length > 0, `${gioco.id}: deve restituire qualcosa`);
    assert.ok(gioco.perche.length > 0, `${gioco.id}: deve dichiarare a cosa serve`);
  }
});

test('nessun gioco assegna punteggi di compatibilita o vincitori', () => {
  const testo = JSON.stringify(GIOCHI).toLowerCase();
  for (const parola of ['compatibil', 'punteggio', 'vincitore', 'affinita', '%']) {
    assert.ok(!testo.includes(parola), `i giochi non devono contenere "${parola}"`);
  }
});

test('gli id sono unici e i giochi sono abbastanza vari', () => {
  const ids = GIOCHI.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(GIOCHI.length >= 8, 'serve un catalogo, non tre giochi');
  const modi = new Set(GIOCHI.map((g) => g.schermo));
  assert.equal(modi.size, 3, 'servono giochi di tutti e tre i gradi di schermo');
});

test('almeno un terzo dei giochi libera subito lo schermo', () => {
  const liberi = GIOCHI.filter((g) => g.schermo === 'solo_avvio');
  assert.ok(liberi.length >= GIOCHI.length / 3);
});

// --- Consenso e sicurezza ---------------------------------------------------

test('serve il consenso di entrambi', () => {
  const t = createGameTrack(CARD, { consenso: { 'u-aaa': true } });
  assert.equal(t.attivo, false);
  assert.equal(maybeProposeGame(t, piatto()).motivo, 'spento');
});

test('un segnale di rischio chiude i giochi per la serata', () => {
  const t = traccia();
  assert.equal(maybeProposeGame(t, piatto({ rischio: 'disagio' })).motivo, 'bloccato_per_sicurezza');
  assert.equal(maybeProposeGame(t, piatto({ t: 5000 })).motivo, 'bloccato_per_sicurezza');
});

// --- Quando proporre --------------------------------------------------------

test('mai mentre la conversazione gira', () => {
  const t = traccia();
  assert.equal(maybeProposeGame(t, piatto({ energia: 0.9 })).motivo, 'la_conversazione_gira');
});

test('si propone nei momenti piatti', () => {
  assert.ok(proponi(traccia(), piatto()));
});

test('troppo presto non c e nessun gioco adatto', () => {
  const t = traccia();
  assert.equal(maybeProposeGame(t, piatto({ t: 120 })).motivo, 'nessun_gioco_adatto');
});

test('due proposte non si sovrappongono', () => {
  const t = traccia();
  assert.ok(proponi(t, piatto()));
  assert.equal(maybeProposeGame(t, piatto({ t: 2500 })).motivo, 'proposta_in_corso');
});

test('fra due giochi passa un intervallo lungo', () => {
  const t = traccia();
  const p = proponi(t, piatto());
  accettaEntrambi(t, p, p.t);
  completeGame(t, p.id, { t: p.t + 300 });
  assert.equal(maybeProposeGame(t, piatto({ t: p.t + 600 })).motivo, 'in_pausa');
});

test('non piu di due giochi a serata', () => {
  const t = traccia();
  let giocati = 0;
  for (let sec = 1200; sec < 30000; sec += 60) {
    const { proposta } = maybeProposeGame(t, piatto({ t: sec }));
    if (!proposta) continue;
    accettaEntrambi(t, proposta, sec);
    completeGame(t, proposta.id, { t: sec + 300 });
    giocati += 1;
  }
  assert.equal(giocati, 2);
});

test('lo stesso gioco non viene mai riproposto', () => {
  const t = traccia();
  const usati = [];
  for (let sec = 1200; sec < 30000; sec += 60) {
    const { proposta } = maybeProposeGame(t, piatto({ t: sec }));
    if (!proposta) continue;
    usati.push(proposta.giocoId);
    accettaEntrambi(t, proposta, sec);
    completeGame(t, proposta.id, { t: sec + 300 });
  }
  assert.equal(new Set(usati).size, usati.length);
});

test('un gioco non puo sforare la fine prevista della serata', () => {
  const t = traccia();
  const esito = maybeProposeGame(t, piatto({ t: 118 * 60 }));
  assert.equal(esito.proposta, null);
});

test('i giochi da fine serata non arrivano a meta', () => {
  const t = traccia();
  const patto = GIOCHI.find((g) => g.id === 'il_patto');
  assert.equal(patto.finaleSerata, true);
  const proposte = [];
  for (let sec = 1200; sec < 60 * 60; sec += 60) {
    const { proposta } = maybeProposeGame(t, piatto({ t: sec }));
    if (proposta) {
      proposte.push(proposta.giocoId);
      accettaEntrambi(t, proposta, sec);
      completeGame(t, proposta.id, { t: sec + 60 });
    }
  }
  assert.ok(!proposte.includes('il_patto'));
});

test('nella seconda meta si preferiscono i giochi che liberano lo schermo', () => {
  // Con la serata avanzata la scelta cade sui giochi solo_avvio finche ce ne sono.
  const t = traccia({ seed: 'tardi' });
  const proposta = proponi(t, piatto({ t: 80 * 60 }));
  const gioco = GIOCHI.find((g) => g.id === proposta.giocoId);
  assert.equal(gioco.schermo, 'solo_avvio');
});

test('la proposta dichiara sempre durata e via di uscita', () => {
  const proposta = proponi(traccia(), piatto());
  assert.ok(proposta.schermata.durataMin > 0);
  assert.match(proposta.schermata.uscita, /basta che uno dei due dica di no/i);
});

// --- Accettazione e partita -------------------------------------------------

test('serve il si di entrambi per giocare', () => {
  const t = traccia();
  const p = proponi(t, piatto());
  const primo = respondGame(t, p.id, 'u-aaa', { accetta: true, t: p.t });
  assert.equal(primo.stato, 'in_attesa');
  const secondo = respondGame(t, p.id, 'u-bbb', { accetta: true, t: p.t });
  assert.equal(secondo.stato, 'accettata');
  assert.ok(secondo.partita.regole.length >= 3);
});

test('un solo no chiude subito, senza aspettare l altra risposta', () => {
  const t = traccia();
  const p = proponi(t, piatto());
  const esito = respondGame(t, p.id, 'u-aaa', { accetta: false, t: p.t });
  assert.equal(esito.stato, 'rifiutata');
  assert.equal(esito.messaggio, GIOCO_NON_FATTO);
});

test('una proposta ignorata scade in silenzio', () => {
  const t = traccia();
  const p = proponi(t, piatto());
  assert.deepEqual(scadiProposteGioco(t, p.scadeA + 1).scadute, [p.id]);
  assert.equal(respondGame(t, p.id, 'u-aaa', { accetta: true }).stato, 'scaduta');
});

test('un estraneo non puo rispondere', () => {
  const t = traccia();
  const p = proponi(t, piatto());
  assert.throws(() => respondGame(t, p.id, 'u-zzz', { accetta: true }), /non fa parte/);
});

test('la partita finisce restituendo un argomento, non un punteggio', () => {
  const t = traccia();
  const p = proponi(t, piatto());
  accettaEntrambi(t, p, p.t);
  const fine = completeGame(t, p.id, { t: p.t + 400 });
  assert.equal(fine.ok, true);
  assert.ok(fine.chiusura.length > 0);
  assert.match(fine.messaggio, /telefono giu/i);
  assert.ok(!/punteggio|vincitore|compatibil/i.test(JSON.stringify(fine)));
});

// --- L'infiltrato: il gioco con schermate diverse ---------------------------

test('l infiltrato consegna la bugia a una sola persona', () => {
  // Si prova finche non esce una partita con un infiltrato: una volta su
  // quattro non mente nessuno, ed e voluto.
  let conBugia = 0;
  let senzaBugia = 0;
  for (let giro = 0; giro < 40; giro++) {
    const t = traccia({ seed: `infiltrato-${giro}` });
    const p = proponi(t, piatto({ t: 70 * 60 }));
    if (!p || p.giocoId !== 'infiltrato') continue;
    const esito = accettaEntrambi(t, p, p.t);
    const ruoli = t.partecipanti.map((id) => esito.partita.perTe(id).ruolo);
    const infiltrati = ruoli.filter((r) => r === 'infiltrato').length;
    assert.ok(infiltrati <= 1, 'al massimo una persona riceve la bugia');
    if (infiltrati === 1) conBugia += 1;
    else senzaBugia += 1;
  }
  assert.ok(conBugia > 0, 'deve poter esserci un infiltrato');
  assert.ok(senzaBugia > 0, 'e deve poter non esserci nessuno');
});

test('chi non e infiltrato riceve una schermata della stessa forma', () => {
  let trovato = false;
  for (let giro = 0; giro < 40 && !trovato; giro++) {
    const t = traccia({ seed: `forma-${giro}` });
    const p = proponi(t, piatto({ t: 70 * 60 }));
    if (!p || p.giocoId !== 'infiltrato') continue;
    trovato = true;
    const esito = accettaEntrambi(t, p, p.t);
    for (const id of t.partecipanti) {
      const schermata = esito.partita.perTe(id);
      assert.ok(schermata.istruzione.length > 0, 'nessuna schermata vuota che tradisca il ruolo');
      assert.deepEqual(Object.keys(schermata).sort(), ['istruzione', 'ruolo']);
    }
  }
  assert.ok(trovato, 'il test deve aver davvero giocato a L infiltrato');
});

test('la soluzione arriva solo a partita finita', () => {
  let trovato = false;
  for (let giro = 0; giro < 40 && !trovato; giro++) {
    const t = traccia({ seed: `soluzione-${giro}` });
    const p = proponi(t, piatto({ t: 70 * 60 }));
    if (!p || p.giocoId !== 'infiltrato') continue;
    trovato = true;
    const esito = accettaEntrambi(t, p, p.t);
    assert.equal(esito.partita.soluzione, undefined, 'niente soluzione durante la partita');
    const fine = completeGame(t, p.id, { t: p.t + 600 });
    assert.ok('infiltrato' in fine.soluzione);
  }
  assert.ok(trovato, 'il test deve aver davvero giocato a L infiltrato');
});

test('la riga produce spettri con due estremi, non domande si o no', () => {
  let trovato = false;
  for (let giro = 0; giro < 40 && !trovato; giro++) {
    const t = traccia({ seed: `riga-${giro}` });
    const p = proponi(t, piatto({ t: 20 * 60 }));
    if (!p || p.giocoId !== 'la_riga') continue;
    trovato = true;
    const esito = accettaEntrambi(t, p, p.t);
    assert.ok(esito.partita.righe.length >= 3);
    for (const riga of esito.partita.righe) {
      assert.ok(riga.domanda.length > 0);
      assert.ok(riga.sinistra.length > 0);
      assert.ok(riga.destra.length > 0);
      assert.notEqual(riga.sinistra, riga.destra);
    }
  }
  assert.ok(trovato, 'il test deve aver davvero giocato a La riga');
});

// --- Riepilogo --------------------------------------------------------------

test('il riepilogo racconta cosa e stato giocato e quanto si accetta', () => {
  const t = traccia();
  const p = proponi(t, piatto());
  accettaEntrambi(t, p, p.t);
  completeGame(t, p.id, { t: p.t + 300 });
  const r = summarizeGames(t);
  assert.equal(r.giocati.length, 1);
  assert.equal(r.accettazione, 1);
});

// --- Budget di attenzione ---------------------------------------------------

test('una sola fase alla volta puo chiedere attenzione', () => {
  const budget = createAttentionBudget({ durataPrevistaMin: 120 });
  assert.equal(richiediAttenzione(budget, { fase: 'compagno', tipo: 'carta', t: 600 }).concesso, true);
  const secondo = richiediAttenzione(budget, { fase: 'giochi', tipo: 'gioco', t: 610 });
  assert.equal(secondo.concesso, false);
  assert.match(secondo.motivo, /occupato da compagno/);
});

test('dopo un interruzione pesante la pausa e piu lunga', () => {
  const budget = createAttentionBudget();
  richiediAttenzione(budget, { fase: 'giochi', tipo: 'gioco', t: 600 });
  rilasciaAttenzione(budget, { fase: 'giochi', t: 900 });
  assert.equal(richiediAttenzione(budget, { fase: 'affetto', tipo: 'affetto', t: 1000 }).concesso, false);
  assert.equal(richiediAttenzione(budget, { fase: 'affetto', tipo: 'affetto', t: 1700 }).concesso, true);
});

test('il budget della serata si esaurisce', () => {
  const budget = createAttentionBudget({ durataPrevistaMin: 60 });
  let concesse = 0;
  for (let t = 0; t < 40000; t += 600) {
    if (richiediAttenzione(budget, { fase: 'giochi', tipo: 'gioco', t }).concesso) {
      concesse += 1;
      rilasciaAttenzione(budget, { fase: 'giochi', t });
    }
  }
  assert.ok(concesse <= 2, `troppe interruzioni concesse: ${concesse}`);
  assert.equal(richiediAttenzione(budget, { fase: 'giochi', tipo: 'gioco', t: 99999 }).concesso, false);
});

test('i giochi rispettano il budget condiviso', () => {
  const budget = createAttentionBudget({ durataPrevistaMin: 120 });
  const t = traccia({ attenzione: budget });
  richiediAttenzione(budget, { fase: 'compagno', tipo: 'carta', t: 2400 });
  assert.match(maybeProposeGame(t, piatto({ t: 2410 })).motivo, /occupato/);
});

test('il riepilogo dell attenzione dice quanto il telefono si e fatto sentire', () => {
  const budget = createAttentionBudget({ durataPrevistaMin: 120 });
  richiediAttenzione(budget, { fase: 'compagno', tipo: 'carta', t: 600 });
  rilasciaAttenzione(budget, { fase: 'compagno', t: 620 });
  richiediAttenzione(budget, { fase: 'giochi', tipo: 'gioco', t: 3000 });
  const r = riepilogoAttenzione(budget);
  assert.equal(r.interruzioni, 2);
  assert.equal(r.perFase.giochi, 4);
  assert.ok(r.quotaUsata > 0 && r.quotaUsata <= 1);
});
