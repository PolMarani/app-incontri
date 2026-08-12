/**
 * Demo del flusso completo: `npm run demo`.
 *
 * Simula un ciclo di matching e stampa quello che vedrebbero i due utenti,
 * fase per fase, inclusi i casi in cui il match viene scartato.
 */

import {
  advance,
  autoRanking,
  checkIn,
  confirmCheckpoint,
  evaluateMatch,
  openSupportChannel,
  runMatchFlow,
  summarizePlan,
} from '../src/engine.js';
import { sampleProfile } from '../src/data/sample-profiles.js';

const NOW = new Date('2026-08-12T10:00:00+02:00'); // mercoledi mattina

const line = (char = '-') => console.log(char.repeat(72));
const title = (text) => {
  console.log('');
  line('=');
  console.log(text);
  line('=');
};

// ---------------------------------------------------------------------------
title('FASE 1 - Valutazione dei match possibili');

const a = sampleProfile('u-7f3a');
const candidati = ['u-91cd', 'u-2b60', 'u-4e12', 'u-8d55'].map(sampleProfile);

for (const b of candidati) {
  const ev = evaluateMatch(a, b);
  const stato = ev.proceed ? 'PROCEDE' : ev.eligible ? 'sotto soglia' : 'SCARTATO';
  console.log(`\n${a.id} x ${b.id}  ->  ${ev.score}%  [${stato}]`);
  console.log(
    '  dettaglio: ' +
      Object.entries(ev.breakdown)
        .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`)
        .join(' | '),
  );
  if (ev.blockers.length) console.log(`  blocchi: ${ev.blockers.join('; ')}`);
  if (ev.sharedInterests.length) {
    console.log(`  in comune: ${ev.sharedInterests.join(', ')}`);
  }
  if (ev.complementaryInterests.length) {
    console.log(`  divergenze: ${ev.complementaryInterests.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
const b = sampleProfile('u-91cd');
const flow = runMatchFlow(a, b, { now: NOW });

title(`FLUSSO COMPLETO ${a.id} x ${b.id}  ->  esito: ${flow.esito}`);

if (flow.esito !== 'incontro_fissato') {
  console.log(flow.motivo);
  process.exit(0);
}

// ---------------------------------------------------------------------------
title('FASE 2 - Le tre opzioni, come le vede ciascuno');

for (const utente of [a, b]) {
  console.log(`\nSchermata di ${utente.id}:`);
  for (const opzione of flow.fase2.proposal.viewFor(utente.id)) {
    console.log(`  [${opzione.optionId}] ${opzione.etichetta} - ${opzione.tipo}`);
    console.log(`      ${opzione.atmosfera}`);
    console.log(
      `      ${opzione.quando} | rumore ${opzione.rumore} | ${opzione.dal_tuo_punto_di_partenza}`,
    );
  }
  console.log(`  voto -> ${autoRanking(utente, flow.fase2.proposal.viewFor(utente.id)).join(' > ')}`);
}

console.log('\nConsenso:');
for (const riga of flow.fase2.consensus.tally) {
  console.log(
    `  ${riga.optionId}: somma piazzamenti ${riga.rankSum}, equita ${riga.fairness}`,
  );
}
console.log(`  scelta -> ${flow.fase2.consensus.chosen.optionId}`);

// ---------------------------------------------------------------------------
title('FASE 3 - Scheda incontro');

const scheda = flow.fase3;
console.log(`Luogo:  ${scheda.luogo.nome} - ${scheda.luogo.indirizzo}`);
console.log(`Tipo:   ${scheda.luogo.tipo} (${scheda.luogo.atmosfera})`);
console.log(`Quando: ${scheda.quando.giorno} ${scheda.quando.data} alle ${scheda.quando.ora}`);
console.log(`Match:  ${scheda.compatibilita}`);

console.log('\nCodice di riconoscimento:');
console.log(`  punto di ritrovo: ${scheda.riconoscimento.puntoDiRitrovo}`);
console.log(`  apri con:  "${scheda.riconoscimento.parolaChiave.apertura}"`);
console.log(`  risposta:  "${scheda.riconoscimento.parolaChiave.risposta}"`);
for (const [utente, segno] of Object.entries(scheda.riconoscimento.segnoVisivo)) {
  console.log(`  segno di ${utente}: ${segno}`);
}
console.log(`  arriva per primo: ${scheda.riconoscimento.arrivaPerPrimo}`);

console.log('\nIn evidenza per stasera:');
for (const carta of scheda.icebreakers.inEvidenza) {
  console.log(`  - [${carta.categoria}] ${carta.testo}`);
  console.log(`      (${carta.origine})`);
}

console.log(
  `\nMazzo completo: ${scheda.icebreakers.mazzo.length} carte ` +
    `(${Object.entries(scheda.icebreakers.perCategoria)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')})`,
);
console.log('Estratto dal mazzo:');
for (const carta of scheda.icebreakers.mazzo.slice(5, 12)) {
  console.log(`  - [${carta.categoria}] ${carta.testo}`);
}

// ---------------------------------------------------------------------------
title('FASE 4 - Conferme, check-in e supporto');

const plan = flow.fase4;
console.log('Scaletta conferme:');
for (const cp of summarizePlan(plan).conferme) {
  console.log(`  ${cp.quando} - scade il ${cp.scadenza} - ${cp.stato}`);
}

const inizio = new Date(scheda.quando.inizio);
const t = (ms) => new Date(inizio.getTime() + ms);

console.log('\n-- T-24h: conferma solo uno dei due');
console.log('  ' + confirmCheckpoint(plan, a.id, 'T-24h', { now: t(-25 * 3600e3) }).messaggio);
for (const azione of advance(plan, { now: t(-24 * 3600e3) }).azioni) {
  console.log(`  [${azione.tipo}] ${azione.utente ?? '-'}: ${azione.testo}`);
}
console.log('  ' + confirmCheckpoint(plan, b.id, 'T-24h', { now: t(-23 * 3600e3) }).messaggio);

console.log('\n-- T-6h e T-1h: confermano entrambi');
for (const step of ['T-6h', 'T-1h']) {
  const quando = step === 'T-6h' ? t(-6 * 3600e3) : t(-3600e3);
  confirmCheckpoint(plan, a.id, step, { now: quando });
  console.log('  ' + confirmCheckpoint(plan, b.id, step, { now: quando }).messaggio);
}

console.log('\n-- Arrivo al locale');
console.log('  ' + checkIn(plan, a.id, { now: t(-5 * 60e3) }).messaggio);
for (const azione of advance(plan, { now: t(20 * 60e3) }).azioni) {
  console.log(`  [${azione.tipo}] ${azione.utente ?? '-'}: ${azione.testo}`);
}

console.log('\n-- Supporto: chi ha aspettato apre il canale');
const supporto = openSupportChannel(plan, {
  utente: a.id,
  motivo: 'ritardo',
  now: t(22 * 60e3),
});
console.log(`  canale: ${supporto.canale} (priorita ${supporto.priorita})`);
console.log(`  ${supporto.apertura}`);
console.log(`  ${supporto.trasparenza}`);

console.log('\n-- Supporto: segnalazione di rischio nel testo libero');
const urgente = openSupportChannel(plan, {
  utente: a.id,
  motivo: 'ritardo',
  testoLibero: 'mi sta seguendo, ho paura',
  now: t(40 * 60e3),
});
console.log(`  canale: ${urgente.canale} (priorita ${urgente.priorita})`);
console.log(`  risorse: ${urgente.risorse.map((r) => `${r.nome} ${r.numero}`).join(' | ')}`);
console.log(`  notifica all altra persona: ${urgente.notificaAllAltro}`);

console.log('\n-- Stato finale');
console.log('  ' + JSON.stringify(summarizePlan(plan).conferme.map((c) => c.stato)));
console.log(`  stato incontro: ${summarizePlan(plan).stato}`);
line('=');
