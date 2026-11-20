// Startet kontakt.php mit dem eingebauten PHP-Server, damit tests/kontakt.spec.ts das echte Skript prüfen kann.
// Mails gehen nicht raus: sendmail_path schreibt sie in eine Datei. Als .mjs, weil die Typprüfung keine Node-Typen kennt.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';

const root = resolve(import.meta.dirname, '..');

const freierPort = () => new Promise(ok => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

export async function phpServer() {
  const ordner = mkdtempSync(join(tmpdir(), 'showcube-kontakt-'));
  const postausgang = join(ordner, 'mails.txt');
  // Ersatz für sendmail: hängt die Mail an eine Datei an und ignoriert Optionen wie -f.
  const sendmail = join(ordner, 'sendmail.sh');
  writeFileSync(sendmail, `#!/bin/sh\ncat >> '${postausgang}'\n`);
  chmodSync(sendmail, 0o755);
  const port = await freierPort();
  const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root,
    '-d', `sendmail_path=${sendmail}`, '-d', `sys_temp_dir=${ordner}`, '-d', 'display_errors=stderr'], { stdio: 'ignore' });
  const adresse = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(adresse + 'kontakt.html'); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  return {
    adresse,
    mails: () => existsSync(postausgang) ? readFileSync(postausgang, 'utf8') : '',
    stoppen: () => php.kill(),
  };
}
