import test from 'node:test';
import assert from 'node:assert/strict';

import { autoRanking, runMatchFlow } from '../src/engine.js';
import { sampleProfile } from '../src/data/sample-profiles.js';

const NOW = new Date('2026-08-12T10:00:00+02:00');

test('il flusso completo di una coppia compatibile arriva a un incontro fissato', () => {
  const flow = runMatchFlow(sampleProfile('u-7f3a'), sampleProfile('u-91cd'), { now: NOW });
  assert.equal(flow.esito, 'incontro_fissato');
  assert.ok(flow.fase1.score >= 80);
  assert.ok(flow.fase2.consensus.ok);
  assert.ok(flow.fase3.luogo.nome.length > 0);
  assert.equal(flow.fase4.checkpoints.length, 3);
});

test('il flusso si ferma in Fase 1 se manca la compatibilita, senza toccare le fasi dopo', () => {
  const flow = runMatchFlow(sampleProfile('u-7f3a'), sampleProfile('u-4e12'), { now: NOW });
  assert.equal(flow.esito, 'non_compatibile');
  assert.equal(flow.fase2, undefined);
  assert.equal(flow.fase3, undefined);
  assert.ok(flow.motivo.length > 0);
});

test('un punteggio sotto soglia e distinto da una incompatibilita', () => {
  const flow = runMatchFlow(sampleProfile('u-7f3a'), sampleProfile('u-8d55'), { now: NOW });
  assert.equal(flow.esito, 'sotto_soglia');
  assert.equal(flow.fase1.eligible, true);
  assert.match(flow.motivo, /soglia/i);
});

test('se i due non trovano un accordo sul posto non si fissa niente', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const flow = runMatchFlow(a, b, {
    now: NOW,
    maxRounds: 1,
    rankings: { [a.id]: ['opt-1'], [b.id]: ['opt-3'] },
  });
  assert.equal(flow.esito, 'nessun_consenso');
  assert.equal(flow.fase3, undefined);
});

test('senza locali disponibili il flusso lo dice invece di inventare un posto', () => {
  const flow = runMatchFlow(sampleProfile('u-7f3a'), sampleProfile('u-91cd'), {
    now: NOW,
    venues: [],
  });
  assert.equal(flow.esito, 'nessuna_location');
  assert.ok(flow.motivo.length > 0);
});

test('il voto automatico usa solo la vista anonima del singolo utente', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const flow = runMatchFlow(a, b, { now: NOW });
  const vista = flow.fase2.proposal.viewFor(a.id);
  const voto = autoRanking(a, vista);
  assert.ok(voto.length > 0);
  assert.ok(voto.every((id) => vista.some((o) => o.optionId === id)));
});

test('il voto automatico scarta le opzioni troppo lontane', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const flow = runMatchFlow(a, b, { now: NOW });
  const vista = flow.fase2.proposal.viewFor(a.id);
  assert.deepEqual(autoRanking(a, vista, { maxTravelMinutes: 0 }), []);
});

test('la scheda consegnata a un utente non contiene dati dell altro', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const flow = runMatchFlow(a, b, { now: NOW });
  const scheda = flow.schedaPer(a.id);
  const serializzato = JSON.stringify(scheda);

  assert.ok(!serializzato.includes(b.origin.label), 'niente zona di partenza dell altro');
  assert.ok(!serializzato.includes(String(b.origin.lat)));
  for (const curiosita of b.curiosities) {
    // Le curiosita' dell'altro possono comparire solo dentro le carte, mai
    // come dato di profilo.
    const nelleCarte = scheda.icebreakers.mazzo.some((c) => c.testo.includes(curiosita));
    if (serializzato.includes(curiosita)) assert.ok(nelleCarte);
  }
});

test('lo stesso match rieseguito produce lo stesso risultato', () => {
  const uno = runMatchFlow(sampleProfile('u-7f3a'), sampleProfile('u-91cd'), { now: NOW });
  const due = runMatchFlow(sampleProfile('u-7f3a'), sampleProfile('u-91cd'), { now: NOW });
  assert.equal(uno.fase3.luogo.nome, due.fase3.luogo.nome);
  assert.equal(uno.fase3.quando.inizio, due.fase3.quando.inizio);
  assert.deepEqual(uno.fase3.riconoscimento, due.fase3.riconoscimento);
});

test('l incontro fissato cade dentro la finestra comune dichiarata', () => {
  const a = sampleProfile('u-7f3a');
  const b = sampleProfile('u-91cd');
  const flow = runMatchFlow(a, b, { now: NOW });
  const giorni = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const inizio = new Date(flow.fase3.quando.inizio);
  const giorno = giorni[inizio.getDay()];
  const minuti = inizio.getHours() * 60 + inizio.getMinutes();

  for (const profilo of [a, b]) {
    const finestra = profilo.availability.find((w) => w.day === giorno);
    assert.ok(finestra, `${profilo.id} deve essere libero di ${giorno}`);
    const [h, m] = finestra.start.split(':').map(Number);
    assert.ok(minuti >= h * 60 + m, `l orario deve rientrare nella disponibilita di ${profilo.id}`);
  }
});
