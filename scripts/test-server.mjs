// Kleiner Webserver für die Tests: liefert das Repo so aus, wie GitHub Pages es tut (index.html, release/, assets/).
// Aufruf: node scripts/test-server.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.argv[2] || process.env.PORT || 4173);
const typen = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml',
  '.sh': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

createServer(async (req, res) => {
  try {
    let pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let datei = normalize(join(root, pfad));
    if (!datei.startsWith(root) || pfad.includes('/node_modules/') || pfad.includes('/.git')) throw new Error('verboten');
    if ((await stat(datei)).isDirectory()) datei = join(datei, 'index.html');
    const inhalt = await readFile(datei);
    res.writeHead(200, { 'content-type': typen[extname(datei)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(inhalt);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('nicht gefunden');
  }
}).listen(port, '127.0.0.1', () => console.log(`Testserver auf http://127.0.0.1:${port}/`));
