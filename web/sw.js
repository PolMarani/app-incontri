/**
 * Service worker: l'app deve aprirsi anche senza rete.
 *
 * Non e' un vezzo da PWA: il motore gira tutto sul dispositivo e la serata si
 * svolge dentro un locale, dove la linea puo' non esserci. Un'app che a quel
 * punto mostra una pagina bianca ha fallito proprio nel momento in cui serviva.
 */

const CACHE = 'blindstep-v1';

/** Tutto cio' che serve per partire: pagina, stile, app e ogni modulo del motore. */
const RISORSE = [
  '/web/index.html',
  '/web/app.css',
  '/web/app.js',
  '/web/manifest.webmanifest',
  '/web/icons/icon-192.png',
  '/web/icons/icon-512.png',
  '/src/engine.js',
  '/src/evening.js',
  '/src/attention.js',
  '/src/matching-round.js',
  '/src/reputation.js',
  '/src/validation.js',
  '/src/diagnostics.js',
  '/src/types.js',
  '/src/phase1-compatibility.js',
  '/src/phase2-location.js',
  '/src/phase3-eventcard.js',
  '/src/phase4-safety.js',
  '/src/phase5-companion.js',
  '/src/phase6-debrief.js',
  '/src/phase7-affection.js',
  '/src/phase8-games.js',
  '/src/util/geo.js',
  '/src/util/rng.js',
  '/src/util/time.js',
  '/src/data/taxonomy.js',
  '/src/data/venues.js',
  '/src/data/icebreakers.js',
  '/src/data/companion-lines.js',
  '/src/data/affection-moments.js',
  '/src/data/games.js',
  '/src/data/sample-profiles.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(RISORSE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  // Prima la cache: i file dell'app non cambiano fra un avvio e l'altro, e la
  // velocita' conta piu' della freschezza per un'app che si apre in piedi
  // davanti a un locale.
  evento.respondWith(
    caches.match(evento.request).then(
      (trovata) =>
        trovata ??
        fetch(evento.request)
          .then((risposta) => {
            const copia = risposta.clone();
            caches.open(CACHE).then((c) => c.put(evento.request, copia));
            return risposta;
          })
          .catch(() => caches.match('/web/index.html')),
    ),
  );
});
