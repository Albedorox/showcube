import '../shared/fonts.css';
import { fontsReady, TEMPLATES, SWATCHES, drawNotice } from '../shared/templates';
import { CHANNEL, paketFromFile, type Msg, type Paket } from '../shared/paket';
import { hatServer, verbinden, SPEICHER, BUCKET, type SupabaseClient } from '../shared/cloud';
import { activeOn, bausteinActive, bausteinSlide, bausteinTitle, BAUSTEINE, drawLeiste, leisteH, fetchWetter, type Wetter } from '../shared/bausteine';

// ?live=<id>: dieser Player ist ein Bildschirm im Cloud-Panel (Prototyp: anderer Tab im selben Browser).
// Er bekommt eigene Speicherplätze, damit der normale Test-Player nicht überschrieben wird.
const LIVE = new URLSearchParams(location.search).get('live');
const SUFFIX = LIVE ? '-live-' + LIVE : '';

// ---------- Speicher: Einstellungen in localStorage, Dateien in IndexedDB ----------
const KEY = 'svizzbox-player-v0' + SUFFIX;
const DEF = { revision: 0, tpl: 'makler', tplOn: true, name: '', items: '', accent: '', dayStart: '06:00', eveStart: '17:00', offOn: true, offFrom: '22:00', offTo: '07:00', offDays: [], notice: null, dur: 8, fit: 'cover', media: [], extras: [], leiste: null };
let C = Object.assign({}, DEF);
let storeOK = true;
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) C = Object.assign({}, DEF, s); } catch (e) { storeOK = false; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) { storeOK = false; } }
let db = null; const blobs = new Map(), urls = new Map();
function openDB() {
  return new Promise<void>(res => {
    try {
      const r = indexedDB.open('svizzbox-player' + SUFFIX, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('files');
      r.onsuccess = () => { db = r.result; res(); };
      r.onerror = () => { storeOK = false; res(); };
    } catch (e) { storeOK = false; res(); }
  });
}
function dbPut(id, blob) { blobs.set(id, blob); if (!db) return; try { db.transaction('files', 'readwrite').objectStore('files').put(blob, id); } catch (e) { storeOK = false; } }
function dbDel(id) { blobs.delete(id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } if (!db) return; try { db.transaction('files', 'readwrite').objectStore('files').delete(id); } catch (e) {} }
function dbLoadAll() {
  return new Promise<void>(res => {
    if (!db) return res();
    try {
      const st = db.transaction('files').objectStore('files'), rq = st.openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { blobs.set(c.key, c.value); c.continue(); } else res(); };
      rq.onerror = () => res();
    } catch (e) { res(); }
  });
}
const urlOf = id => { if (!urls.has(id) && blobs.has(id)) urls.set(id, URL.createObjectURL(blobs.get(id))); return urls.get(id); };
let logoImg = null;
function loadLogo() { logoImg = null; if (!blobs.has('logo')) return; const i = new Image(); i.onload = () => { logoImg = i; }; i.src = urlOf('logo'); }

// ---------- Zeitplan ----------
let sim = 'live', forcedOff = false;
const mins = s => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
const inRange = (n, a, b) => a <= b ? n >= a && n < b : n >= a || n < b;
function period(now) {
  if (forcedOff) return 'off';
  if (sim !== 'live') return sim;
  const n = now.getHours() * 60 + now.getMinutes();
  if (C.offOn && inRange(n, mins(C.offFrom), mins(C.offTo))) return 'off';
  if ((C.offDays || []).includes(now.getDay())) return 'off';
  return inRange(n, mins(C.dayStart), mins(C.eveStart)) ? 'day' : 'eve';
}
function nextChange(now) {
  const n = now.getHours() * 60 + now.getMinutes(), pts = [C.dayStart, C.eveStart].concat(C.offOn ? [C.offFrom, C.offTo] : []);
  let best = null, bd = 1e9; pts.forEach(p => { let d = (mins(p) - n + 1440) % 1440; if (d === 0) d = 1440; if (d < bd) { bd = d; best = p; } });
  return best;
}

// ---------- Abspielliste ----------
function data() {
  return { name: C.name || ' ', accent: C.accent, logo: logoImg, hours: 'Montag bis Samstag, 9 bis 19 Uhr',
    items: C.items.split('\n').map(l => l.split('|').map(s => s.trim())).filter(r => r[0]) };
}
function playlist(p) {
  if (p === 'off') return [];
  const d = data(), list = [];
  const now = new Date(), fits = (x: any) => x.when === 'always' || x.when === p;
  if (C.tplOn && TEMPLATES[C.tpl]) TEMPLATES[C.tpl].slides(p === 'eve', d).forEach((fn, i) => list.push({ kind: 'tpl', fn, label: TEMPLATES[C.tpl].label.split(':')[0] + ', Folie ' + (i + 1) }));
  (C.extras || []).filter(b => fits(b) && bausteinActive(b, now)).forEach(b => list.push({ kind: 'tpl', fn: bausteinSlide(b), label: BAUSTEINE[b.kind].label + ': ' + bausteinTitle(b) }));
  C.media.filter(m => fits(m) && activeOn(m, now)).forEach(m => { if (blobs.has(m.id)) list.push({ kind: m.type, id: m.id, label: m.name }); });
  return list;
}

// ---------- Wiedergabe-Nachweis: wie oft lief welche Folie heute ----------
const PKEY = KEY + '-plays', today = () => new Date().toDateString();
let plays: { day: string; n: Record<string, number> } = { day: today(), n: {} };
try { const s = JSON.parse(localStorage.getItem(PKEY) || 'null'); if (s && s.day === today()) plays = s; } catch (e) {}
function countPlay(label: string) {
  if (!label) return; if (plays.day !== today()) plays = { day: today(), n: {} };
  plays.n[label] = (plays.n[label] || 0) + 1; try { localStorage.setItem(PKEY, JSON.stringify(plays)); } catch (e) {}
}

// ---------- Infoleiste: Laufband, Uhr, Wetter ----------
const leiste = document.getElementById('leiste') as HTMLCanvasElement;
let wx: Wetter | null = null, wxFail = false;
try { wx = JSON.parse(localStorage.getItem(KEY + '-wx') || 'null'); } catch (e) {}
async function loadWetter() {
  const L = C.leiste; if (!L || !L.on || !L.weather || L.lat == null) return;
  try { wx = await fetchWetter(L.lat, L.lon); wxFail = false; try { localStorage.setItem(KEY + '-wx', JSON.stringify(wx)); } catch (e) {} } catch (e) { wxFail = true; }
}
setInterval(loadWetter, 15 * 60e3);
const leisteOn = () => !!(C.leiste && C.leiste.on) && period(new Date()) !== 'off';
function layoutLeiste() {
  const on = leisteOn(), bh = on ? leisteH(innerWidth, innerHeight) : 0;
  document.body.style.setProperty('--lh', bh + 'px'); leiste.hidden = !on;
  if (cur && cur.canvas) sizeCanvas(cur);
}
// Wetter älter als drei Stunden zeigen wir nicht mehr an.
const wxNow = () => wx && Date.now() - wx.at < 3 * 3600e3 ? wx : null;
function paintLeiste(t: number) {
  if (leiste.hidden) return;
  const f = Math.min(devicePixelRatio || 1, 2), w = Math.round(leiste.clientWidth * f), h = Math.round(leiste.clientHeight * f);
  if (!w || !h) return; if (leiste.width !== w || leiste.height !== h) { leiste.width = w; leiste.height = h; }
  drawLeiste(leiste.getContext('2d'), 0, w, h, C.leiste, { name: C.name || ' ', accent: C.accent || '#0b7a67' }, t, wxNow());
}

// ---------- Wiedergabe mit Überblendung ----------
const screen = document.getElementById('screen'), empty = document.getElementById('empty'), offhint = document.getElementById('offhint');
let cur = null, idx = -1, timer = null, lastPeriod = null;
function makeLayer(item) {
  const el = document.createElement('div'); el.className = 'layer'; el.style.setProperty('--fit', C.fit);
  const L: any = { el, item };
  if (item.kind === 'tpl') {
    const c = document.createElement('canvas'); el.appendChild(c); L.canvas = c; L.ctx = c.getContext('2d');
  } else if (item.kind === 'image') {
    const i = document.createElement('img'); i.alt = ''; i.src = urlOf(item.id); el.appendChild(i);
  } else {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = urlOf(item.id); el.appendChild(v); L.video = v;
  }
  return L;
}
function sizeCanvas(L) {
  const cw = screen.clientWidth, ch = screen.clientHeight, f = Math.min(window.devicePixelRatio || 1, 2, 1920 / Math.max(cw, ch, 1)), w = Math.round(cw * f), h = Math.round(ch * f);
  if (L.canvas.width !== w || L.canvas.height !== h) { L.canvas.width = w; L.canvas.height = h; }
}
function advance() {
  clearTimeout(timer);
  const p = period(new Date()); lastPeriod = p;
  const list = playlist(p);
  if (!list.length) {
    if (cur) { const old = cur; old.el.classList.remove('on'); setTimeout(() => old.el.remove(), 900); cur = null; }
    empty.hidden = p === 'off'; offhint.hidden = p !== 'off'; offhint.textContent = 'Bildschirm-aus-Zeit von ' + C.offFrom + ' bis ' + C.offTo + ' Uhr. Taste E für Einstellungen.'; empty.textContent = 'Noch keine Inhalte für diese Tageszeit. Taste E drücken und Vorlage oder Dateien hinzufügen.';
    timer = setTimeout(advance, 5000); return;
  }
  empty.hidden = true; offhint.hidden = true;
  idx = (idx + 1) % list.length; countPlay(list[idx].label);
  const L = makeLayer(list[idx]); screen.appendChild(L.el);
  if (L.canvas) { sizeCanvas(L); L.fn = list[idx].fn; L.fn(L.ctx, L.canvas.width, L.canvas.height, data(), performance.now() / 1000); }
  requestAnimationFrame(() => L.el.classList.add('on'));
  const old = cur; cur = L;
  if (old) { old.el.classList.remove('on'); setTimeout(() => { if (old.video) old.video.pause(); old.el.remove(); }, 900); }
  if (L.video) {
    let done = false; const next = () => { if (!done) { done = true; advance(); } };
    L.video.onended = next; L.video.onerror = next;
    L.video.play().catch(next);
    timer = setTimeout(next, 10 * 60 * 1000);
  } else timer = setTimeout(advance, Math.max(3, +C.dur || 8) * 1000);
}
function tick() {
  if (cur && cur.canvas && cur.fn) { sizeCanvas(cur); cur.fn(cur.ctx, cur.canvas.width, cur.canvas.height, data(), performance.now() / 1000); }
  paintLeiste(performance.now() / 1000);
  requestAnimationFrame(tick);
}
setInterval(() => { const p = period(new Date()); if (p !== lastPeriod) { idx = -1; advance(); } layoutLeiste(); status(); }, 15000);

// ---------- Einstellungen ----------
const $ = (id: string) => document.getElementById(id) as any;
const panel = $('panel'), gear = $('gear');
function openPanel(on) { panel.classList.toggle('open', on); gear.setAttribute('aria-expanded', on); if (on) { status(); $('close').focus(); } }
gear.onclick = () => openPanel(true);
$('close').onclick = () => openPanel(false);
addEventListener('keydown', (e: any) => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.key === 'e' || e.key === 'E') openPanel(!panel.classList.contains('open'));
  if (e.key === 'Escape') openPanel(false);
  if (e.key === 'ArrowRight') advance();
});
let idleT; function wake() { document.body.classList.remove('idle'); clearTimeout(idleT); idleT = setTimeout(() => { if (!panel.classList.contains('open')) document.body.classList.add('idle'); }, 3000); }
addEventListener('mousemove', wake); addEventListener('pointerdown', wake); wake();
setTimeout(() => $('toast').classList.add('gone'), 6000);

const LABEL = { day: 'Tag', eve: 'Abend', off: 'Bildschirm aus' };
function status() {
  const now = new Date(), p = period(now), list = playlist(p);
  $('stNow').textContent = 'Jetzt ' + now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + (sim !== 'live' ? ' (Vorschau)' : '');
  $('stWhat').innerHTML = `<span class="pill ${p}">${LABEL[p]}</span> ${p === 'off' ? 'Schwarzer Bildschirm' : list.length + ' Folien in der Schleife'}`;
  $('stNext').textContent = sim === 'live' ? 'Nächster Wechsel um ' + nextChange(now) + ' Uhr' : 'Zum Testen fest eingestellt';
  $('storeNote').textContent = storeOK ? 'Alles wird in diesem Browser gespeichert und läuft ohne Internet weiter.' : 'Speichern ist hier blockiert: Änderungen gehen beim Neuladen verloren.';
}
function restart() { save(); idx = -1; layoutLeiste(); advance(); status(); }

const tplSel = $('tpl');
Object.entries(TEMPLATES).forEach(([k, v]) => { const o = document.createElement('option'); o.value = k; o.textContent = v.label; tplSel.appendChild(o); });
const sw = $('swatches');
SWATCHES.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.setAttribute('aria-label', 'Farbe ' + c); b.onclick = () => { C.accent = c; syncSw(); save(); }; sw.appendChild(b); });
function syncSw() { [...sw.children].forEach((b, i) => b.setAttribute('aria-pressed', SWATCHES[i] === C.accent)); }
function applyTpl(k, keepText) {
  const T = TEMPLATES[k]; C.tpl = k;
  if (!keepText) { C.name = T.name; C.items = T.items; C.accent = T.accent; }
  $('name').value = C.name; $('items').value = C.items; $('itemsHelp').textContent = T.help; tplSel.value = k; syncSw();
}
tplSel.onchange = () => { applyTpl(tplSel.value, false); restart(); };
$('name').oninput = (e: any) => { C.name = e.target.value; save(); };
$('items').oninput = (e: any) => { C.items = e.target.value; save(); };
$('tplOn').onchange = (e: any) => { C.tplOn = e.target.checked; restart(); };
['dayStart', 'eveStart', 'offFrom', 'offTo'].forEach(k => { $(k).onchange = (e: any) => { C[k] = e.target.value; restart(); }; });
$('offOn').onchange = (e: any) => { C.offOn = e.target.checked; restart(); };
$('dur').onchange = (e: any) => { C.dur = Math.min(120, Math.max(3, +e.target.value || 8)); e.target.value = C.dur; save(); };
$('fit').onchange = (e: any) => { C.fit = e.target.value; save(); if (cur) cur.el.style.setProperty('--fit', C.fit); };
document.querySelectorAll<HTMLButtonElement>('[data-sim]').forEach(b => b.onclick = () => {
  sim = b.dataset.sim; document.querySelectorAll('[data-sim]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); restart();
});
$('logoIn').onchange = (e: any) => { const f = e.target.files[0]; if (!f) return; dbPut('logo', f); if (urls.has('logo')) { URL.revokeObjectURL(urls.get('logo')); urls.delete('logo'); } loadLogo(); $('logoOff').hidden = false; };
$('logoOff').onclick = () => { dbDel('logo'); logoImg = null; $('logoOff').hidden = true; $('logoIn').value = ''; };
$('mediaIn').onchange = (e: any) => {
  [...e.target.files].forEach(f => {
    const type = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : null; if (!type) return;
    const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    dbPut(id, f); C.media.push({ id, type, name: f.name, when: 'always' });
  });
  e.target.value = ''; renderMedia(); restart();
};
function renderMedia() {
  const ul = $('mediaList'); ul.innerHTML = '';
  C.media.forEach((m, i) => {
    const li = document.createElement('li');
    const th: any = document.createElement(m.type === 'video' ? 'video' : 'img'); th.className = 'thumb'; th.src = urlOf(m.id) || ''; if (m.type === 'video') th.muted = true; else th.alt = '';
    const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = (m.type === 'video' ? 'Video: ' : '') + m.name; if (!blobs.has(m.id)) nm.textContent += ' (fehlt)';
    const ctl = document.createElement('span'); ctl.className = 'row';
    const sel = document.createElement('select'); sel.setAttribute('aria-label', 'Wann zeigen: ' + m.name);
    [['always', 'immer'], ['day', 'tagsüber'], ['eve', 'abends']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
    sel.value = m.when; sel.onchange = () => { m.when = sel.value; restart(); };
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Entfernen: ' + m.name);
    x.onclick = () => { dbDel(m.id); C.media.splice(i, 1); renderMedia(); restart(); };
    ctl.append(sel, x); li.append(th, nm, ctl); ul.appendChild(li);
  });
}
$('fs').onclick = () => { const d = document.documentElement; (d.requestFullscreen ? d.requestFullscreen() : Promise.reject()).catch(() => { $('storeNote').textContent = 'Vollbild ist hier gesperrt. Auf der Box startet der Player ohnehin im Vollbild.'; }); };
$('reset').onclick = () => {
  if ($('reset').dataset.armed !== '1') { $('reset').dataset.armed = '1'; $('reset').textContent = 'Wirklich alles löschen?'; setTimeout(() => { $('reset').dataset.armed = ''; $('reset').textContent = 'Alles zurücksetzen'; }, 4000); return; }
  C.media.forEach(m => dbDel(m.id)); dbDel('logo'); logoImg = null; C = Object.assign({}, DEF, { media: [] }); applyTpl(C.tpl, false); syncForm(); renderMedia(); restart();
  $('reset').dataset.armed = ''; $('reset').textContent = 'Alles zurücksetzen';
};
function syncForm() {
  $('tplOn').checked = C.tplOn; ['dayStart', 'eveStart', 'offFrom', 'offTo'].forEach(k => $(k).value = C[k]);
  $('offOn').checked = C.offOn; $('dur').value = C.dur; $('fit').value = C.fit; $('logoOff').hidden = !blobs.has('logo');
}
addEventListener('resize', () => { layoutLeiste(); if (cur && cur.canvas) sizeCanvas(cur); });

// ---------- Paket übernehmen: aus der Cloud oder vom USB-Stick ----------
function applyPaket(p: Paket) {
  const c = p.config;
  C.media.forEach(m => dbDel(m.id)); dbDel('logo'); logoImg = null;
  Object.entries(p.files || {}).forEach(([id, b]) => { if (b instanceof Blob) dbPut(id, b); });
  Object.assign(C, { revision: p.show.revision, tplOn: !!c.tpl, tpl: c.tpl || C.tpl, name: c.name, items: c.items, accent: c.accent, dur: c.dur, fit: c.fit,
    dayStart: c.dayStart, eveStart: c.eveStart, offOn: c.offOn, offFrom: c.offFrom, offTo: c.offTo, offDays: c.offDays || [], notice: c.notice || null, media: c.media.map(m => ({ ...m })), extras: (c.extras || []).map(b => ({ ...b, f: { ...b.f } })), leiste: c.leiste ? { ...c.leiste } : null });
  layoutLeiste(); loadWetter(); loadLogo(); applyTpl(C.tpl, true); syncForm(); renderMedia(); restart(); showNotice();
  toast('Neue Inhalte: „' + p.show.name + '“ (Stand ' + p.show.revision + ')');
}
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('gone'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('gone'), 4000); }
$('paketIn').onchange = async (e: any) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { applyPaket(await paketFromFile(await f.text())); $('paketNote').textContent = 'Paket „' + f.name + '“ geladen.'; }
  catch (err) { $('paketNote').textContent = 'Konnte das Paket nicht laden: ' + err.message; }
};

// ---------- Sofort-Hinweis: Band über allen Folien ----------
const noticeNow = () => C.notice && C.notice.text && (!C.notice.until || Date.now() < C.notice.until) ? C.notice.text : '';
function showNotice() { const t = noticeNow(), el = $('notice'); el.hidden = !t || period(new Date()) === 'off'; el.textContent = t; el.style.setProperty('--nc', C.accent || '#111'); }
setInterval(showNotice, 5000);

// ---------- Verbindung zum Cloud-Panel (nur mit ?live=...) ----------
const born = Date.now();
function snapshot(): string {
  const lh = leiste.hidden ? 0 : leiste.clientHeight, c = document.createElement('canvas'), w = 480, full = Math.round(480 * (screen.clientHeight + lh) / Math.max(screen.clientWidth, 1)), h = full - Math.round(480 * lh / Math.max(screen.clientWidth, 1));
  c.width = w; c.height = full; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, w, full);
  const src: any = cur && (cur.canvas || cur.video || cur.el.querySelector('img'));
  if (src && period(new Date()) !== 'off') {
    const sw = src.videoWidth || src.naturalWidth || src.width, sh = src.videoHeight || src.naturalHeight || src.height;
    if (sw && sh) { const s = cur.canvas || C.fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh); try { x.drawImage(src, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s); } catch (e) {} }
    if (noticeNow()) drawNotice(x, w, h, noticeNow(), C.accent);
    if (lh) drawLeiste(x, h, w, full - h, C.leiste, { name: C.name || ' ', accent: C.accent || '#0b7a67' }, performance.now() / 1000, wxNow());
  }
  return c.toDataURL('image/jpeg', .8);
}
function identify(label) {
  const el = document.createElement('div'); el.className = 'ident'; el.textContent = label; document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
if (LIVE && 'BroadcastChannel' in window) {
  const ch = new BroadcastChannel(CHANNEL);
  const send = (m: Msg) => ch.postMessage(m);
  ch.onmessage = (e: MessageEvent<Msg>) => {
    const m = e.data; if (!m || (m as any).screen !== LIVE) return;
    if (m.t === 'paket') applyPaket(m.paket);
    if (m.t === 'notice') { C.notice = m.notice; save(); showNotice(); }
    if (m.t === 'cmd') {
      if (m.cmd === 'restart') location.reload();
      if (m.cmd === 'power') { forcedOff = !m.on; restart(); showNotice(); }
      if (m.cmd === 'identify') identify(m.label || LIVE);
      if (m.cmd === 'shot') send({ t: 'shot', screen: LIVE, url: snapshot() });
    }
  };
  const beat = () => send({ t: 'beat', screen: LIVE, period: period(new Date()), slide: idx + 1, of: playlist(period(new Date())).length, revision: C.revision, power: !forcedOff, w: innerWidth, h: innerHeight, uptime: Math.round((Date.now() - born) / 1000), plays: plays.day === today() ? plays.n : {}, wx: !!wxNow() });
  setInterval(beat, 3000);
  window['__live'] = () => { send({ t: 'hello', screen: LIVE }); beat(); };
}

// ---------- ShowCube Cloud: Box koppeln, Pakete abholen, Herzschlag ----------
// Mit player.html?cloud (oder in den Einstellungen) wird der Player zur Cloud-Box:
// Er meldet sich anonym beim Server an, zeigt einen Koppel-Code und holt sich danach alle 10 Sekunden seinen Stand.
// Ohne Internet läuft er einfach mit dem zuletzt geholten Paket weiter.
const VERSION = '0.4.0';
const CKEY = KEY + '-cloud';
const q = new URLSearchParams(location.search);
if (hatServer && q.has('cloud')) { try { localStorage.setItem(CKEY, '1'); } catch (e) {} }
let cloudOn = false; try { cloudOn = hatServer && !LIVE && localStorage.getItem(CKEY) === '1'; } catch (e) {}
let cloudState: 'start' | 'pair' | 'ok' | 'offline' = 'start', cloudName = '', cloudAt = 0;
let stand = ''; try { stand = localStorage.getItem(CKEY + '-stand') || ''; } catch (e) {}
function zustand() {
  const p = period(new Date());
  return { period: p, slide: idx + 1, of: playlist(p).length, revision: C.revision, power: !forcedOff, w: innerWidth, h: innerHeight, uptime: Math.round((Date.now() - born) / 1000), plays: plays.day === today() ? plays.n : {}, wx: !!wxNow() };
}
let pairCode: string | null = null;
function showPair(code: string | null, offline = false) {
  $('pair').hidden = false; if (code) pairCode = code; else code = offline ? pairCode : null;
  $('pairCode').textContent = code ? code.slice(0, 3) + ' ' + code.slice(3) : '···';
  $('pairText').textContent = code ? 'Im ShowCube-Panel auf „Bildschirm koppeln“ tippen und diesen Code eingeben.' : 'Die Box verbindet sich mit ShowCube.';
  $('pairSt').textContent = offline ? 'Keine Verbindung zum Server. Die Box versucht es weiter. Ist das WLAN eingerichtet?' : '';
}
// Dateien aus dem Speicher holen. Bilder und Videos behalten ihre Nummer, schon vorhandene laden wir nicht nochmal.
async function holePaket(sb: SupabaseClient, p: Paket): Promise<Paket> {
  const files: Record<string, Blob> = {};
  for (const [k, v] of Object.entries(p.files || {})) {
    if (typeof v !== 'string' || !v.startsWith(SPEICHER)) continue;
    if (k !== 'logo' && blobs.has(k)) { files[k] = blobs.get(k); continue; }
    const r = await sb.storage.from(BUCKET).download(v.slice(SPEICHER.length));
    if (r.error) throw r.error;
    files[k] = r.data;
  }
  return { ...p, files };
}
function cloudNote() {
  if (!hatServer) return;
  $('cloudGroup').hidden = !!LIVE;
  $('cloudBtn').textContent = cloudOn ? 'Von der Cloud trennen' : 'Mit ShowCube Cloud verbinden';
  $('cloudNote').textContent = !cloudOn ? 'Die Box holt sich ihre Inhalte dann aus dem Panel, statt vom USB-Stick.'
    : cloudState === 'ok' ? 'Verbunden als „' + cloudName + '“. Inhalte kommen aus dem Panel.'
    : cloudState === 'pair' ? 'Wartet aufs Koppeln. Den Code auf dem Bildschirm im Panel eingeben.'
    : cloudState === 'offline' ? 'Gerade keine Verbindung' + (cloudAt ? ', zuletzt um ' + new Date(cloudAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' : '') + '. Der letzte Stand läuft weiter.'
    : 'Verbindet …';
}
$('cloudBtn').onclick = () => {
  try { if (cloudOn) { localStorage.removeItem(CKEY); localStorage.removeItem(CKEY + '-stand'); localStorage.removeItem('showcube-box'); } else localStorage.setItem(CKEY, '1'); } catch (e) {}
  location.reload();
};
async function cloudLoop() {
  const sb = verbinden('showcube-box');
  let erledigt: number[] = [], lastHint = JSON.stringify(C.notice || null);
  const tick = async () => {
    try {
      const { data: s } = await sb.auth.getSession();
      if (!s.session) { const r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; }
      const { data, error } = await sb.rpc('box_stand', { p_zustand: zustand(), p_stand: stand, p_erledigt: erledigt, p_version: VERSION });
      if (error) throw error;
      erledigt = [];
      if (!data.bekannt || (!data.gekoppelt && !data.code)) {
        const a = await sb.rpc('box_anmelden'); if (a.error) throw a.error;
        cloudState = a.data.gekoppelt ? 'ok' : 'pair'; if (!a.data.gekoppelt) showPair(a.data.code);
        // Neu angemeldet (z.B. im Panel entfernt): alter Stand gilt nicht mehr.
        stand = ''; try { localStorage.removeItem(CKEY + '-stand'); } catch (e) {}
        return;
      }
      cloudAt = Date.now();
      if (!data.gekoppelt) { cloudState = 'pair'; showPair(data.code); return; }
      cloudState = 'ok'; cloudName = data.name; $('pair').hidden = true;
      if (data.paket) {
        const p = await holePaket(sb, data.paket);
        applyPaket(p); stand = data.stand; try { localStorage.setItem(CKEY + '-stand', stand); } catch (e) {}
      }
      const hint = JSON.stringify(data.hinweis || null);
      if (hint !== lastHint || JSON.stringify(C.notice || null) !== hint) { lastHint = hint; C.notice = data.hinweis || null; save(); showNotice(); }
      if (forcedOff !== !data.strom) { forcedOff = !data.strom; restart(); showNotice(); }
      for (const b of data.befehle || []) {
        if (b.befehl === 'identify') { identify(data.name); erledigt.push(b.id); }
        if (b.befehl === 'shot') { const r = await sb.rpc('box_foto', { p_befehl: b.id, p_bild: snapshot() }); if (r.error) erledigt.push(b.id); }
        if (b.befehl === 'restart') { await sb.rpc('box_stand', { p_zustand: zustand(), p_stand: stand, p_erledigt: [...erledigt, b.id], p_version: VERSION }); location.reload(); return; }
      }
    } catch (e) {
      cloudState = 'offline';
      // Noch nie gekoppelt: Hinweis auf dem Fernseher. Sonst einfach weiterspielen.
      if (!stand && !cloudName) showPair(null, true);
    } finally {
      cloudNote();
      // Befehle (Foto, Finden) sollen schnell ankommen. Mehr als alle 10 Sekunden muss die Box nicht fragen.
      setTimeout(tick, cloudState === 'pair' ? 5000 : 10000);
    }
  };
  if (!stand) showPair(null);
  tick();
}

// ---------- Start ----------
const start = async () => {
  await openDB(); await dbLoadAll(); loadLogo();
  applyTpl(C.tpl, !!C.name); syncForm(); renderMedia(); status(); layoutLeiste(); loadWetter(); advance(); requestAnimationFrame(tick);
  showNotice();
  cloudNote(); if (cloudOn) cloudLoop();
  if (LIVE) { $('liveNote').hidden = false; $('liveNote').textContent = 'Mit dem Cloud-Panel verbunden als Bildschirm „' + LIVE + '“. Änderungen im Panel kommen automatisch an.'; window['__live'](); }
};
fontsReady().then(start, start);
