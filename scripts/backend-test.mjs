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

console.log(process.exitCode ? '\nFehler gefunden.' : `\nAlle ${n} Prüfungen bestanden.`);
