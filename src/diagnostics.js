/**
 * Diagnostica di prodotto sul catalogo dei locali.
 *
 * Metrica che vale la pena guardare almeno quanto il tasso di match: **quanta
 * parte del catalogo e' davvero utilizzabile da chi ha dei vincoli.** Un
 * catalogo che copre benissimo l'utente mediano e lascia il 12% dei locali a
 * chi si muove in sedia a rotelle produce un'app che funziona bene solo per
 * alcuni - e, senza misurarlo, nessuno se ne accorge: quegli utenti non si
 * lamentano, semplicemente ricevono meno proposte e smettono.
 */

import { loadVenues } from './data/venues.js';

/** Profili di vincoli su cui misurare la copertura. */
export const PROFILI_DI_VINCOLO = {
  nessuno: {},
  senza_alcolici: { noAlcohol: true },
  sedia_a_rotelle: { wheelchairAccess: true },
  serve_silenzio: { lowNoise: true },
  solo_all_aperto: { outdoorOnly: true },
  astemio_in_sedia: { noAlcohol: true, wheelchairAccess: true },
};

/**
 * Un locale e' compatibile con questi vincoli?
 * @param {import('./types.js').Venue} venue
 * @param {import('./types.js').VenueConstraints} vincoli
 */
function compatibile(venue, vincoli) {
  const f = venue.features;
  if (!f.publicPlace || !f.staffed || !f.wellLit || venue.safetyScore < 0.6) return false;
  if (vincoli.noAlcohol && f.servesAlcohol) return false;
  if (vincoli.wheelchairAccess && !f.wheelchairAccess) return false;
  if (vincoli.lowNoise && f.noiseLevel === 'alto') return false;
  if (vincoli.outdoorOnly && !f.outdoor) return false;
  return true;
}

/**
 * Copertura del catalogo per ciascun profilo di vincoli.
 *
 * @param {{ venues?: import('./types.js').Venue[], sogliaAllarme?: number }} [options]
 * @returns {{ totale: number, profili: object[], allarmi: string[] }}
 */
export function coperturaCatalogo(options = {}) {
  const venues = options.venues ?? loadVenues();
  const soglia = options.sogliaAllarme ?? 0.4;

  const profili = Object.entries(PROFILI_DI_VINCOLO).map(([nome, vincoli]) => {
    const utilizzabili = venues.filter((v) => compatibile(v, vincoli));
    const quota = venues.length ? utilizzabili.length / venues.length : 0;
    return {
      profilo: nome,
      utilizzabili: utilizzabili.length,
      quota: Math.round(quota * 100) / 100,
      // Le vibe raggiungibili contano quanto il numero: dieci locali tutti
      // uguali non sono una scelta.
      vibe: [...new Set(utilizzabili.flatMap((v) => v.vibes))].sort(),
    };
  });

  const allarmi = profili
    .filter((p) => p.profilo !== 'nessuno' && p.quota < soglia)
    .map(
      (p) =>
        `"${p.profilo}": solo il ${Math.round(p.quota * 100)}% del catalogo e utilizzabile ` +
        `(${p.utilizzabili} locali, vibe: ${p.vibe.join(', ') || 'nessuna'})`,
    );

  return { totale: venues.length, profili, allarmi };
}

/**
 * Copertura oraria: quanti locali sono aperti in ciascuna fascia della
 * settimana. Serve a scoprire i buchi - tipicamente la domenica sera e i
 * pomeriggi infrasettimanali - prima che li scoprano gli utenti sotto forma di
 * "nessun luogo disponibile".
 *
 * @param {{ venues?: import('./types.js').Venue[] }} [options]
 */
export function coperturaOraria(options = {}) {
  const venues = options.venues ?? loadVenues();
  const giorni = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const fasce = [
    { nome: 'pomeriggio', dalle: 15, alle: 18 },
    { nome: 'aperitivo', dalle: 18, alle: 21 },
    { nome: 'sera', dalle: 21, alle: 24 },
  ];

  const griglia = {};
  for (const giorno of giorni) {
    griglia[giorno] = {};
    for (const fascia of fasce) {
      griglia[giorno][fascia.nome] = venues.filter((v) =>
        v.openingHours.some((h) => {
          if (h.day !== giorno) return false;
          const apre = Number(h.start.split(':')[0]);
          const chiude = Number(h.end.split(':')[0]) || 24;
          const fine = chiude <= apre ? chiude + 24 : chiude;
          return apre < fascia.alle && fine > fascia.dalle;
        }),
      ).length;
    }
  }

  const buchi = [];
  for (const [giorno, fasceGiorno] of Object.entries(griglia)) {
    for (const [fascia, quanti] of Object.entries(fasceGiorno)) {
      if (quanti < 3) buchi.push(`${giorno} ${fascia}: solo ${quanti} locali`);
    }
  }
  return { griglia, buchi };
}
