// Node-Hilfen für tests/website.spec.ts (Dateisystem). Als .mjs, weil die Typprüfung keine Node-Typen kennt.
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { website, prodSeite } from '../scripts/website.mjs';
export { prodSeite };

const root = resolve(import.meta.dirname, '..');

/** Stellt die Website für stage oder prod in ordner zusammen und gibt Dateiliste, Leser und Adresse beim Testserver zurück. */
export async function zusammenstellen(umgebung, ordner, stand, seite) {
  process.env.GITHUB_SHA = stand;
  await website(umgebung, ordner, { seite });
  const dateien = [];
  for (const e of await readdir(ordner, { withFileTypes: true, recursive: true })) {
    if (e.isFile()) dateien.push(relative(ordner, join(e.parentPath, e.name)));
  }
  return {
    dateien,
    lesen: name => readFile(join(ordner, name), 'utf8'),
    gibtEs: name => existsSync(join(ordner, name)),
    adresse: '/' + relative(root, ordner) + '/',
    original: name => readFile(join(root, name), 'utf8'),
  };
}
