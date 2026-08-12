import test from 'node:test';
import assert from 'node:assert/strict';

import {
  apriScambioContatti,
  buildDebrief,
  chiudiScambioContatti,
  debriefSignalsForMatcher,
  rispondiScambioContatti,
  VIETATO_NEL_DEBRIEF,
} from '../src/phase6-debrief.js';

/** Sessione chiusa fittizia: e' l'unico input della Fase 6. */
function chiusa(over = {}) {
  return {
    matchId: 'match-test',
    partecipanti: ['u-aaa', 'u-bbb'],
    attivo: true,
    durataMin: 100,
    interventi: [{ tipo: 'rilancio', richiesto: false }],
    metriche: {
      silenzioMedioSec: 4,
      silenzioMax: 18,
      risate: 5,
      domande: 9,
      quotaParlatoMedia: 0.5,
      energiaMedia: 0.6,
      segnaliRischio: 0,
      ...over.metriche,
    },
    carteGiocate: over.carteGiocate ?? [
      { t: 600, cardId: 'ice-1', categoria: 'dilemma', testo: 'Isola deserta, chi resiste?', risateDopo: 3, energiaDopo: 0.8 },
      { t: 1800, cardId: 'ice-2', categoria: 'abitudini', testo: 'La bugia piccolissima', risateDopo: 0, energiaDopo: 0.3 },
    ],
    ...over,
  };
}

// --- Riservatezza -----------------------------------------------------------

test('il debrief di un utente non nomina mai l altro', () => {
  const d = buildDebrief(chiusa(), 'u-aaa');
  assert.ok(!JSON.stringify(d).includes('u-bbb'));
});

test('il debrief non riporta mai cosa ha pensato l altra persona', () => {
  for (const utente of ['u-aaa', 'u-bbb']) {
    const testo = JSON.stringify(buildDebrief(chiusa(), utente));
    for (const vietata of VIETATO_NEL_DEBRIEF) {
      assert.ok(!vietata.test(testo), `il debrief viola la regola ${vietata}`);
    }
  }
});

test('il debrief dichiara di non sapere cosa ha pensato l altro', () => {
  const d = buildDebrief(chiusa(), 'u-aaa');
  assert.match(d.nota, /non sa cosa ha pensato l altra persona/i);
  assert.match(d.privacy, /non lo vedrai mai/i);
});

test('i due debrief sono diversi quando i comportamenti sono diversi', () => {
  const sessione = chiusa({ metriche: { quotaParlatoMedia: 0.8 } });
  const a = buildDebrief(sessione, 'u-aaa');
  const b = buildDebrief(sessione, 'u-bbb');
  assert.notDeepEqual(a.daProvare, b.daProvare);
});

test('un estraneo non puo chiedere un debrief', () => {
  assert.throws(() => buildDebrief(chiusa(), 'u-zzz'), /non fa parte/);
});

test('senza compagno acceso non c e debrief', () => {
  const d = buildDebrief(chiusa({ attivo: false }), 'u-aaa');
  assert.equal(d.disponibile, false);
  assert.match(d.motivo, /spento/i);
});

// --- Contenuto --------------------------------------------------------------

test('si parte sempre da cosa ha funzionato', () => {
  const d = buildDebrief(chiusa(), 'u-aaa');
  assert.ok(d.cosaHaFunzionato.length > 0);
});

test('anche una serata piatta riceve qualcosa di vero, non un complimento finto', () => {
  const d = buildDebrief(
    chiusa({
      metriche: { risate: 0, silenzioMedioSec: 20, quotaParlatoMedia: 0.8, domande: 0 },
      carteGiocate: [],
    }),
    'u-aaa',
  );
  assert.equal(d.cosaHaFunzionato.length, 1);
  assert.match(d.cosaHaFunzionato[0], /ci siete andati/i);
});

test('non piu di una cosa da provare: mai una pagella', () => {
  const d = buildDebrief(
    chiusa({ metriche: { quotaParlatoMedia: 0.9, domande: 0, risate: 0, silenzioMedioSec: 25 } }),
    'u-aaa',
  );
  assert.ok(d.daProvare === null || typeof d.daProvare.prova === 'string');
  assert.ok(!Array.isArray(d.daProvare));
});

test('chi ha tenuto il campo riceve il suggerimento di passare la palla', () => {
  const d = buildDebrief(chiusa({ metriche: { quotaParlatoMedia: 0.8 } }), 'u-aaa');
  assert.match(d.daProvare.prova, /domanda/i);
  assert.match(d.daProvare.osservazione, /80%/);
});

test('chi ha ascoltato molto non viene corretto ma incoraggiato', () => {
  const d = buildDebrief(chiusa({ metriche: { quotaParlatoMedia: 0.8 } }), 'u-bbb');
  assert.match(d.daProvare.prova, /niente di sbagliato nell ascoltare|portare una cosa tua/i);
});

test('una serata equilibrata non riceve correzioni inventate', () => {
  const d = buildDebrief(chiusa({ metriche: { quotaParlatoMedia: 0.5, domande: 12 } }), 'u-aaa');
  assert.equal(d.daProvare, null);
});

test('poche domande in una serata lunga vengono fatte notare', () => {
  const d = buildDebrief(
    chiusa({ durataMin: 100, metriche: { quotaParlatoMedia: 0.5, domande: 1 } }),
    'u-aaa',
  );
  assert.match(d.daProvare.osservazione, /1 domande|domande in tutto/i);
});

test('la carta che ha acceso la conversazione viene segnalata', () => {
  const d = buildDebrief(chiusa(), 'u-aaa');
  assert.ok(d.cosaHaFunzionato.some((x) => x.includes('Isola deserta')));
});

test('nessun voto alla serata o alla persona', () => {
  const testo = JSON.stringify(buildDebrief(chiusa(), 'u-aaa')).toLowerCase();
  for (const parola of ['voto', 'punteggio', 'stelle', 'valutazione']) {
    assert.ok(!testo.includes(parola), `il debrief non deve contenere "${parola}"`);
  }
});

// --- Segnali per il matcher -------------------------------------------------

test('i segnali per il matcher non contengono contenuto della conversazione', () => {
  const s = debriefSignalsForMatcher(chiusa());
  assert.equal(s.contieneContenutoConversazione, false);
  assert.equal(s.utilizzabile, true);
});

test('le categorie di carte sono ordinate per efficacia', () => {
  const s = debriefSignalsForMatcher(chiusa());
  assert.equal(s.categorieEfficaci[0].categoria, 'dilemma');
  const efficacie = s.categorieEfficaci.map((c) => c.efficacia);
  assert.deepEqual(efficacie, [...efficacie].sort((x, y) => y - x));
});

test('l autonomia e alta quando il compagno e intervenuto poco', () => {
  const silenzioso = debriefSignalsForMatcher(chiusa({ interventi: [] }));
  const invadente = debriefSignalsForMatcher(
    chiusa({ interventi: Array.from({ length: 6 }, () => ({ richiesto: false })) }),
  );
  assert.ok(silenzioso.autonomia > invadente.autonomia);
  assert.equal(silenzioso.autonomia, 1);
});

test('l equilibrio vale 1 quando i turni sono pari e 0 quando parla uno solo', () => {
  assert.equal(debriefSignalsForMatcher(chiusa({ metriche: { quotaParlatoMedia: 0.5 } })).equilibrio, 1);
  assert.equal(debriefSignalsForMatcher(chiusa({ metriche: { quotaParlatoMedia: 1 } })).equilibrio, 0);
});

test('senza compagno acceso non tornano segnali al matcher', () => {
  assert.equal(debriefSignalsForMatcher(chiusa({ attivo: false })).utilizzabile, false);
});

// --- Scambio di contatti a doppio consenso ----------------------------------

const ORA = new Date('2026-08-14T00:30:00+02:00');

test('lo scambio si sblocca solo se lo vogliono entrambi', () => {
  const s = apriScambioContatti(chiusa(), { now: ORA });
  rispondiScambioContatti(s, 'u-aaa', { vuole: true, contatto: 'a@example.com', now: ORA });
  rispondiScambioContatti(s, 'u-bbb', { vuole: true, contatto: 'b@example.com', now: ORA });

  const esito = chiudiScambioContatti(s, { now: ORA });
  assert.equal(esito.stato, 'scambiato');
  assert.equal(esito.esitiPerUtente['u-aaa'].contatto, 'b@example.com');
  assert.equal(esito.esitiPerUtente['u-bbb'].contatto, 'a@example.com');
});

test('chi ha detto si non scopre mai che l altro ha detto no', () => {
  const s = apriScambioContatti(chiusa(), { now: ORA });
  rispondiScambioContatti(s, 'u-aaa', { vuole: true, contatto: 'a@example.com', now: ORA });
  rispondiScambioContatti(s, 'u-bbb', { vuole: false, now: ORA });

  const esito = chiudiScambioContatti(s, { now: ORA });
  assert.equal(esito.stato, 'nessuno_scambio');
  const perA = esito.esitiPerUtente['u-aaa'];
  assert.equal(perA.contatto, null);
  assert.ok(!/rifiut|no |negat/i.test(perA.messaggio));
  // Identico a quello di chi ha rifiutato: nessuno dei due impara niente.
  assert.equal(perA.messaggio, esito.esitiPerUtente['u-bbb'].messaggio);
});

test('rifiuto e silenzio producono lo stesso esito', () => {
  const rifiutato = apriScambioContatti(chiusa(), { now: ORA });
  rispondiScambioContatti(rifiutato, 'u-aaa', { vuole: true, now: ORA });
  rispondiScambioContatti(rifiutato, 'u-bbb', { vuole: false, now: ORA });

  const ignorato = apriScambioContatti(chiusa(), { now: ORA });
  rispondiScambioContatti(ignorato, 'u-aaa', { vuole: true, now: ORA });
  const scaduto = new Date(ORA.getTime() + 13 * 3600000);

  assert.equal(
    chiudiScambioContatti(rifiutato, { now: ORA }).esitiPerUtente['u-aaa'].messaggio,
    chiudiScambioContatti(ignorato, { now: scaduto }).esitiPerUtente['u-aaa'].messaggio,
  );
});

test('finche mancano risposte non si comunica niente', () => {
  const s = apriScambioContatti(chiusa(), { now: ORA });
  rispondiScambioContatti(s, 'u-aaa', { vuole: true, now: ORA });
  assert.equal(chiudiScambioContatti(s, { now: ORA }).stato, 'in_attesa');
});

test('dopo la scadenza non si accettano risposte', () => {
  const s = apriScambioContatti(chiusa(), { now: ORA });
  const tardi = new Date(ORA.getTime() + 13 * 3600000);
  assert.equal(rispondiScambioContatti(s, 'u-aaa', { vuole: true, now: tardi }).ok, false);
});

test('un estraneo non partecipa allo scambio', () => {
  const s = apriScambioContatti(chiusa(), { now: ORA });
  assert.throws(() => rispondiScambioContatti(s, 'u-zzz', { vuole: true }), /non fa parte/);
});

test('la domanda dichiara subito la regola del doppio consenso', () => {
  const s = apriScambioContatti(chiusa(), { now: ORA });
  assert.match(s.domanda, /solo se lo volete tutti e due/i);
  assert.match(s.domanda, /non saprai mai/i);
});
