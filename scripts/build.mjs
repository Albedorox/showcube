// Baut Player und Konfigurator zu je einer einzelnen HTML-Datei in release/.
// Die Box braucht genau eine Datei ohne Abhängigkeiten, deshalb wird alles eingebettet.
import { build } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const apps = ['player', 'konfigurator'];

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
console.log('Fertig: release/player.html, release/konfigurator.html');
