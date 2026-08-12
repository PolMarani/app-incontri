/**
 * Demo del flusso completo: `npm run demo`.
 *
 * Simula un ciclo di matching e stampa quello che vedrebbero i due utenti,
 * fase per fase, inclusi i casi in cui il match viene scartato.
 */

import {
  advance,
  autoRanking,
  buildDebrief,
  checkIn,
  closeCompanionSession,
  confirmCheckpoint,
  createAffectionTrack,
  createCompanionSession,
  debriefSignalsForMatcher,
  maybePropose,
  respond,
  summarizeAffection,
  evaluateMatch,
  observe,
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

// ---------------------------------------------------------------------------
title('FASE 5 - Il terzo compagno durante la serata');

const spento = createCompanionSession(scheda, { consenso: { [a.id]: true } });
console.log(`Con il consenso di uno solo: attivo=${spento.attivo}`);
console.log(`  ${spento.motivo}`);

const compagno = createCompanionSession(scheda, {
  consenso: { [a.id]: true, [b.id]: true },
});
console.log(`\nCon il consenso di entrambi: attivo=${compagno.attivo}, modo=${compagno.modo}`);
console.log(`  apertura: "${compagno.apertura}"`);
for (const garanzia of compagno.garanzie) console.log(`  - ${garanzia}`);

/**
 * Traccia simulata della serata. Ogni riga e' un tick di segnali derivati
 * (mai audio): imbarazzo iniziale, la conversazione che parte, uno sbilancio
 * dei turni, un momento allegro e il calo finale.
 */
const traccia = [
  { t: 120, silenzioSec: 11, energia: 0.2, quotaParlato: 0.5, risate: 0 },
  { t: 240, silenzioSec: 2, energia: 0.5, quotaParlato: 0.55, risate: 1, domande: 2 },
  { t: 900, silenzioSec: 1, energia: 0.8, quotaParlato: 0.6, risate: 2, domande: 3 },
  { t: 1500, silenzioSec: 1, energia: 0.55, quotaParlato: 0.86, risate: 1 },
  { t: 1800, silenzioSec: 2, energia: 0.5, quotaParlato: 0.88, risate: 0 },
  { t: 2100, silenzioSec: 3, energia: 0.5, quotaParlato: 0.87, risate: 0 },
  { t: 2400, silenzioSec: 1, energia: 0.6, quotaParlato: 0.6, risate: 3, domande: 2 },
  { t: 3000, silenzioSec: 1, energia: 0.65, quotaParlato: 0.5, risate: 2, domande: 4 },
  { t: 3600, silenzioSec: 14, energia: 0.35, quotaParlato: 0.5, risate: 0 },
  { t: 4200, silenzioSec: 4, energia: 0.5, quotaParlato: 0.5, risate: 1, domande: 1 },
  { t: 5700, silenzioSec: 30, energia: 0.1, quotaParlato: 0.5, risate: 0 },
];

console.log('\nCosa fa, minuto per minuto:');
for (const t of traccia) {
  const { intervento, stato } = observe(compagno, { rischio: 'nessuno', ...t });
  const minuto = String(Math.round(t.t / 60)).padStart(3);
  if (intervento) {
    console.log(`  ${minuto}'  [${intervento.tipo}] ${intervento.frase}`);
    if (intervento.carta) console.log(`        -> ${intervento.carta.testo}`);
  } else {
    console.log(`  ${minuto}'  (${stato})`);
  }
}

console.log('\nUno dei due chiede una carta:');
const richiesta = observe(compagno, { t: 4500, richiestaDa: b.id, rischio: 'nessuno' });
console.log(`  [${richiesta.intervento.tipo}] ${richiesta.intervento.frase}`);
console.log(`        -> ${richiesta.intervento.carta.testo}`);

console.log('\nSegnale di allarme dal microfono:');
const allarme = observe(compagno, { t: 4800, rischio: 'allarme', energia: 0.4 });
console.log(`  sicurezza: ${allarme.sicurezza.livello} -> ${allarme.sicurezza.motivoSupporto}`);
console.log(`  visibile al tavolo: ${allarme.sicurezza.visibileAlTavolo}`);
console.log(`  ${allarme.sicurezza.azione}`);
console.log(`  detto ad alta voce: ${allarme.intervento === null ? 'niente' : 'qualcosa'}`);

// ---------------------------------------------------------------------------
title('FASE 7 - Momenti di affetto');

const spentoAffetto = createAffectionTrack(scheda, {
  consenso: { [a.id]: true, [b.id]: true },
  profili: { [b.id]: { contattoFisico: false } },
});
console.log(`Se uno dei due non vuole contatto fisico: attivo=${spentoAffetto.attivo}`);
console.log(`  ${spentoAffetto.motivo}`);

const affetto = createAffectionTrack(scheda, {
  consenso: { [a.id]: true, [b.id]: true },
});
console.log(`\nCon il consenso di entrambi: attivo=${affetto.attivo}`);
for (const riga of affetto.promessa) console.log(`  - ${riga}`);

/** La serata scorre: si propone solo dove il clima regge. */
const risposteSimulate = [true, true, false];
let proposteFatte = 0;

console.log('\nCosa succede durante la serata:');
for (let sec = 600; sec < 115 * 60; sec += 60) {
  // Clima freddo nella prima mezz ora, poi la serata si scalda.
  const minuti = sec / 60;
  const clima =
    minuti < 25
      ? { energia: 0.3, risate: 0, silenzioSec: 8 }
      : { energia: 0.7, risate: 2, silenzioSec: 1 };
  const { proposta, motivo } = maybePropose(affetto, { t: sec, rischio: 'nessuno', ...clima });
  if (!proposta) {
    if (minuti === 15) console.log(`   15'  (${motivo}: la serata e ancora fredda)`);
    continue;
  }

  const rispostaB = risposteSimulate[proposteFatte] ?? true;
  proposteFatte += 1;
  console.log(`\n  ${String(proposta.minuto).padStart(3)}'  proposta: ${proposta.schermata.titolo}`);
  console.log(`        schermo di ${a.id}: "${proposta.schermata.cornice}"`);
  console.log(`        "${proposta.schermata.istruzione}"`);
  if (proposta.schermata.nota) console.log(`        nota: ${proposta.schermata.nota}`);

  respond(affetto, proposta.id, a.id, { accetta: true, t: sec + 10 });
  const esito = respond(affetto, proposta.id, b.id, { accetta: rispostaB, t: sec + 20 });
  console.log(`        esito -> ${esito.stato}: "${esito.messaggio}"`);
  if (esito.stato === 'non_riuscita') {
    console.log(`        (${a.id} aveva accettato, ma non lo sapra mai)`);
  }
}

const riepilogoAffetto = summarizeAffection(affetto);
console.log('\nCosa resta agli atti:');
console.log(
  `  momenti condivisi: ${riepilogoAffetto.momentiCondivisi.map((m) => m.titolo).join(', ') || 'nessuno'}`,
);
console.log(`  rifiuti registrati: ${riepilogoAffetto.rifiutiRegistrati}`);

console.log('\nCon un segnale di rischio la funzione si chiude per la serata:');
const conRischio = createAffectionTrack(scheda, { consenso: { [a.id]: true, [b.id]: true } });
maybePropose(conRischio, { t: 1800, rischio: 'disagio', energia: 0.8, risate: 3 });
const dopo = maybePropose(conRischio, { t: 3600, rischio: 'nessuno', energia: 0.9, risate: 5 });
console.log(`  clima ottimo mezz ora dopo -> ${dopo.motivo}`);

// ---------------------------------------------------------------------------
title('FASE 6 - Debrief privato, uno per ciascuno');

const sessioneChiusa = closeCompanionSession(compagno, { durataEffettivaMin: 95 });
console.log('Metriche della serata (nessun contenuto, solo numeri):');
for (const [chiave, valore] of Object.entries(sessioneChiusa.metriche)) {
  console.log(`  ${chiave}: ${typeof valore === 'number' ? valore.toFixed(2) : valore}`);
}

for (const utente of [a, b]) {
  const debrief = buildDebrief(sessioneChiusa, utente.id);
  console.log(`\nDebrief di ${utente.id}:`);
  for (const riga of debrief.cosaHaFunzionato) console.log(`  + ${riga}`);
  if (debrief.daProvare) {
    console.log(`  ~ ${debrief.daProvare.osservazione}`);
    console.log(`    ${debrief.daProvare.prova}`);
  } else {
    console.log('  ~ niente da correggere: non si inventa una critica per riempire.');
  }
  console.log(`  ${debrief.privacy}`);
}

const segnali = debriefSignalsForMatcher(sessioneChiusa);
console.log('\nCosa torna al matcher:');
console.log(`  autonomia della coppia: ${segnali.autonomia.toFixed(2)}`);
console.log(`  equilibrio dei turni: ${segnali.equilibrio.toFixed(2)}`);
console.log(
  `  categorie che hanno funzionato: ${segnali.categorieEfficaci
    .map((c) => `${c.categoria} ${c.efficacia.toFixed(2)}`)
    .join(', ')}`,
);
console.log(`  contiene contenuto della conversazione: ${segnali.contieneContenutoConversazione}`);
line('=');
