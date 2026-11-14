// Baut Player, Panel und Konfigurator zu je einer einzelnen HTML-Datei in release/.
// Die Box braucht genau eine Datei ohne Abhängigkeiten, deshalb wird alles eingebettet.
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apps = ['player', 'konfigurator', 'panel'];

await mkdir(resolve(root, 'release'), { recursive: true });
for (const app of apps) {
  const outDir = resolve(root, 'dist', app);
  await build({
    root: resolve(root, app),
    logLevel: 'warn',
    plugins: [viteSingleFile()],
    build: { outDir, emptyOutDir: true },
  });
  await copyFile(resolve(outDir, 'index.html'), resolve(root, 'release', `${app}.html`));
}
await rm(resolve(root, 'dist'), { recursive: true, force: true });

// Panel als App (PWA): Manifest, Icons und Service Worker neben panel.html legen.
// Sie liegen relativ zu panel.html, deshalb läuft es unter jedem Unterpfad (z.B. GitHub Pages /showcube/release/).
const rel = resolve(root, 'release');
await mkdir(resolve(rel, 'pwa'), { recursive: true });
for (const f of await readdir(resolve(root, 'pwa/bilder'))) await copyFile(resolve(root, 'pwa/bilder', f), resolve(rel, 'pwa', f));
await copyFile(resolve(root, 'pwa/panel.webmanifest'), resolve(rel, 'panel.webmanifest'));
const head = [
  '<link rel="manifest" href="panel.webmanifest">',
  '<link rel="icon" type="image/png" sizes="32x32" href="pwa/favicon-32.png">',
  '<link rel="apple-touch-icon" href="pwa/apple-touch-icon.png">',
  '<meta name="application-name" content="ShowCube">',
  '<meta name="apple-mobile-web-app-title" content="ShowCube">',
  '<meta name="mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-capable" content="yes">',
  '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
].join('\n');
const panelFile = resolve(rel, 'panel.html');
await writeFile(panelFile, (await readFile(panelFile, 'utf8')).replace('</title>', '</title>\n' + head));
const hash = createHash('sha256');
for (const f of ['panel.html', 'player.html', 'panel.webmanifest', ...(await readdir(resolve(rel, 'pwa'))).map(f => 'pwa/' + f)]) hash.update(await readFile(resolve(rel, f)));
const sw = (await readFile(resolve(root, 'pwa/sw.js'), 'utf8')).replace('__VERSION__', hash.digest('hex').slice(0, 12));
await writeFile(resolve(rel, 'sw.js'), sw);
console.log('Fertig: ' + apps.map(a => 'release/' + a + '.html').join(', ') + ', dazu release/sw.js und das App-Manifest');
