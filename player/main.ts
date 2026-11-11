import '../shared/fonts.css';
import { fontsReady, TEMPLATES, SWATCHES } from '../shared/templates';

// ---------- Speicher: Einstellungen in localStorage, Dateien in IndexedDB ----------
const KEY = 'svizzbox-player-v0';
const DEF = { tpl: 'makler', tplOn: true, name: '', items: '', accent: '', dayStart: '06:00', eveStart: '17:00', offOn: true, offFrom: '22:00', offTo: '07:00', dur: 8, fit: 'cover', media: [] };
let C = Object.assign({}, DEF);
let storeOK = true;
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) C = Object.assign({}, DEF, s); } catch (e) { storeOK = false; }
function save() { try { localStorage.setItem(KEY, JSON.stringify(C)); } catch (e) { storeOK = false; } }
let db = null; const blobs = new Map(), urls = new Map();
function openDB() {
  return new Promise<void>(res => {
    try {
      const r = indexedDB.open('svizzbox-player', 1);
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
let sim = 'live';
const mins = s => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
const inRange = (n, a, b) => a <= b ? n >= a && n < b : n >= a || n < b;
function period(now) {
  if (sim !== 'live') return sim;
  const n = now.getHours() * 60 + now.getMinutes();
  if (C.offOn && inRange(n, mins(C.offFrom), mins(C.offTo))) return 'off';
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
  if (C.tplOn && TEMPLATES[C.tpl]) TEMPLATES[C.tpl].slides(p === 'eve', d).forEach(fn => list.push({ kind: 'tpl', fn }));
  C.media.filter(m => m.when === 'always' || m.when === p).forEach(m => { if (blobs.has(m.id)) list.push({ kind: m.type, id: m.id }); });
  return list;
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
  idx = (idx + 1) % list.length;
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
  requestAnimationFrame(tick);
}
setInterval(() => { const p = period(new Date()); if (p !== lastPeriod) { idx = -1; advance(); } status(); }, 15000);

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
function restart() { save(); idx = -1; advance(); status(); }

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
addEventListener('resize', () => { if (cur && cur.canvas) sizeCanvas(cur); });

// ---------- Start ----------
const start = async () => {
  await openDB(); await dbLoadAll(); loadLogo();
  applyTpl(C.tpl, !!C.name); syncForm(); renderMedia(); status(); advance(); requestAnimationFrame(tick);
};
fontsReady().then(start, start);
