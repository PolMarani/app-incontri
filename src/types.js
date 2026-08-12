/**
 * Tipi del dominio BlindStep (JSDoc, cosi' l'editor tipizza senza build step).
 *
 * Il profilo che arriva al motore e' gia' anonimizzato a monte: niente nome,
 * niente foto, niente contatti. Il motore non deve mai poter comporre
 * un'identita', e non deve mai restituire a un utente un dato dell'altro che
 * non sia esplicitamente pensato per essere condiviso.
 */

/**
 * @typedef {import('./util/geo.js').GeoPoint} GeoPoint
 * @typedef {import('./util/time.js').AvailabilityWindow} AvailabilityWindow
 */

/**
 * @typedef {Object} Profile
 * @property {string} id                       pseudonimo opaco ruotato a ogni ciclo
 * @property {AvailabilityWindow[]} availability finestre settimanali ricorrenti
 * @property {string[]} interests              tag della tassonomia
 * @property {string[]} [values]               valori dichiarati
 * @property {string[]} [curiosities]          "passioni strane", usate per gli icebreaker
 * @property {string[]} vibes                  vibe desiderate, in ordine di preferenza
 * @property {GeoPoint} origin                 zona di partenza (mai esposta all'altro)
 * @property {number} [maxTravelKm]            raggio di spostamento accettato (default 5)
 * @property {string[]} [dealbreakers]         tag che rendono il match impossibile
 * @property {VenueConstraints} [constraints]  requisiti sul locale
 * @property {string[]} [languages]            lingue parlate
 */

/**
 * @typedef {Object} VenueConstraints
 * @property {boolean} [noAlcohol]        serve un posto dove non si beve
 * @property {boolean} [wheelchairAccess] accessibilita' in sedia a rotelle
 * @property {boolean} [lowNoise]         serve un posto silenzioso
 * @property {boolean} [outdoorOnly]      solo spazi aperti
 */

/**
 * @typedef {Object} Venue
 * @property {string} id
 * @property {string} name
 * @property {string} address
 * @property {GeoPoint} location
 * @property {string[]} vibes             vibe che il locale copre
 * @property {AvailabilityWindow[]} openingHours
 * @property {VenueFeatures} features
 * @property {number} safetyScore         0..1, dato dallo staff BlindStep
 * @property {string} atmosphere          descrizione neutra per l'opzione anonima
 * @property {string[]} recognitionSpots  punti del locale usabili come ritrovo
 */

/**
 * @typedef {Object} VenueFeatures
 * @property {boolean} publicPlace        sempre richiesto
 * @property {boolean} staffed            personale presente per tutta l'apertura
 * @property {boolean} wellLit
 * @property {boolean} transitNearby      mezzi pubblici a meno di 5 minuti
 * @property {boolean} [servesAlcohol]
 * @property {boolean} [wheelchairAccess]
 * @property {boolean} [outdoor]
 * @property {'basso'|'medio'|'alto'} noiseLevel
 */

/**
 * @typedef {Object} CompatibilityBreakdown
 * @property {number} availability
 * @property {number} geography
 * @property {number} vibe
 * @property {number} interests
 * @property {number} values
 * @property {number} spark
 */

/**
 * @typedef {Object} MatchEvaluation
 * @property {boolean} eligible           supera i gate obbligatori
 * @property {number} score               0..100
 * @property {boolean} proceed            eligible && score >= soglia
 * @property {CompatibilityBreakdown} breakdown
 * @property {string[]} blockers          motivi di esclusione
 * @property {string[]} sharedInterests
 * @property {string[]} complementaryInterests
 * @property {string[]} sharedValues
 * @property {import('./util/time.js').MinuteWindow[]} commonWindows
 * @property {string[]} consensusVibes
 */

// Il file esporta solo tipi: questo export tiene il modulo valido come ESM.
export const TYPES_ONLY = true;
