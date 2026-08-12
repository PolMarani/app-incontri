import test from 'node:test';
import assert from 'node:assert/strict';

import {
  advance,
  cancelMeeting,
  checkIn,
  confermaSegno,
  confirmCheckpoint,
  coperturaUmana,
  createMeetingPlan,
  openSupportChannel,
  summarizePlan,
} from '../src/phase4-safety.js';

const INIZIO = new Date('2026-08-13T19:00:00+02:00');
const CREATO = new Date('2026-08-10T10:00:00+02:00');

const CARD = {
  matchId: 'match-test',
  partecipanti: ['u-aaa', 'u-bbb'],
  quando: { inizio: INIZIO.toISOString() },
};

const piano = () => createMeetingPlan(CARD, { now: CREATO });
/** Istante relativo all'inizio dell'incontro. */
const t = (minuti) => new Date(INIZIO.getTime() + minuti * 60000);

/** Porta il piano allo stato normale della sera dell incontro: tutto confermato. */
function confermaTutto(plan) {
  for (const cp of plan.checkpoints) {
    const quando = new Date(cp.dueAt.getTime() - 60000);
    for (const utente of plan.partecipanti) {
      confirmCheckpoint(plan, utente, cp.id, { now: quando });
    }
  }
  return plan;
}

// --- Scaletta delle conferme ------------------------------------------------

test('la scaletta prevede conferme a un giorno, sei ore e un ora', () => {
  const plan = piano();
  assert.deepEqual(plan.checkpoints.map((c) => c.id), ['T-24h', 'T-6h', 'T-1h']);
  assert.equal(plan.state, 'programmato');
});

test('i checkpoint gia passati alla creazione non vengono creati', () => {
  const plan = createMeetingPlan(CARD, { now: t(-90) }); // incontro fra un ora e mezza
  assert.deepEqual(plan.checkpoints.map((c) => c.id), ['T-1h']);
});

test('serve la conferma di entrambi perche il checkpoint sia superato', () => {
  const plan = piano();
  const primo = confirmCheckpoint(plan, 'u-aaa', 'T-24h', { now: t(-25 * 60) });
  assert.equal(primo.ok, true);
  assert.match(primo.messaggio, /manca ancora/i);
  assert.equal(plan.state, 'programmato');

  const secondo = confirmCheckpoint(plan, 'u-bbb', 'T-24h', { now: t(-25 * 60) });
  assert.equal(secondo.ok, true);
  assert.equal(plan.state, 'confermato');
});

test('al momento del checkpoint parte un sollecito a chi non ha confermato', () => {
  const plan = piano();
  confirmCheckpoint(plan, 'u-aaa', 'T-24h', { now: t(-25 * 60) });
  const { azioni } = advance(plan, { now: t(-24 * 60) });
  const solleciti = azioni.filter((a) => a.tipo === 'sollecito');
  assert.equal(solleciti.length, 1);
  assert.equal(solleciti[0].utente, 'u-bbb');
});

test('il sollecito non si ripete a ogni giro dello scheduler', () => {
  const plan = piano();
  advance(plan, { now: t(-24 * 60) });
  const secondoGiro = advance(plan, { now: t(-23 * 60) });
  assert.equal(secondoGiro.azioni.filter((a) => a.tipo === 'sollecito').length, 0);
});

test('la conferma mancata entro il termine annulla l incontro da sola', () => {
  const plan = piano();
  confirmCheckpoint(plan, 'u-aaa', 'T-24h', { now: t(-25 * 60) });
  const { stato, azioni } = advance(plan, { now: t(-19 * 60) }); // oltre le 4h di grazia
  assert.equal(stato, 'annullato');
  assert.equal(azioni.length, 2, 'entrambi vengono avvisati');
  assert.ok(azioni.every((a) => a.tipo === 'annullamento_automatico'));
});

test('chi subisce l annullamento non viene colpevolizzato e ha la priorita', () => {
  const plan = piano();
  const esito = cancelMeeting(plan, { da: 'u-aaa', motivo: 'imprevisto', now: t(-300) });
  const avvisoAllAltro = esito.notifiche.find((n) => n.utente === 'u-bbb');
  assert.match(avvisoAllAltro.testo, /priorita/i);
  assert.ok(avvisoAllAltro.azioni.includes('parla_con_qualcuno'));
  assert.deepEqual(esito.supportoOfferto, ['u-bbb']);
});

test('dopo l annullamento le conferme non sono piu accettate', () => {
  const plan = piano();
  cancelMeeting(plan, { da: 'u-aaa', motivo: 'imprevisto', now: t(-300) });
  assert.equal(confirmCheckpoint(plan, 'u-bbb', 'T-6h', { now: t(-360) }).ok, false);
});

test('una conferma fuori tempo massimo viene rifiutata', () => {
  const plan = piano();
  const esito = confirmCheckpoint(plan, 'u-aaa', 'T-1h', { now: t(-10) });
  assert.equal(esito.ok, false);
  assert.match(esito.messaggio, /scadut/i);
});

test('un utente estraneo non puo confermare', () => {
  const plan = piano();
  assert.equal(confirmCheckpoint(plan, 'u-zzz', 'T-24h', { now: t(-25 * 60) }).ok, false);
});

// --- Arrivo e no-show -------------------------------------------------------

test('il check-in si apre un quarto d ora prima', () => {
  const plan = confermaTutto(piano());
  const presto = advance(plan, { now: t(-30) });
  assert.ok(!presto.azioni.some((a) => a.tipo === 'apertura_checkin'));
  const giusto = advance(plan, { now: t(-10) });
  assert.ok(giusto.azioni.some((a) => a.tipo === 'apertura_checkin'));
});

test('con un solo arrivato scatta il sospetto no-show dopo venti minuti', () => {
  const plan = confermaTutto(piano());
  checkIn(plan, 'u-aaa', { now: t(-5) });
  assert.equal(advance(plan, { now: t(10) }).azioni.some((a) => a.tipo === 'no_show_sospetto'), false);
  const dopo = advance(plan, { now: t(21) });
  const avviso = dopo.azioni.find((a) => a.tipo === 'no_show_sospetto');
  assert.ok(avviso);
  assert.equal(avviso.utente, 'u-aaa');
});

test('il no-show viene confermato e l incontro chiuso dopo 35 minuti', () => {
  const plan = confermaTutto(piano());
  checkIn(plan, 'u-aaa', { now: t(-5) });
  const esito = advance(plan, { now: t(36) });
  const avviso = esito.azioni.find((a) => a.tipo === 'no_show_confermato');
  assert.ok(avviso);
  assert.match(avviso.testo, /non e una cosa che ti riguarda/i);
  assert.equal(plan.state, 'annullato');
});

test('quando arrivano entrambi non scatta nessun allarme', () => {
  const plan = confermaTutto(piano());
  checkIn(plan, 'u-aaa', { now: t(-5) });
  const esito = checkIn(plan, 'u-bbb', { now: t(2) });
  assert.equal(esito.entrambiPresenti, true);
  assert.equal(plan.state, 'in_corso');
  const avanzamento = advance(plan, { now: t(25) });
  assert.ok(!avanzamento.azioni.some((a) => a.tipo.startsWith('no_show')));
});

test('a meta serata parte un controllo discreto', () => {
  const plan = confermaTutto(piano());
  checkIn(plan, 'u-aaa', { now: t(-5) });
  checkIn(plan, 'u-bbb', { now: t(0) });
  const ping = advance(plan, { now: t(31) }).azioni.find((a) => a.tipo === 'wellness_ping');
  assert.ok(ping);
  // Non si ripete.
  assert.ok(!advance(plan, { now: t(45) }).azioni.some((a) => a.tipo === 'wellness_ping'));
});

// --- Supporto ---------------------------------------------------------------

test('i motivi leggeri passano dall assistente, con uscita verso un umano', () => {
  const plan = piano();
  const canale = openSupportChannel(plan, { utente: 'u-aaa', motivo: 'ansia_pre_date' });
  assert.equal(canale.canale, 'assistente_ai');
  assert.match(canale.trasparenza, /non con una persona/i);
  assert.ok(canale.puoiSempre.some((x) => /operatore umano/i.test(x)));
});

test('i motivi gravi vanno subito a un operatore umano', () => {
  const plan = piano();
  for (const motivo of ['disagio_durante', 'mi_sento_in_pericolo', 'comportamento_da_segnalare']) {
    const canale = openSupportChannel(plan, { utente: 'u-aaa', motivo });
    assert.equal(canale.canale, 'operatore_umano', `${motivo} deve andare a un umano`);
  }
});

test('un segnale di rischio nel testo libero scavalca il routing', () => {
  const plan = piano();
  const canale = openSupportChannel(plan, {
    utente: 'u-aaa',
    motivo: 'ritardo',
    testoLibero: 'credo che mi stia seguendo, ho paura',
  });
  assert.equal(canale.canale, 'operatore_umano');
  assert.equal(canale.priorita, 'critica');
});

test('il supporto mostra sempre i numeri di emergenza e dichiara i propri limiti', () => {
  const plan = piano();
  const canale = openSupportChannel(plan, { utente: 'u-aaa', motivo: 'no_show' });
  assert.ok(canale.risorse.some((r) => r.numero === '112'));
  assert.ok(canale.risorse.some((r) => r.numero === '1522'));
  assert.match(canale.limiti, /non e un professionista/i);
});

test('aprire il supporto non manda nessun segnale all altra persona', () => {
  const plan = piano();
  const canale = openSupportChannel(plan, { utente: 'u-aaa', motivo: 'disagio_durante' });
  assert.equal(canale.notificaAllAltro, null);
});

test('il supporto non e mai un canale verso il match: zero chat vale sempre', () => {
  const plan = piano();
  const canale = openSupportChannel(plan, { utente: 'u-aaa', motivo: 'partner_non_risponde' });
  assert.ok(['assistente_ai', 'operatore_umano'].includes(canale.canale));
  assert.ok(!JSON.stringify(canale).includes('u-bbb'));
});

test('un motivo sconosciuto viene rifiutato', () => {
  const plan = piano();
  assert.throws(
    () => openSupportChannel(plan, { utente: 'u-aaa', motivo: 'boh' }),
    /sconosciuto/,
  );
});

test('il riepilogo racconta lo stato in modo leggibile', () => {
  const plan = piano();
  confirmCheckpoint(plan, 'u-aaa', 'T-24h', { now: t(-25 * 60) });
  const riepilogo = summarizePlan(plan);
  assert.equal(riepilogo.conferme.length, 3);
  assert.deepEqual(riepilogo.conferme[0].mancano, ['u-bbb']);
  assert.equal(riepilogo.stato, 'programmato');
});

// --- Conferma incrociata dei segni ------------------------------------------

test('la conferma incrociata dei segni vale come autenticazione reciproca', () => {
  const plan = confermaTutto(piano());
  checkIn(plan, 'u-aaa', { now: t(-5) });
  checkIn(plan, 'u-bbb', { now: t(0) });

  const primo = confermaSegno(plan, 'u-aaa', { corrisponde: true, now: t(1) });
  assert.equal(primo.reciproca, false);
  const secondo = confermaSegno(plan, 'u-bbb', { corrisponde: true, now: t(2) });
  assert.equal(secondo.reciproca, true);
});

test('un segno che non corrisponde apre un allerta e non chiede spiegazioni', () => {
  const plan = confermaTutto(piano());
  checkIn(plan, 'u-aaa', { now: t(-5) });
  const esito = confermaSegno(plan, 'u-aaa', { corrisponde: false, now: t(3) });

  assert.equal(esito.allerta, true);
  assert.equal(esito.motivoSupporto, 'comportamento_da_segnalare');
  assert.match(esito.messaggio, /non forzare la situazione/i);
  assert.ok(esito.azioni.includes('uscita_assistita'));
});

test('un estraneo non puo confermare il segno', () => {
  const plan = piano();
  assert.equal(confermaSegno(plan, 'u-zzz', { corrisponde: true }).ok, false);
});

// --- Copertura degli operatori ----------------------------------------------

test('in orario di turno viene dichiarata l attesa reale', () => {
  const venerdiSera = new Date('2026-08-14T21:00:00+02:00');
  const copertura = coperturaUmana(venerdiSera);
  assert.equal(copertura.attiva, true);
  assert.ok(copertura.attesaMin > 0);
});

test('la fascia notturna del venerdi copre anche le ore piccole del sabato', () => {
  assert.equal(coperturaUmana(new Date('2026-08-15T01:30:00+02:00')).attiva, true);
});

test('fuori orario non si promette un operatore che non c e', () => {
  const martedMattina = new Date('2026-08-11T09:00:00+02:00');
  const copertura = coperturaUmana(martedMattina);
  assert.equal(copertura.attiva, false);
  assert.ok(copertura.richiamoEntroMin > 0);
  assert.match(copertura.nota, /non e in turno/i);
  assert.match(copertura.nota, /presidiati adesso/i);
});

test('il canale umano dice la verita sui tempi, in turno e fuori', () => {
  const plan = piano();
  const inTurno = openSupportChannel(plan, {
    utente: 'u-aaa',
    motivo: 'mi_sento_in_pericolo',
    now: new Date('2026-08-14T21:00:00+02:00'),
  });
  assert.match(inTurno.trasparenza, /attesa stimata/i);

  const fuoriTurno = openSupportChannel(plan, {
    utente: 'u-aaa',
    motivo: 'mi_sento_in_pericolo',
    now: new Date('2026-08-11T09:00:00+02:00'),
  });
  assert.equal(fuoriTurno.copertura.attiva, false);
  assert.match(fuoriTurno.trasparenza, /non e in turno/i);
  // Fuori orario i numeri veri restano comunque in primo piano.
  assert.ok(fuoriTurno.risorse.some((r) => r.numero === '112'));
});
