// Startet kontakt.php mit dem eingebauten PHP-Server, damit tests/kontakt.spec.ts das echte Skript prüfen kann.
// Mails gehen nicht raus: sendmail_path schreibt sie in eine Datei. Mit { mailApi: true } bekommt kontakt.php einen
// Schlüssel für eine nachgestellte Hostinger-Mail-API, die jede Anfrage mitschreibt. Als .mjs, weil die Typprüfung
// keine Node-Typen kennt.
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { createServer as httpServer } from 'node:http';

const root = resolve(import.meta.dirname, '..');

const freierPort = () => new Promise(ok => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

/** Nachgestellte Hostinger-Mail-API: schreibt jede Anfrage mit und antwortet mit `status` (Standard 204). */
async function mailApiAttrappe() {
  const anfragen = [];
  const api = { status: 204, anfragen };
  const server = httpServer((req, res) => {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => {
      anfragen.push({ methode: req.method, pfad: req.url, auth: req.headers.authorization, daten: body ? JSON.parse(body) : null });
      res.writeHead(api.status, { 'Content-Type': 'application/json' });
      res.end(api.status >= 300 ? JSON.stringify({ error: 'Kaputt', code: 'ERR_TEST', params: {} }) : '');
    });
  });
  const port = await freierPort();
  await new Promise(ok => server.listen(port, '127.0.0.1', ok));
  return { ...api, adresse: `http://127.0.0.1:${port}`, get status() { return api.status; }, set status(s) { api.status = s; },
    stoppen: () => server.close() };
}

export async function phpServer({ mailApi = false } = {}) {
  const ordner = mkdtempSync(join(tmpdir(), 'showcube-kontakt-'));
  const postausgang = join(ordner, 'mails.txt');
  // Ersatz für sendmail: hängt die Mail an eine Datei an und ignoriert Optionen wie -f.
  const sendmail = join(ordner, 'sendmail.sh');
  writeFileSync(sendmail, `#!/bin/sh\ncat >> '${postausgang}'\n`);
  chmodSync(sendmail, 0o755);
  const env = { ...process.env };
  // Die Attrappe läuft lokal: keinen Proxy aus der Umgebung nehmen (curl in PHP würde ihn sonst benutzen).
  for (const k of Object.keys(env)) if (/_proxy$/i.test(k)) delete env[k];
  let api = null;
  if (mailApi) {
    api = await mailApiAttrappe();
    // Wie showcube-geheim.php auf dem Server, nur mit Testschlüssel und der Adresse der Attrappe.
    const geheim = join(ordner, 'showcube-geheim.php');
    writeFileSync(geheim, `<?php\nreturn ['mail_api_token' => 'test-schluessel', 'postfach' => 'ACtest123', 'mail_api_url' => '${api.adresse}'];\n`);
    env.SHOWCUBE_GEHEIM = geheim;
  } else {
    env.SHOWCUBE_GEHEIM = join(ordner, 'gibt-es-nicht.php');
  }
  const port = await freierPort();
  const php = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', root,
    '-d', `sendmail_path=${sendmail}`, '-d', `sys_temp_dir=${ordner}`, '-d', 'display_errors=stderr', '-d', 'log_errors=0'],
    { stdio: 'ignore', env });
  const adresse = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 50; i++) {
    try { await fetch(adresse + 'kontakt.html'); break; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  return {
    adresse,
    api,
    mails: () => existsSync(postausgang) ? readFileSync(postausgang, 'utf8') : '',
    stoppen: () => { php.kill(); api?.stoppen(); },
  };
}
