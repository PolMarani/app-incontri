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
  chiudiGioco,
  closeEvening,
  confirmCheckpoint,
  createEvening,
  debriefSignalsForMatcher,
  evaluateMatch,
  openSupportChannel,
  rispondiAffetto,
  rispondiGioco,
  runMatchFlow,
  summarizePlan,
  tickEvening,
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
title('FASI 5, 7, 8 - La serata, un ciclo solo');

console.log('Consensi separati: si puo accettare il compagno e rifiutare il resto.');
const parziale = createEvening(scheda, {
  consensi: { compagno: { [a.id]: true, [b.id]: true } },
});
console.log(`  compagno=${parziale.attive.compagno} affetto=${parziale.attive.affetto} giochi=${parziale.attive.giochi}`);

const serata = createEvening(scheda, {
  consensi: {
    compagno: { [a.id]: true, [b.id]: true },
    affetto: { [a.id]: true, [b.id]: true },
    giochi: { [a.id]: true, [b.id]: true },
  },
});
console.log(`\nSerata avviata: "${serata.apertura}"`);

/**
 * Clima simulato: imbarazzo iniziale, la conversazione che parte, un calo a
 * meta, e la ripresa finale.
 */
function clima(minuti) {
  if (minuti < 8) return { energia: 0.2, silenzioSec: 12, risate: 0 };
  if (minuti < 30) return { energia: 0.75, silenzioSec: 1, risate: 2, domande: 3 };
  if (minuti < 55) return { energia: 0.35, silenzioSec: 20, risate: 0 };
  if (minuti < 85) return { energia: 0.62, silenzioSec: 3, risate: 2, domande: 2 };
  return { energia: 0.25, silenzioSec: 25, risate: 0 };
}

console.log('\nCosa arriva al tavolo, e da quale fase:');
const aperte = [];
for (let sec = 120; sec < 115 * 60; sec += 60) {
  const minuti = sec / 60;
  const { azioni, sicurezza } = tickEvening(serata, {
    t: sec,
    quotaParlato: 0.55,
    rischio: 'nessuno',
    ...clima(minuti),
  });
  if (sicurezza) continue;

  for (const azione of azioni) {
    const m = String(Math.round(minuti)).padStart(3);
    if (azione.fonte === 'compagno') {
      console.log(`  ${m}'  [compagno/${azione.tipo}] ${azione.frase}`);
      if (azione.carta) console.log(`         -> ${azione.carta.testo}`);
    } else if (azione.fonte === 'affetto') {
      console.log(`  ${m}'  [affetto] ${azione.proposta.schermata.titolo}`);
      console.log(`         "${azione.proposta.schermata.istruzione}"`);
      aperte.push(azione);
    } else if (azione.fonte === 'giochi') {
      console.log(`  ${m}'  [gioco] ${azione.proposta.schermata.titolo} (${azione.proposta.schermata.durataMin} min)`);
      console.log(`         ${azione.proposta.schermata.premessa}`);
      aperte.push(azione);
    }
  }

  // Rispondono subito: entrambi si, tranne al primo gioco.
  for (const azione of aperte.splice(0)) {
    const t = sec + 20;
    if (azione.fonte === 'affetto') {
      rispondiAffetto(serata, azione.proposta.id, a.id, { accetta: true, t });
      const esito = rispondiAffetto(serata, azione.proposta.id, b.id, { accetta: true, t });
      console.log(`         esito -> ${esito.stato}`);
    } else {
      rispondiGioco(serata, azione.proposta.id, a.id, { accetta: true, t });
      rispondiGioco(serata, azione.proposta.id, b.id, { accetta: true, t });
      const fine = chiudiGioco(serata, azione.proposta.id, { t: t + 300 });
      console.log(`         fine -> ${fine.chiusura}`);
    }
  }
}

const rinunce = serata.log.filter((x) => x.tipo === 'rinunciato').length;
console.log(`\nVolte in cui il compagno ha rinunciato perche il telefono era occupato: ${rinunce}`);

console.log('\nSicurezza: un allarme spegne affetto e giochi per il resto della serata');
const conRischio = createEvening(scheda, {
  consensi: {
    compagno: { [a.id]: true, [b.id]: true },
    affetto: { [a.id]: true, [b.id]: true },
    giochi: { [a.id]: true, [b.id]: true },
  },
});
const allarme = tickEvening(conRischio, { t: 1200, rischio: 'allarme', energia: 0.5 });
console.log(`  sicurezza: ${allarme.sicurezza.motivoSupporto}, visibile al tavolo: ${allarme.sicurezza.visibileAlTavolo}`);
console.log(`  affetto bloccato: ${conRischio.affetto.bloccatoPerSicurezza}, giochi bloccati: ${conRischio.giochi.bloccatoPerSicurezza}`);

const chiusa = closeEvening(serata, { durataEffettivaMin: 95 });
console.log('\nA fine serata:');
console.log(`  interruzioni totali: ${chiusa.attenzione.interruzioni} (budget ${chiusa.attenzione.pesoSpeso}/${chiusa.attenzione.maxPeso})`);
console.log(`  per fase: ${JSON.stringify(chiusa.attenzione.perFase)}`);
console.log(`  momenti condivisi: ${chiusa.affetto.momentiCondivisi.map((m) => m.titolo).join(', ') || 'nessuno'}`);
console.log(`  giochi: ${chiusa.giochi.giocati.map((g) => g.titolo).join(', ') || 'nessuno'}`);
console.log(`  autonomia della coppia: ${chiusa.autonomia.toFixed(2)}`);

// ---------------------------------------------------------------------------
title('FASE 6 - Debrief privato, uno per ciascuno');

const sessioneChiusa = chiusa.sessione;
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
