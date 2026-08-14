/**
 * Server statico minimo per il prototipo web: `npm run web`.
 *
 * Serve la radice del repository, non solo `web/`, cosi' la pagina puo'
 * importare `/src/engine.js` direttamente. Il motore e' ESM senza dipendenze e
 * senza moduli di Node: il browser lo esegue tale e quale, quindi quello che si
 * vede a schermo e' il motore vero e non una sua imitazione.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = fileURLToPath(new URL('..', import.meta.url));
const PORTA = Number(process.env.PORT ?? 4173);

const TIPI = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const percorso = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  // Il service worker va servito dalla radice: uno script in /web/ ha scope
  // /web/ e non controllerebbe la pagina aperta su /, quindi l'app sembrerebbe
  // installabile e offline senza esserlo davvero.
  const relativo =
    percorso === '/' ? 'web/index.html'
    : percorso === '/sw.js' ? 'web/sw.js'
    : normalize(percorso).replace(/^(\.\.[/\\])+/, '');
  const file = join(RADICE, relativo);

  // Nessun accesso fuori dalla radice del repository.
  if (!file.startsWith(RADICE)) {
    res.writeHead(403).end('Vietato');
    return;
  }

  try {
    const contenuto = await readFile(file);
    res.writeHead(200, {
      'content-type': TIPI[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(contenuto);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Non trovato: ${relativo}`);
  }
});

server.listen(PORTA, () => {
  console.log(`BlindStep, prototipo: http://localhost:${PORTA}`);
});
