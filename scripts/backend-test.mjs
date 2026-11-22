// Prüft den Backend-Kern gegen einen laufenden Supabase-Server (lokal: `npx supabase start`).
// Aufruf: node scripts/backend-test.mjs   (liest URL und Schlüssel aus `npx supabase status`)
// Spielt durch: zwei Betriebe, eine Box koppeln, veröffentlichen, abholen, Befehle, Foto, und dass niemand fremde Daten sieht.
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import assert from 'node:assert/strict';

const env = Object.fromEntries(execSync('npx supabase status -o env', { encoding: 'utf8' }).split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const URL = process.env.SUPABASE_URL || env.API_URL, KEY = process.env.SUPABASE_KEY || env.PUBLISHABLE_KEY || env.ANON_KEY;
const neu = () => createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ok = (r, what) => { if (r.error) throw new Error(what + ': ' + r.error.message); return r.data; };
let n = 0; const check = (name, fn) => { n++; return fn().then(() => console.log('✓', name), e => { console.error('✗', name, '\n ', e.message); process.exitCode = 1; }); };
const stamp = Date.now().toString(36);

const a = neu(), b = neu(), box = neu(), box2 = neu();
let betriebA, boxInfo, code;

await check('Konto anlegen legt einen Betrieb an', async () => {
  ok(await a.auth.signUp({ email: `a-${stamp}@example.com`, password: 'geheim-123', options: { data: { betrieb: 'Pizzeria Da Marco' } } }), 'signup a');
  ok(await b.auth.signUp({ email: `b-${stamp}@example.com`, password: 'geheim-123' }), 'signup b');
  betriebA = ok(await a.rpc('mein_betrieb'), 'mein_betrieb');
  assert.ok(betriebA);
  const rows = ok(await a.from('betriebe').select('*'), 'betriebe');
  assert.equal(rows.length, 1); assert.equal(rows[0].name, 'Pizzeria Da Marco');
});

await check('Box meldet sich anonym an und bekommt einen Code', async () => {
  ok(await box.auth.signInAnonymously(), 'anon');
  boxInfo = ok(await box.rpc('box_anmelden'), 'box_anmelden');
  assert.match(boxInfo.code, /^\d{6}$/); assert.equal(boxInfo.gekoppelt, false); code = boxInfo.code;
  const again = ok(await box.rpc('box_anmelden'), 'box_anmelden 2');
  assert.equal(again.code, code, 'Code bleibt gleich');
  const st = ok(await box.rpc('box_stand', { p_zustand: { period: 'day' } }), 'box_stand ungekoppelt');
  assert.equal(st.gekoppelt, false); assert.equal(st.code, code);
});

await check('Box kann sich nicht selbst einen Betrieb geben oder fremde Tabellen lesen', async () => {
  assert.equal(ok(await box.from('bildschirme').select('*'), 'select').length, 0);
  assert.equal(ok(await box.from('betriebe').select('*'), 'select').length, 0);
  assert.equal(ok(await box.rpc('mein_betrieb'), 'mein_betrieb'), null);
  const r = await box.rpc('bildschirm_koppeln', { p_code: code, p_name: 'x', p_standort: '', p_ausrichtung: 'land', p_show_id: null });
  assert.ok(r.error, 'Box darf nicht koppeln');
});

await check('Falscher Code wird abgelehnt, richtiger koppelt', async () => {
  const wrong = String((+code + 1) % 1e6).padStart(6, '0');
  const r = await a.rpc('bildschirm_koppeln', { p_code: wrong, p_name: 'Theke', p_standort: 'Da Marco', p_ausrichtung: 'land', p_show_id: 'pizza' });
  assert.ok(r.error); assert.match(r.error.message, /Code/);
  const s = ok(await a.rpc('bildschirm_koppeln', { p_code: code.slice(0, 3) + ' ' + code.slice(3), p_name: 'Theke', p_standort: 'Da Marco', p_ausrichtung: 'land', p_show_id: 'pizza' }), 'koppeln');
  assert.equal(s.name, 'Theke'); assert.equal(s.id, boxInfo.id); assert.equal(s.code, null);
  const r2 = await b.rpc('bildschirm_koppeln', { p_code: code, p_name: 'Klau', p_standort: '', p_ausrichtung: 'land', p_show_id: null });
  assert.ok(r2.error, 'Code ist danach verbraucht');
});

await check('Panel speichert Slideshow, lädt Datei hoch und veröffentlicht', async () => {
  ok(await a.from('shows').upsert({ betrieb_id: betriebA, id: 'pizza', daten: { name: 'Karte' }, revision: 1 }), 'show');
  const pfad = betriebA + '/m1';
  ok(await a.storage.from('medien').upload(pfad, new Blob(['bild'], { type: 'image/png' }), { upsert: true, contentType: 'image/png' }), 'upload');
  ok(await a.from('dateien').upsert({ betrieb_id: betriebA, id: 'm1', typ: 'image', name: 'pizza.png', groesse: 4 }), 'datei');
  const paket = { format: 'showcube-paket', version: 1, show: { id: 'pizza', name: 'Karte', revision: 1, published: new Date().toISOString() }, config: { name: 'Da Marco', media: [{ id: 'm1', type: 'image', name: 'pizza.png', when: 'always' }] }, files: { m1: 'speicher:' + pfad } };
  ok(await a.from('pakete').insert({ betrieb_id: betriebA, show_id: 'pizza', revision: 1, paket }), 'paket');
});

await check('Box holt Paket und Datei, danach nur noch Herzschlag', async () => {
  const st = ok(await box.rpc('box_stand', { p_zustand: { period: 'day', slide: 1 }, p_stand: '' }), 'stand');
  assert.equal(st.gekoppelt, true); assert.equal(st.stand, 'pizza:1'); assert.equal(st.paket.show.revision, 1); assert.equal(st.name, 'Theke');
  const blob = ok(await box.storage.from('medien').download(st.paket.files.m1.slice(9)), 'download');
  assert.equal(await blob.text(), 'bild');
  const st2 = ok(await box.rpc('box_stand', { p_zustand: { period: 'day', slide: 2 }, p_stand: 'pizza:1' }), 'stand 2');
  assert.equal(st2.paket, null, 'kein Paket, wenn schon aktuell');
  const [row] = ok(await a.from('bildschirme_panel').select('*'), 'panel sieht Box');
  assert.equal(row.stand, 1); assert.ok(row.her < 5); assert.equal(row.zustand.slide, 2);
  assert.ok(row.protokoll.some(e => /übernommen/.test(e.msg)), 'Protokoll: Stand übernommen');
});

await check('Befehle und Foto', async () => {
  ok(await a.from('befehle').insert({ betrieb_id: betriebA, bildschirm_id: boxInfo.id, befehl: 'shot' }), 'befehl');
  const st = ok(await box.rpc('box_stand', { p_stand: 'pizza:1' }), 'stand');
  assert.equal(st.befehle.length, 1); assert.equal(st.befehle[0].befehl, 'shot');
  ok(await box.rpc('box_foto', { p_befehl: st.befehle[0].id, p_bild: 'data:image/jpeg;base64,AAAA' }), 'foto');
  const st2 = ok(await box.rpc('box_stand', { p_stand: 'pizza:1' }), 'stand');
  assert.equal(st2.befehle.length, 0);
  const [row] = ok(await a.from('bildschirme').select('foto, foto_zeit'), 'foto lesen');
  assert.equal(row.foto, 'data:image/jpeg;base64,AAAA');
});

await check('Sofort-Hinweis und Strom aus kommen bei der Box an', async () => {
  ok(await a.from('betriebe').update({ hinweis: { text: 'Heute geschlossen', until: 0, screens: [boxInfo.id] } }).eq('id', betriebA), 'hinweis');
  ok(await a.from('bildschirme').update({ strom: false }).eq('id', boxInfo.id), 'strom');
  const st = ok(await box.rpc('box_stand', { p_stand: 'pizza:1' }), 'stand');
  assert.equal(st.hinweis.text, 'Heute geschlossen'); assert.equal(st.strom, false);
});

await check('Panel darf Herzschlag-Felder nicht fälschen', async () => {
  const r = await a.from('bildschirme').update({ zuletzt: new Date(0).toISOString() }).eq('id', boxInfo.id);
  assert.ok(r.error, 'zuletzt ist gesperrt');
});

await check('Anderer Betrieb sieht nichts', async () => {
  assert.equal(ok(await b.from('bildschirme').select('*'), 'b').length, 0);
  assert.equal(ok(await b.from('shows').select('*'), 'b').length, 0);
  assert.equal(ok(await b.from('pakete').select('*'), 'b').length, 0);
  const d = await b.storage.from('medien').download(betriebA + '/m1');
  assert.ok(d.error, 'fremde Datei nicht lesbar');
  const up = await b.storage.from('medien').upload(betriebA + '/x', new Blob(['x']));
  assert.ok(up.error, 'in fremden Ordner nicht schreibbar');
  const r = await b.from('befehle').insert({ betrieb_id: betriebA, bildschirm_id: boxInfo.id, befehl: 'restart' });
  assert.ok(r.error, 'keine Befehle an fremde Boxen');
});

await check('Ungekoppelte fremde Box darf keine Dateien lesen', async () => {
  ok(await box2.auth.signInAnonymously(), 'anon 2'); ok(await box2.rpc('box_anmelden'), 'anmelden 2');
  const d = await box2.storage.from('medien').download(betriebA + '/m1');
  assert.ok(d.error);
});

await check('Bildschirm entfernen: Box bekommt einen neuen Code', async () => {
  ok(await a.from('bildschirme').delete().eq('id', boxInfo.id), 'delete');
  const st = ok(await box.rpc('box_stand', {}), 'stand');
  assert.equal(st.bekannt, false);
  const neuInfo = ok(await box.rpc('box_anmelden'), 'neu anmelden');
  assert.match(neuInfo.code, /^\d{6}$/);
});

await check('Admin sieht alle Betriebe und kann für einen Kunden koppeln', async () => {
  const admin = neu();
  ok(await admin.auth.signUp({ email: `admin-${stamp}@example.com`, password: 'geheim-123' }), 'signup admin');
  assert.equal(ok(await admin.rpc('ist_admin'), 'ist_admin'), false);
  assert.equal(ok(await admin.rpc('admin_betriebe'), 'liste ohne admin').length, 0, 'ohne Admin-Recht leer');
  const uid = (await admin.auth.getUser()).data.user.id;
  execSync(`docker exec supabase_db_showcube psql -U postgres -qc "insert into public.admins (user_id) values ('${uid}')"`);
  assert.equal(ok(await admin.rpc('ist_admin'), 'ist_admin'), true);
  const liste = ok(await admin.rpc('admin_betriebe'), 'liste');
  const da = liste.find(x => x.id === betriebA);
  assert.ok(da, 'Betrieb A in der Liste'); assert.equal(da.email, `a-${stamp}@example.com`);
  assert.ok(ok(await admin.from('shows').select('*').eq('betrieb_id', betriebA), 'shows A').length >= 1);
  const d = await admin.storage.from('medien').download(betriebA + '/m1');
  assert.ok(!d.error, 'Admin liest Dateien des Kunden');
  const boxC = neu(); ok(await boxC.auth.signInAnonymously(), 'anon C');
  const info = ok(await boxC.rpc('box_anmelden'), 'anmelden C');
  const s = ok(await admin.rpc('bildschirm_koppeln', { p_code: info.code, p_name: 'Fenster', p_standort: '', p_ausrichtung: 'land', p_show_id: 'pizza', p_betrieb: betriebA }), 'koppeln für A');
  assert.equal(s.betrieb_id, betriebA);
  assert.ok(ok(await a.from('bildschirme').select('id'), 'A sieht').some(x => x.id === info.id), 'Kunde sieht die Box');
  assert.equal(ok(await b.rpc('admin_betriebe'), 'b').length, 0, 'normale Konten sehen keine Liste');
  const r = await b.rpc('bildschirm_koppeln', { p_code: '123456', p_name: 'x', p_standort: '', p_ausrichtung: 'land', p_show_id: null, p_betrieb: betriebA });
  assert.ok(r.error && /Kein Betrieb/.test(r.error.message), 'fremder Betrieb gesperrt');
});

const zufallsKennung = () => { const z = () => Array.from({ length: 4 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]).join(''); return 'SC-' + z() + '-' + z(); };
await check('Box mit Kennung übersteht ein Zurücksetzen des Browsers', async () => {
  const kennung = zufallsKennung();
  const schluessel = 'k'.repeat(20) + stamp.padEnd(23, 'x');
  const box1 = neu(); ok(await box1.auth.signInAnonymously(), 'anon 1');
  const i1 = ok(await box1.rpc('box_anmelden', { p_kennung: kennung, p_schluessel: schluessel }), 'anmelden mit Kennung');
  assert.equal(i1.kennung, kennung); assert.match(i1.code, /^\d{6}$/);
  ok(await a.rpc('bildschirm_koppeln', { p_code: i1.code, p_name: 'Schaufenster', p_standort: '', p_ausrichtung: 'land', p_show_id: 'pizza' }), 'koppeln');
  const zeile = ok(await a.from('bildschirme_panel').select('id,kennung').eq('id', i1.id), 'panel sieht Kennung');
  assert.equal(zeile[0].kennung, kennung);
  // Browser gelöscht: neues anonymes Konto, gleiche Kennung und gleicher Schlüssel.
  const box2b = neu(); ok(await box2b.auth.signInAnonymously(), 'anon 2');
  assert.equal(ok(await box2b.rpc('box_stand', {}), 'stand vorher').bekannt, false);
  const i2 = ok(await box2b.rpc('box_anmelden', { p_kennung: kennung, p_schluessel: schluessel }), 'wieder anmelden');
  assert.equal(i2.id, i1.id, 'derselbe Bildschirm'); assert.equal(i2.gekoppelt, true); assert.equal(i2.code, null);
  const st = ok(await box2b.rpc('box_stand', {}), 'stand nachher');
  assert.equal(st.gekoppelt, true); assert.equal(st.name, 'Schaufenster');
  assert.equal(ok(await box1.rpc('box_stand', {}), 'altes Konto').bekannt, false, 'altes Konto ist abgehängt');
  // Wer nur die Kennung vom Gehäuse kennt, kommt nicht dran.
  const dieb = neu(); ok(await dieb.auth.signInAnonymously(), 'anon dieb');
  const r = await dieb.rpc('box_anmelden', { p_kennung: kennung, p_schluessel: 'falsch'.repeat(8) });
  assert.ok(r.error && r.error.code === '42501', 'falscher Schlüssel abgelehnt');
  assert.equal(ok(await dieb.rpc('box_stand', {}), 'dieb stand').bekannt, false);
  assert.ok((await dieb.rpc('box_anmelden', { p_kennung: kennung, p_schluessel: 'kurz' })).error, 'kurzer Schlüssel abgelehnt');
  assert.ok((await dieb.rpc('box_anmelden', { p_kennung: 'SC-0000-0000', p_schluessel: schluessel })).error, 'falsches Format abgelehnt');
  assert.equal((await dieb.from('boxen').select('*')).data?.length ?? 0, 0, 'Schlüssel-Tabelle nicht lesbar');
  assert.equal((await a.from('boxen').select('*')).data?.length ?? 0, 0, 'auch nicht fürs Panel');
  // Admin gibt die Box frei (neu bespielte Karte, neuer Schlüssel): Kopplung bleibt.
  assert.ok((await a.rpc('admin_box_freigeben', { p_kennung: kennung })).error, 'nur Admins');
  const admin = neu(); ok(await admin.auth.signInWithPassword({ email: `admin-${stamp}@example.com`, password: 'geheim-123' }), 'admin login');
  ok(await admin.rpc('admin_box_freigeben', { p_kennung: kennung }), 'freigeben');
  const box3 = neu(); ok(await box3.auth.signInAnonymously(), 'anon 3');
  const i3 = ok(await box3.rpc('box_anmelden', { p_kennung: kennung, p_schluessel: 'n'.repeat(43) }), 'neuer Schlüssel');
  assert.equal(i3.id, i1.id); assert.equal(i3.gekoppelt, true);
  assert.ok((await box2b.rpc('box_anmelden', { p_kennung: kennung, p_schluessel: schluessel })).error, 'alter Schlüssel gilt nicht mehr');
});

await check('Bestehende Testbox ohne Kennung bekommt sie und bleibt gekoppelt', async () => {
  const k2 = zufallsKennung();
  const alt = neu(); ok(await alt.auth.signInAnonymously(), 'anon alt');
  const i = ok(await alt.rpc('box_anmelden'), 'ohne Kennung');
  ok(await a.rpc('bildschirm_koppeln', { p_code: i.code, p_name: 'Alt', p_standort: '', p_ausrichtung: 'land', p_show_id: 'pizza' }), 'koppeln');
  const j = ok(await alt.rpc('box_anmelden', { p_kennung: k2, p_schluessel: 'a'.repeat(40) + stamp }), 'mit Kennung');
  assert.equal(j.id, i.id); assert.equal(j.gekoppelt, true); assert.equal(j.kennung, k2);
});

await check('KI (Vorlage aus Bild): nur Pro, mit Kontingent, Stufe nicht selbst setzbar', async () => {
  const sql = q => execSync(`docker exec supabase_db_showcube psql -U postgres -qc "${q}"`);
  const k0 = ok(await a.rpc('ki_kontingent'), 'kontingent ohne Abo');
  assert.equal(k0.pro, false); assert.equal(k0.genutzt, 0);
  let r = await a.rpc('ki_analyse_buchen'); assert.ok(r.error && /KI_NUR_PRO/.test(r.error.message), 'ohne Pro gesperrt');
  r = await a.from('abos').insert({ betrieb_id: betriebA, stufe: 'pro' }); assert.ok(r.error, 'Stufe nicht selbst setzbar');
  r = await box.rpc('ki_analyse_buchen'); assert.ok(r.error, 'Box darf nicht');
  sql(`insert into public.abos (betrieb_id, stufe, ki_grenze) values ('${betriebA}', 'pro', 2)`);
  const g1 = ok(await a.rpc('ki_analyse_buchen'), 'buchen 1'); assert.equal(g1.rest, 1);
  ok(await a.rpc('ki_analyse_buchen'), 'buchen 2');
  r = await a.rpc('ki_analyse_buchen'); assert.ok(r.error && /KI_KONTINGENT/.test(r.error.message), 'Kontingent erschöpft');
  const k1 = ok(await a.rpc('ki_kontingent'), 'kontingent mit Abo');
  assert.equal(k1.pro, true); assert.equal(k1.grenze, 2); assert.equal(k1.genutzt, 2);
  assert.equal(ok(await a.from('ki_analysen').select('id'), 'eigene').length, 2);
  assert.equal(ok(await b.from('ki_analysen').select('id'), 'fremde').length, 0, 'fremde Analysen unsichtbar');
  r = await a.from('ki_analysen').delete().eq('id', g1.id).select(); assert.equal((r.data || []).length, 0, 'Kunde kann Analysen nicht löschen');
  // Abgelaufenes Pro zählt nicht mehr.
  sql(`update public.abos set bis = now() - interval '1 day' where betrieb_id = '${betriebA}'`);
  assert.equal(ok(await a.rpc('ki_kontingent'), 'abgelaufen').pro, false);
});

const psql = q => execSync(`docker exec supabase_db_showcube psql -U postgres -At -c "${q}"`, { encoding: 'utf8' }).trim();

await check('Koppel-Code gilt höchstens eine Stunde', async () => {
  const c = neu(); ok(await c.auth.signInAnonymously(), 'anon');
  const i = ok(await c.rpc('box_anmelden'), 'box_anmelden');
  const min = +psql(`select round(extract(epoch from code_bis - now()) / 60) from public.bildschirme where id = '${i.id}'`);
  assert.ok(min > 55 && min <= 60, 'gültig für ' + min + ' Minuten');
  // Abgelaufen: box_stand liefert keinen Code mehr, die nächste Anmeldung würfelt einen neuen.
  psql(`update public.bildschirme set code_bis = now() - interval '1 minute' where id = '${i.id}'`);
  const st = ok(await c.rpc('box_stand', {}), 'box_stand'); assert.equal(st.code, null);
  const j = ok(await c.rpc('box_anmelden'), 'neu anmelden'); assert.match(j.code, /^\d{6}$/);
});

await check('Koppeln: Sperre über alle Konten gegen Durchprobieren', async () => {
  const c = neu(); ok(await c.auth.signUp({ email: `c-${stamp}@example.com`, password: 'geheim-123' }), 'signup c');
  psql(`insert into public.koppel_versuche (user_id) select gen_random_uuid() from generate_series(1, 100)`);
  const r = await c.rpc('bildschirm_koppeln', { p_code: '000000', p_name: 'x', p_standort: '', p_ausrichtung: 'land', p_show_id: null });
  assert.ok(r.error && /zu viele falsche Codes/i.test(r.error.message), 'gesperrt: ' + (r.error && r.error.message));
  psql(`delete from public.koppel_versuche`);
  const r2 = await c.rpc('bildschirm_koppeln', { p_code: '000000', p_name: 'x', p_standort: '', p_ausrichtung: 'land', p_show_id: null });
  assert.match(r2.error.message, /kennen wir nicht/);
});

// Einmal-Code wie eine Authenticator-App (RFC 6238, 30 s, 6 Ziffern).
const { createHmac } = await import('node:crypto');
function totp(secret, t = Date.now()) {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const ch of secret.replace(/=+$/, '').toUpperCase()) bits += abc.indexOf(ch).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g).map(b => parseInt(b, 2)));
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = createHmac('sha1', key).update(msg).digest(), o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

await check('Zwei-Faktor: mit Passwort allein keine Daten, mit Code aus der App wieder alles', async () => {
  const mail = `mfa-${stamp}@example.com`;
  const d = neu(); ok(await d.auth.signUp({ email: mail, password: 'geheim-123', options: { data: { betrieb: 'Zwei Faktor' } } }), 'signup');
  const f = ok(await d.auth.mfa.enroll({ factorType: 'totp' }), 'enroll');
  ok(await d.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(f.totp.secret) }), 'verify');
  assert.equal(ok(await d.from('betriebe').select('name'), 'nach verify').length, 1);
  // Neue Anmeldung nur mit Passwort: Stufe aal1, die Zugriffsregeln lassen nichts durch.
  const e = neu(); ok(await e.auth.signInWithPassword({ email: mail, password: 'geheim-123' }), 'login');
  const aal = ok(await e.auth.mfa.getAuthenticatorAssuranceLevel(), 'aal');
  assert.equal(aal.currentLevel, 'aal1'); assert.equal(aal.nextLevel, 'aal2');
  assert.equal(ok(await e.from('betriebe').select('name'), 'nur Passwort').length, 0, 'ohne Code nichts lesbar');
  const r = await e.rpc('bildschirm_koppeln', { p_code: '000000', p_name: 'x', p_standort: '', p_ausrichtung: 'land', p_show_id: null });
  assert.ok(r.error && /Kein Betrieb/.test(r.error.message), 'ohne Code kein Koppeln');
  ok(await e.auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(f.totp.secret) }), 'verify 2');
  assert.equal(ok(await e.from('betriebe').select('name'), 'mit Code')[0].name, 'Zwei Faktor');
  // Konto ohne zweiten Faktor merkt nichts davon.
  assert.equal(ok(await a.from('betriebe').select('name'), 'a').length, 1);
});

await check('Benutzerverwaltung: nur Admins sehen und ändern Konten', async () => {
  const admin = neu(); ok(await admin.auth.signInWithPassword({ email: `admin-${stamp}@example.com`, password: 'geheim-123' }), 'admin login');
  const adminId = (await admin.auth.getUser()).data.user.id;
  // Normale Konten und Boxen: alles abgelehnt, auch mit gültiger Sitzung.
  for (const [wer, c] of [['Kunde', b], ['Box', box]]) {
    for (const [fn, args] of [['admin_benutzer', {}], ['admin_abo_setzen', { p_betrieb: betriebA, p_stufe: 'pro' }], ['admin_sperren', { p_user: adminId, p_sperren: true }],
      ['admin_bestaetigen', { p_user: adminId }], ['admin_loeschen', { p_user: adminId }], ['admin_protokoll_lesen', {}]]) {
      const r = await c.rpc(fn, args); assert.ok(r.error && /Nur für Admins/.test(r.error.message), wer + ' darf ' + fn + ' nicht');
    }
  }
  assert.ok((await b.from('admin_protokoll').select('*')).error, 'Protokoll nicht direkt lesbar');
  // Liste: echte Konten mit Betrieb, Abo und Boxen, keine Boxen-Konten.
  const liste = ok(await admin.rpc('admin_benutzer'), 'liste');
  const ua = liste.find(x => x.email === `a-${stamp}@example.com`);
  assert.ok(ua, 'Kunde A in der Liste'); assert.equal(ua.betrieb_id, betriebA); assert.equal(ua.betrieb, 'Pizzeria Da Marco');
  assert.ok(ua.bildschirme >= 1, 'Boxen gezählt'); assert.ok(ua.zuletzt, 'letzte Anmeldung');
  assert.ok(liste.find(x => x.id === adminId).admin, 'Admin markiert');
  assert.ok(!liste.some(x => !x.email), 'keine anonymen Box-Konten');
  // Abo: Pro mit Datum und Kontingent, danach zurück auf Cloud. Ungültige Werte abgelehnt.
  const bis = new Date(Date.now() + 30 * 864e5).toISOString();
  const abo = ok(await admin.rpc('admin_abo_setzen', { p_betrieb: betriebA, p_stufe: 'pro', p_bis: bis, p_ki_grenze: 80 }), 'pro');
  assert.equal(abo.stufe, 'pro'); assert.equal(abo.ki_grenze, 80);
  const k = ok(await a.rpc('ki_kontingent'), 'kontingent'); assert.equal(k.pro, true); assert.equal(k.grenze, 80);
  assert.ok((await admin.rpc('admin_abo_setzen', { p_betrieb: betriebA, p_stufe: 'gold' })).error, 'unbekannte Stufe');
  assert.ok((await admin.rpc('admin_abo_setzen', { p_betrieb: betriebA, p_stufe: 'pro', p_ki_grenze: -1 })).error, 'negatives Kontingent');
  ok(await admin.rpc('admin_abo_setzen', { p_betrieb: betriebA, p_stufe: 'cloud' }), 'cloud');
  assert.equal(ok(await a.rpc('ki_kontingent'), 'kontingent 2').pro, false);
  assert.equal(ok(await a.from('abos').select('ki_grenze'), 'abo')[0].ki_grenze, 80, 'Kontingent bleibt ohne Angabe');
  // Admin-Konten sind geschützt, auch das eigene.
  let r = await admin.rpc('admin_sperren', { p_user: adminId, p_sperren: true }); assert.ok(r.error && /Admin-Konten/.test(r.error.message), 'Admin nicht sperrbar');
  r = await admin.rpc('admin_loeschen', { p_user: adminId }); assert.ok(r.error, 'Admin nicht löschbar');
  // Sperren: laufende Sitzung sieht sofort nichts mehr, Anmelden geht nicht. Freigeben: wieder alles da.
  const mail = `sperre-${stamp}@example.com`;
  const s = neu(); ok(await s.auth.signUp({ email: mail, password: 'geheim-123', options: { data: { betrieb: 'Gesperrt GmbH' } } }), 'signup');
  const sid = (await s.auth.getUser()).data.user.id;
  assert.equal(ok(await s.from('betriebe').select('name'), 'vorher').length, 1);
  ok(await admin.rpc('admin_sperren', { p_user: sid, p_sperren: true }), 'sperren');
  assert.equal(ok(await s.from('betriebe').select('name'), 'gesperrt, alte Sitzung').length, 0, 'alte Sitzung ohne Daten');
  assert.ok((await neu().auth.signInWithPassword({ email: mail, password: 'geheim-123' })).error, 'gesperrt: Anmeldung abgelehnt');
  assert.ok(ok(await admin.rpc('admin_benutzer'), 'liste').find(x => x.id === sid).gesperrt);
  ok(await admin.rpc('admin_sperren', { p_user: sid, p_sperren: false }), 'freigeben');
  const s2 = neu(); ok(await s2.auth.signInWithPassword({ email: mail, password: 'geheim-123' }), 'wieder anmelden');
  assert.equal(ok(await s2.from('betriebe').select('name'), 'nachher')[0].name, 'Gesperrt GmbH');
  ok(await admin.rpc('admin_bestaetigen', { p_user: sid }), 'bestätigen');
  // Löschen: Konto und Betrieb weg, Protokoll hält fest, wer es war.
  const sb2 = ok(await s2.rpc('mein_betrieb'), 'betrieb');
  const weg = ok(await admin.rpc('admin_loeschen', { p_user: sid }), 'löschen');
  assert.deepEqual(weg, [sb2]);
  assert.equal(+psql(`select count(*) from public.betriebe where id = '${sb2}'`), 0, 'Betrieb gelöscht');
  assert.equal(+psql(`select count(*) from auth.users where id = '${sid}'`), 0, 'Konto gelöscht');
  const prot = ok(await admin.rpc('admin_protokoll_lesen', { p_user: sid }), 'protokoll');
  assert.deepEqual(prot.map(p => p.aktion), ['gelöscht', 'bestätigt', 'freigegeben', 'gesperrt']);
  assert.equal(prot[0].ziel_email, mail); assert.equal(prot[0].admin_email, `admin-${stamp}@example.com`);
});

console.log(process.exitCode ? '\nFehler gefunden.' : `\nAlle ${n} Prüfungen bestanden.`);
