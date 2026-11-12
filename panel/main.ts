import '../shared/fonts.css';
import { fontsReady, TEMPLATES, SWATCHES, drawNotice } from '../shared/templates';
import { CHANNEL, PAKET_FORMAT, PAKET_VERSION, paketToFile, type Msg, type Notice, type Paket, type ShowConfig, type When } from '../shared/paket';

// Cloud-Panel, Prototyp. Kein Server: Zustand in localStorage, Dateien in IndexedDB.
// "Live öffnen" startet einen echten Player in einem zweiten Tab, verbunden über einen BroadcastChannel.
// Temperatur, Netz und der Online-Status der Demo-Boxen sind gespielt.

// ---------- Kleine Helfer ----------
const $ = (id: string) => document.getElementById(id) as any;
type Kid = Node | string | number | null | undefined | false | Kid[];
function h(tag: string, props: Record<string, any> | null = null, ...kids: Kid[]): any {
  const e: any = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') e[k] = v;
    else if (k === 'style') e.style.cssText = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  const add = (c: Kid) => { if (Array.isArray(c)) c.forEach(add); else if (c != null && c !== false) e.append(c as any); };
  kids.forEach(add);
  return e;
}
// Wie replaceChildren, aber null und Listen sind erlaubt.
function fill(e: Element, ...kids: Kid[]) { const f = h('div', null, ...kids); e.replaceChildren(...f.childNodes); }
const ICONS: Record<string, string> = {
  screens: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  slides: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5l4.5 2.5-4.5 2.5z"/>',
  media: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  templates: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  power: '<path d="M12 3v9M6.3 7.3a8 8 0 1 0 11.4 0"/>', restart: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  ping: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.3 6.3C3.5 8.200 2 12 2 12s3.5 7 10 7a10 10 0 0 0 4.2-.9M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v4l3 2"/>', alert: '<path d="M12 3l10 18H2zM12 10v5M12 18v.5"/>',
  shop: '<path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M9 20v-6h6v6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = (n: string) => { const t = document.createElement('template'); t.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`; return t.content.firstChild as SVGElement; };
const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const clock = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const dateTime = (t: number) => { const d = new Date(t), today = new Date().toDateString() === d.toDateString(); return (today ? 'heute' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })) + ', ' + clock(t) + ' Uhr'; };
function since(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return 'wenigen Sekunden'; const m = Math.round(s / 60); if (m < 60) return m + ' min';
  const hh = Math.floor(m / 60); return hh < 48 ? hh + ' h ' + (m % 60) + ' min' : Math.floor(hh / 24) + ' Tagen';
}
const dur = (s: number) => s < 60 ? s + ' s' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 172800 ? Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min' : Math.floor(s / 86400) + ' Tagen';
const plural = (n: number, one: string, many: string) => n + ' ' + (n === 1 ? one : many);
const kb = (n: number) => n > 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';

// Im Build liegen alle drei Apps nebeneinander in release/, in der Entwicklung je in einem Ordner.
const REL = /\.html$/.test(location.pathname);
const PLAYER_URL = REL ? 'player.html' : '../player/';
const KONFIG_URL = REL ? 'konfigurator.html' : '../konfigurator/';

// ---------- Datenmodell ----------
type Row = { c: string[]; off?: boolean };
type MediaUse = { id: string; when: When };
interface Cfg { tpl: string | null; name: string; rows: Row[]; accent: string; logo: string | null; dur: number; fit: 'cover' | 'contain'; dayStart: string; eveStart: string; offOn: boolean; offFrom: string; offTo: string; offDays: number[]; media: MediaUse[]; }
interface Version { revision: number; at: number; cfg: Cfg; }
interface Show { id: string; name: string; revision: number; published: number | null; cfg: Cfg; pub: Cfg | null; history: Version[]; }
interface Screen { id: string; name: string; place: string; orient: 'land' | 'port'; show: string; power: boolean; sim: 'online' | 'offline'; lastSeen: number; revision: number; version: string; temp: number; disk: number; net: string; booted: number; log: { t: number; msg: string }[]; }
interface Asset { id: string; type: 'image' | 'video'; name: string; size: number; added: number; }
interface State { shows: Show[]; screens: Screen[]; assets: Asset[]; notice: (Notice & { screens: string[] }) | null; }

const rowsOf = (items: string): Row[] => items.split('\n').filter(l => l.trim()).map(l => ({ c: l.split('|').map(s => s.trim()) }));
const baseCfg = (tpl: string | null): Cfg => {
  const T = tpl ? TEMPLATES[tpl] : null;
  return { tpl, name: T ? T.name : '', rows: T ? rowsOf(T.items) : [], accent: T ? T.accent : SWATCHES[0], logo: null, dur: 8, fit: 'cover',
    dayStart: '06:00', eveStart: '17:00', offOn: true, offFrom: '22:00', offTo: '07:00', offDays: [], media: [] };
};
function seed(): State {
  const now = Date.now(), H = 3600e3;
  const mk = (id: string, name: string, cfg: Cfg): Show => ({ id, name, revision: 1, published: now - 26 * H, cfg, pub: clone(cfg), history: [{ revision: 1, at: now - 26 * H, cfg: clone(cfg) }] });
  const scr = (id: string, name: string, place: string, orient: any, show: string, sim: any, lastSeen: number, temp: number, net: string): Screen => ({ id, name, place, orient, show, power: true, sim, lastSeen, revision: 1, version: '0.3.1', temp, disk: 18 + (id.length * 7) % 30, net, booted: now - 3 * 24 * H - id.length * 1e6,
    log: [{ t: now - 26 * H, msg: 'Inhalte Stand 1 übernommen' }, { t: now - 3 * 24 * H, msg: 'Box gestartet' }] });
  return {
    shows: [
      mk('pizza', 'Mittags- und Abendkarte', { ...baseCfg('gastro'), dayStart: '11:00', eveStart: '17:00', offFrom: '23:30', offTo: '10:30', offDays: [1] }),
      mk('makler', 'Objekte im Fenster', { ...baseCfg('makler'), dur: 10, offFrom: '23:00', offTo: '06:00' }),
      mk('sale', 'Herbst-Sale', baseCfg('laden')),
    ],
    screens: [
      scr('theke', 'Theke', 'Pizzeria Da Marco', 'land', 'pizza', 'online', now, 51, 'WLAN, gut'),
      scr('fenster', 'Schaufenster', 'Pizzeria Da Marco', 'port', 'pizza', 'online', now, 58, 'WLAN, mittel'),
      scr('hausmann', 'Fenster links', 'Hausmann Immobilien', 'land', 'makler', 'offline', now - 2 * H - 13 * 60e3, 47, 'LAN'),
      scr('linde', 'Eingang', 'Modehaus Linde', 'land', 'sale', 'online', now, 49, 'LAN'),
    ],
    assets: [], notice: null,
  };
}
const KEY = 'showcube-panel-v1';
let S: State = seed();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.shows && s.screens) S = s; } catch (e) {}
let saveOK = true;
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { saveOK = false; } }
const showById = (id: string) => S.shows.find(s => s.id === id);
const assetById = (id: string) => S.assets.find(a => a.id === id);
const isDirty = (sh: Show) => !sh.pub || JSON.stringify(sh.cfg) !== JSON.stringify(sh.pub);
const itemsOf = (c: Cfg) => c.rows.filter(r => !r.off && (r.c[0] || '').trim()).map(r => r.c.join(' | ')).join('\n');
function logTo(sc: Screen, msg: string) { sc.log.unshift({ t: Date.now(), msg }); sc.log = sc.log.slice(0, 30); }

// ---------- Dateien (IndexedDB) ----------
let db: IDBDatabase = null; const blobs = new Map<string, Blob>(), urls = new Map<string, string>();
const openDB = () => new Promise<void>(res => {
  try { const r = indexedDB.open('showcube-panel', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => { db = r.result; res(); }; r.onerror = () => res(); } catch (e) { res(); }
});
const loadAll = () => new Promise<void>(res => {
  if (!db) return res();
  try { const rq = db.transaction('files').objectStore('files').openCursor(); rq.onsuccess = () => { const c = rq.result; if (c) { blobs.set(c.key as string, c.value); c.continue(); } else res(); }; rq.onerror = () => res(); } catch (e) { res(); }
});
function putBlob(id: string, b: Blob) { blobs.set(id, b); try { db && db.transaction('files', 'readwrite').objectStore('files').put(b, id); } catch (e) {} }
function delBlob(id: string) { blobs.delete(id); if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } try { db && db.transaction('files', 'readwrite').objectStore('files').delete(id); } catch (e) {} }
// Gelöschte Dateien bleiben bis zum nächsten Start liegen, damit "Rückgängig" sie zurückholen kann.
function sweepBlobs() {
  const used = new Set<string>(S.assets.map(a => a.id));
  S.shows.forEach(sh => [sh.cfg, sh.pub, ...sh.history.map(v => v.cfg)].forEach(c => { if (c && c.logo) used.add(c.logo); }));
  [...blobs.keys()].forEach(k => { if (!used.has(k)) delBlob(k); });
}
const urlOf = (id: string) => { if (!urls.has(id) && blobs.has(id)) urls.set(id, URL.createObjectURL(blobs.get(id))); return urls.get(id); };
const imgs = new Map<string, HTMLImageElement>(), vids = new Map<string, HTMLVideoElement>();
function imgOf(id: string) { if (!imgs.has(id) && blobs.has(id)) { const i = new Image(); i.src = urlOf(id); imgs.set(id, i); } return imgs.get(id); }
function vidOf(id: string) { if (!vids.has(id) && blobs.has(id)) { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.src = urlOf(id); vids.set(id, v); } return vids.get(id); }

// ---------- Zeitplan und Folien, wie im Player ----------
const mins = (s: string) => { const [a, b] = (s || '0:0').split(':').map(Number); return a * 60 + b; };
const inRange = (n: number, a: number, b: number) => a <= b ? n >= a && n < b : n >= a || n < b;
function periodAt(c: Cfg, n: number) { if (c.offOn && inRange(n, mins(c.offFrom), mins(c.offTo))) return 'off'; return inRange(n, mins(c.dayStart), mins(c.eveStart)) ? 'day' : 'eve'; }
function periodOf(c: Cfg, now = new Date()) { if ((c.offDays || []).includes(now.getDay())) return 'rest'; return periodAt(c, now.getHours() * 60 + now.getMinutes()); }
const PERIOD = { day: 'Tag', eve: 'Abend', off: 'Nachts aus', rest: 'Ruhetag' };
function dataOf(c: Cfg) {
  const li = c.logo && imgOf(c.logo);
  return { name: c.name || ' ', accent: c.accent, logo: li && li.complete && li.naturalWidth ? li : null, hours: 'Montag bis Samstag, 9 bis 19 Uhr',
    items: c.rows.filter(r => !r.off && (r.c[0] || '').trim()).map(r => r.c) };
}
function slidesOf(c: Cfg, p: string) {
  if (p === 'off' || p === 'rest') return [];
  const list: any[] = [];
  if (c.tpl && TEMPLATES[c.tpl]) TEMPLATES[c.tpl].slides(p === 'eve', dataOf(c)).forEach(fn => list.push({ kind: 'tpl', fn }));
  c.media.forEach(m => { const a = assetById(m.id); if (a && blobs.has(a.id) && (m.when === 'always' || m.when === p)) list.push({ kind: a.type, id: a.id }); });
  return list;
}
function drawItem(ctx: CanvasRenderingContext2D, w: number, h2: number, it: any, c: Cfg, t: number) {
  if (!it) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h2); return; }
  if (it.kind === 'tpl') { ctx.save(); it.fn(ctx, w, h2, dataOf(c), t); ctx.restore(); return; }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h2);
  const src: any = it.kind === 'image' ? imgOf(it.id) : vidOf(it.id); if (!src) return;
  if (it.kind === 'video' && src.paused) src.play().catch(() => {});
  const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight; if (!sw || !sh) return;
  const s = c.fit === 'contain' ? Math.min(w / sw, h2 / sh) : Math.max(w / sw, h2 / sh);
  try { ctx.drawImage(src, (w - sw * s) / 2, (h2 - sh * s) / 2, sw * s, sh * s); } catch (e) {}
}
function stillOf(c: Cfg, w: number, h2: number, period = 'day', i = 0, notice = '') {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h2; const x = cv.getContext('2d');
  drawItem(x, w, h2, slidesOf(c, period)[i], c, 0); if (notice) drawNotice(x, w, h2, notice, c.accent); return cv;
}

// Ein Abspieler pro Vorschau-Leinwand. Ein gemeinsamer Takt (30 Bilder/s) zeichnet nur die sichtbaren.
interface Pv { canvas: HTMLCanvasElement; cfg: () => Cfg | null; period: () => string; black?: () => boolean; notice?: () => string; onSlide?: (i: number, n: number, p: string) => void; idx: number; next: number; prev: any; fadeAt: number; key: string; }
const pvs = new Set<Pv>();
function preview(canvas: HTMLCanvasElement, o: Partial<Pv>) { const p = { canvas, idx: 0, next: 0, prev: null, fadeAt: 0, key: '', ...o } as Pv; pvs.add(p); return p; }
function tv(orient: 'land' | 'port', o: Partial<Pv>) { const cv = h('canvas'), frame = h('div', { class: 'tvf ' + orient }, cv); return { frame, pv: preview(cv, o) }; }
let lastFrame = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  if (now - lastFrame < 30 || document.hidden) return; lastFrame = now;
  for (const p of pvs) {
    const cv = p.canvas;
    if (!cv.isConnected) { pvs.delete(p); continue; }
    const r = cv.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const f = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * f), hh = Math.round(r.height * f);
    if (cv.width !== w || cv.height !== hh) { cv.width = w; cv.height = hh; }
    const c = p.cfg(), per = p.period(), list = c ? slidesOf(c, per) : [], ctx = cv.getContext('2d');
    if (!list.length || (p.black && p.black())) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, hh); p.prev = null; }
    else {
      if (p.idx >= list.length) p.idx = 0;
      if (!p.next) p.next = now + Math.max(3, c.dur) * 1000;
      if (now > p.next) { p.prev = list[p.idx]; p.fadeAt = now; p.idx = (p.idx + 1) % list.length; p.next = now + Math.max(3, c.dur) * 1000; }
      const a = p.prev ? Math.min(1, (now - p.fadeAt) / 450) : 1;
      if (a < 1) { drawItem(ctx, w, hh, p.prev, c, now / 1000); ctx.globalAlpha = a; }
      drawItem(ctx, w, hh, list[p.idx], c, now / 1000); ctx.globalAlpha = 1;
      const nt = p.notice && p.notice(); if (nt) drawNotice(ctx, w, hh, nt, c.accent);
    }
    const key = p.idx + '/' + list.length + '/' + per;
    if (key !== p.key) { p.key = key; if (p.onSlide) p.onSlide(p.idx, list.length, per); }
  }
}

// ---------- Verbindung zu echten Playern (Tabs mit ?live=...) ----------
const ch = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
const live = new Map<string, { beat?: any; at: number }>();
const isLive = (id: string) => { const l = live.get(id); return !!l && Date.now() - l.at < 8000; };
const send = (m: Msg) => ch && ch.postMessage(m);
const isOn = (sc: Screen) => isLive(sc.id) || sc.sim === 'online';
function noticeFor(id: string): Notice | null { const n = S.notice; return n && n.screens.includes(id) && (!n.until || Date.now() < n.until) ? { text: n.text, until: n.until } : null; }
function toConfig(c: Cfg, sc?: Screen): ShowConfig {
  const media = c.media.map(m => { const a = assetById(m.id); return a && blobs.has(a.id) ? { id: a.id, type: a.type, name: a.name, when: m.when } : null; }).filter(Boolean);
  return { tpl: c.tpl, name: c.name, items: itemsOf(c), accent: c.accent, dur: c.dur, fit: c.fit, dayStart: c.dayStart, eveStart: c.eveStart, offOn: c.offOn, offFrom: c.offFrom, offTo: c.offTo, offDays: c.offDays, notice: sc ? noticeFor(sc.id) : null, media };
}
function paketFor(sh: Show, c: Cfg, sc?: Screen): Paket {
  const config = toConfig(c, sc), files: Record<string, Blob> = {};
  config.media.forEach(m => { files[m.id] = blobs.get(m.id); });
  if (c.logo && blobs.has(c.logo)) files.logo = blobs.get(c.logo);
  return { format: PAKET_FORMAT, version: PAKET_VERSION, show: { id: sh.id, name: sh.name, revision: sh.revision, published: new Date(sh.published || Date.now()).toISOString() }, screen: sc ? { id: sc.id, name: sc.name } : undefined, config, files };
}
function deliver(sc: Screen) {
  const sh = showById(sc.show); if (!sh) return;
  if (isLive(sc.id)) { send({ t: 'paket', screen: sc.id, paket: paketFor(sh, sh.pub || sh.cfg, sc) }); sc.revision = sh.revision; logTo(sc, 'Inhalte Stand ' + sh.revision + ' gesendet'); }
  else if (sc.sim === 'online') { sc.revision = sh.revision; logTo(sc, 'Inhalte Stand ' + sh.revision + ' übernommen'); }
  else logTo(sc, 'Stand ' + sh.revision + ' wartet, Box ist offline');
}
const shotWait = new Map<string, (url: string) => void>();
if (ch) ch.onmessage = (e: MessageEvent<Msg>) => {
  const m = e.data, sc = m && S.screens.find(s => s.id === (m as any).screen); if (!sc) return;
  const l = live.get(sc.id) || { at: 0 }, was = isLive(sc.id); l.at = Date.now(); live.set(sc.id, l);
  if (m.t === 'hello') { logTo(sc, 'Player verbunden'); sc.booted = Date.now(); deliver(sc); save(); }
  if (m.t === 'beat') { l.beat = m; sc.lastSeen = Date.now(); }
  if (m.t === 'shot') { const f = shotWait.get(sc.id); if (f) { shotWait.delete(sc.id); f(m.url); } }
  if (!was || m.t === 'hello') { render(); if (openId === sc.id) drawScreenDlg(); } else runTicks();
};

// ---------- Rückmeldungen: Toast mit Rückgängig ----------
let toastT: any, undoFn: (() => void) | null = null;
function toast(text: string, undo?: () => void) {
  $('toastText').textContent = text; undoFn = undo || null; $('toastUndo').hidden = !undo;
  $('toast').classList.remove('gone'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.add('gone'), undo ? 7000 : 3800);
}
$('toastUndo').onclick = () => { const f = undoFn; undoFn = null; $('toast').classList.add('gone'); if (f) f(); };
function undoable(text: string, change: () => void) {
  const before = JSON.stringify(S); change(); save(); render();
  toast(text, () => { S = JSON.parse(before); save(); render(); pushNotice(); if (openId) drawScreenDlg(); toast('Rückgängig gemacht.'); });
}

// ---------- Navigation ----------
const VIEWS = [['screens', 'Bildschirme', 'screens'], ['shows', 'Inhalte', 'slides'], ['media', 'Medien', 'media'], ['templates', 'Vorlagen', 'templates']];
let view = 'screens', cur: string = null, tab = 'content', placeFilter = '';
let ticks: (() => void)[] = [];
const runTicks = () => ticks.forEach(f => f());
function go(v: string, id?: string) { const hsh = '#' + v + (id ? '/' + id : ''); if (location.hash === hsh) route(); else location.hash = hsh; }
function route() {
  const [v, id] = location.hash.slice(1).split('/');
  view = VIEWS.some(x => x[0] === v) ? v : 'screens';
  if (view === 'shows' && id && showById(id)) cur = id;
  render(); scrollTo(0, 0);
}
addEventListener('hashchange', route);
function renderNav() {
  const drafts = S.shows.filter(isDirty).length, off = S.screens.filter(s => !isOn(s)).length;
  const count = { screens: off ? h('span', { class: 'n alert', title: off + ' offline' }, String(off)) : h('span', { class: 'n' }, String(S.screens.length)),
    shows: drafts ? h('span', { class: 'n alert', title: 'Unveröffentlichte Änderungen' }, String(drafts)) : h('span', { class: 'n' }, String(S.shows.length)),
    media: S.assets.length ? h('span', { class: 'n' }, String(S.assets.length)) : null, templates: null };
  const mk = (withCount: boolean) => VIEWS.map(([k, label, ic]) => h('button', { 'aria-current': view === k ? 'page' : null, onclick: () => go(k) }, icon(ic), label, withCount ? count[k] : null));
  fill($('nav'), ...mk(true)); fill($('tabbar'), ...mk(false));
  $('planName').textContent = 'Cloud · ' + plural(S.screens.length, 'Bildschirm', 'Bildschirme');
  $('planInfo').textContent = S.screens.length * 12 + ' € im Monat · Konto Demo';
  const n = S.notice && (!S.notice.until || Date.now() < S.notice.until) ? S.notice : null;
  $('noticeChip').hidden = !n; if (n) $('noticeChipText').textContent = 'Hinweis läuft: „' + n.text + '“';
}
function render() {
  ticks = []; renderNav();
  const v = $('view'); v.replaceChildren();
  v.style.animation = 'none'; void v.offsetWidth; v.style.animation = '';
  ({ screens: renderScreens, shows: renderShows, media: renderMedia, templates: renderTemplates })[view](v);
  renderPubbar();
}

// ---------- Bildschirme ----------
function stateOf(sc: Screen) {
  const lv = isLive(sc.id), on = lv || sc.sim === 'online', sh = showById(sc.show), per = sh ? periodOf(sh.pub || sh.cfg) : 'off';
  let label = on ? 'Online' : 'Offline seit ' + since(sc.lastSeen), over = '', dot = on ? 'on' : 'off';
  if (!on) over = 'Keine Verbindung. Die Box zeigt weiter den letzten Stand.';
  else if (!sc.power) { over = 'Bildschirm ausgeschaltet'; label = 'Online · Bildschirm aus'; dot = 'dark'; }
  else if (per === 'off' || per === 'rest') { over = PERIOD[per] + ' laut Zeitplan'; label = 'Online · ' + PERIOD[per]; }
  if (lv) dot += ' live';
  return { on, lv, label, over, dot, black: on && !!over };
}
function screenTv(sc: Screen, extra?: Partial<Pv>) {
  const cfg = () => { const x = showById(sc.show); return x ? x.pub || x.cfg : null; };
  const t = tv(sc.orient, { cfg, period: () => { const c = cfg(); return c ? periodOf(c) : 'off'; }, black: () => stateOf(sc).black, notice: () => { const n = isOn(sc) && noticeFor(sc.id); return n ? n.text : ''; }, ...extra });
  const over = h('div', { class: 'over', hidden: true }); t.frame.append(over);
  const upd = () => { const s = stateOf(sc); over.hidden = !s.over; over.textContent = s.over; };
  upd(); return { ...t, upd };
}
function renderScreens(v: HTMLElement) {
  const on = S.screens.filter(isOn).length, n = S.screens.length;
  const sum = h('p');
  const sumUpd = () => { const o = S.screens.filter(isOn).length; sum.textContent = !n ? 'Noch kein Bildschirm gekoppelt.' : o === n ? (n === 1 ? 'Dein Bildschirm läuft.' : 'Alle ' + n + ' Bildschirme laufen.') : o + ' von ' + n + ' Bildschirmen laufen, ' + (n - o) + (n - o === 1 ? ' ist' : ' sind') + ' offline.'; };
  sumUpd(); ticks.push(sumUpd);
  v.append(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Bildschirme'), sum),
    h('button', { class: 'btn primary', onclick: openPair }, icon('plus'), 'Bildschirm koppeln')));
  // Was Aufmerksamkeit braucht, steht oben. Ohne Probleme bleibt der Bereich leer.
  const attn = h('div', { class: 'attn' });
  S.screens.filter(s => !isOn(s)).forEach(sc => {
    const sh = showById(sc.show), t = h('span', { class: 'small' });
    const upd = () => { t.textContent = 'Seit ' + since(sc.lastSeen) + '. Die Box zeigt weiter den letzten Stand' + (sh && sc.revision < sh.revision ? ' und holt Stand ' + sh.revision + ', sobald sie wieder da ist.' : '.'); };
    upd(); ticks.push(upd);
    attn.append(h('div', { class: 'attn-item bad' }, icon('alert'), h('div', null, h('b', null, '„' + sc.name + '“ bei ' + sc.place + ' ist offline'), t), h('button', { class: 'btn sm', onclick: () => openScreen(sc.id) }, 'Ansehen')));
  });
  S.shows.filter(sh => isDirty(sh) && S.screens.some(s => s.show === sh.id)).forEach(sh => attn.append(h('div', { class: 'attn-item' }, icon('clock'),
    h('div', null, h('b', null, '„' + sh.name + '“ hat unveröffentlichte Änderungen'), h('span', { class: 'small' }, changesOf(sh).join(', ') + '. Die Bildschirme zeigen noch Stand ' + sh.revision + '.')),
    h('button', { class: 'btn sm', onclick: () => go('shows', sh.id) }, 'Öffnen'))));
  if (attn.children.length) v.append(attn);
  if (!n) { v.append(h('div', { class: 'empty' }, h('b', null, 'Box an den Fernseher stecken, Code eingeben, fertig.'), h('button', { class: 'btn primary', onclick: openPair }, icon('plus'), 'Ersten Bildschirm koppeln'))); return; }
  const places = [...new Set(S.screens.map(s => s.place))];
  if (placeFilter && !places.includes(placeFilter)) placeFilter = '';
  if (places.length > 1) v.append(h('div', { class: 'filter' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Standort' },
    [['', 'Alle Standorte'], ...places.map(p => [p, p])].map(([k, l]) => h('button', { 'aria-pressed': String(placeFilter === k), onclick: () => { placeFilter = k; render(); } }, l)))));
  const grid = h('div', { class: 'screens' });
  S.screens.filter(sc => !placeFilter || sc.place === placeFilter).sort((a, b2) => places.indexOf(a.place) - places.indexOf(b2.place)).forEach(sc => {
    const s = stateOf(sc), t = screenTv(sc), dot = h('span', { class: 'dot ' + s.dot }), lab = h('span', { class: 'small' }), tag = h('div', { class: 'tag' });
    const sel = h('select', { id: 'sel-' + sc.id, onchange: () => { sc.show = sel.value; const sh = showById(sc.show); logTo(sc, 'Slideshow gewechselt: ' + sh.name); deliver(sc); save(); render(); toast(isOn(sc) ? '„' + sc.name + '“ zeigt jetzt „' + sh.name + '“.' : 'Gespeichert. „' + sc.name + '“ holt es sich, sobald die Box wieder online ist.'); } },
      S.shows.map(x => h('option', { value: x.id, selected: x.id === sc.show }, x.name)));
    const upd = () => {
      const st = stateOf(sc), b = st.lv && live.get(sc.id).beat; dot.className = 'dot ' + st.dot; t.upd();
      lab.textContent = sc.place + ' · ' + st.label + (b && b.of ? ' · Folie ' + b.slide + ' von ' + b.of : '');
      fill(tag, st.lv ? h('span', { class: 'badge live' }, 'LIVE') : null, noticeFor(sc.id) && st.on ? h('span', { class: 'badge' }, 'Hinweis') : null);
    };
    upd(); ticks.push(upd);
    grid.append(h('article', { class: 'card scr' },
      h('button', { class: 'stage', 'aria-label': 'Fernwartung für ' + sc.name, onclick: () => openScreen(sc.id) }, t.frame, tag),
      h('div', { class: 'body' },
        h('div', null, h('div', { class: 'title' }, dot, h('h2', null, sc.name)), lab),
        h('div', { class: 'shows' }, h('label', { for: 'sel-' + sc.id }, 'Zeigt'), sel),
        h('div', { class: 'foot' }, h('button', { class: 'btn sm', onclick: () => openScreen(sc.id) }, 'Fernwartung'),
          h('button', { class: 'btn sm', title: 'Startet einen echten Player in einem neuen Tab, verbunden mit diesem Bildschirm', onclick: () => openLive(sc) }, s.lv ? 'Player-Tab zeigen' : 'Live öffnen', icon('ext'))))));
  });
  grid.append(h('button', { class: 'addcard', onclick: openPair }, icon('plus'), 'Bildschirm koppeln'));
  v.append(grid);
}
function openLive(sc: Screen) {
  const w = window.open(PLAYER_URL + '?live=' + encodeURIComponent(sc.id), 'showcube-' + sc.id);
  toast(w ? 'Player startet in einem neuen Tab und meldet sich gleich hier.' : 'Der Browser hat das neue Fenster blockiert.');
}

// ---------- Fernwartung (Seitenblatt) ----------
let openId: string = null, lastShot: { url: string; note: string } = null, dticks: (() => void)[] = [];
function openScreen(id: string) { openId = id; lastShot = null; drawScreenDlg(); const d = $('dlgScreen'); if (!d.open) d.showModal(); }
$('dlgScreen').addEventListener('close', () => { openId = null; dticks = []; });
$('dlgScreen').addEventListener('click', (e: MouseEvent) => { if (e.target === $('dlgScreen')) $('dlgScreen').close(); });
function drawScreenDlg() {
  const sc = S.screens.find(s => s.id === openId), b = $('dsBody'); dticks = [];
  if (!sc) { $('dlgScreen').close(); return; }
  const s = stateOf(sc), sh = showById(sc.show), redraw = () => { save(); render(); drawScreenDlg(); };
  const dot = h('span', { class: 'dot ' + s.dot }), lab = h('span', { class: 'small' }), t = screenTv(sc);
  const kv = h('dl', { class: 'kv' });
  const upd = () => {
    const st = stateOf(sc), beat = st.lv && live.get(sc.id).beat; dot.className = 'dot ' + st.dot; lab.textContent = sc.place + ' · ' + st.label; t.upd();
    const rows: [string, string][] = [
      ['Zuletzt gemeldet', st.on ? 'gerade eben' : 'vor ' + since(sc.lastSeen) + ' (' + clock(sc.lastSeen) + ' Uhr)'],
      ['Inhalte', sh ? 'Stand ' + sc.revision + (sc.revision < sh.revision ? ', Stand ' + sh.revision + ' wartet' : ', aktuell') : '–'],
      ['Gerade', beat ? PERIOD[beat.period] + (beat.of ? ', Folie ' + beat.slide + ' von ' + beat.of : '') : sh ? PERIOD[periodOf(sh.pub || sh.cfg)] : '–'],
      ['Auflösung', beat ? beat.w + ' × ' + beat.h : sc.orient === 'port' ? '1080 × 1920' : '1920 × 1080'],
      ['Läuft seit', dur(beat ? beat.uptime : Math.round((Date.now() - sc.booted) / 1000))],
      ['Box', 'ShowCube ' + sc.version + ' · ' + sc.temp + ' °C · Speicher ' + sc.disk + ' %'], ['Netz', sc.net]];
    fill(kv, ...rows.flatMap(([k, val]) => [h('dt', null, k), h('dd', null, val)]));
  };
  upd(); dticks.push(upd);
  const act = (ic: string, label: string, fn: () => void, pressed?: boolean) => h('button', { class: 'act', 'aria-pressed': pressed ? 'true' : null, onclick: fn }, icon(ic), label);
  const setShot = (url: string, note: string) => { lastShot = { url, note }; drawScreenDlg(); };
  fill(b, 
    h('div', { class: 'dlg-h' }, dot, h('h2', { id: 'dsTitle' }, sc.name), h('button', { class: 'btn icon ghost', 'aria-label': 'Schließen', onclick: () => $('dlgScreen').close() }, icon('x'))),
    lab,
    h('div', { class: 'stage round' }, t.frame),
    h('div', { class: 'acts4' },
      act('power', sc.power ? 'Bildschirm aus' : 'Bildschirm an', () => { sc.power = !sc.power; if (s.lv) send({ t: 'cmd', screen: sc.id, cmd: 'power', on: sc.power }); logTo(sc, sc.power ? 'Bildschirm eingeschaltet' : 'Bildschirm ausgeschaltet'); redraw(); }, !sc.power),
      act('restart', 'Neu starten', () => { logTo(sc, 'Neustart ausgelöst'); sc.booted = Date.now(); if (s.lv) send({ t: 'cmd', screen: sc.id, cmd: 'restart' }); toast(s.lv ? 'Der Player startet neu.' : s.on ? 'Box startet neu, in etwa 30 Sekunden ist sie wieder da.' : 'Box ist offline. Der Neustart wartet, bis sie wieder da ist.'); redraw(); }),
      act('ping', 'Finden', () => { if (s.lv) send({ t: 'cmd', screen: sc.id, cmd: 'identify', label: sc.name }); logTo(sc, 'Identifizieren'); toast(s.lv ? 'Im Player-Tab blinkt jetzt „' + sc.name + '“.' : 'Auf dem Fernseher würde jetzt groß „' + sc.name + '“ blinken.'); redraw(); }),
      act('camera', 'Foto', () => {
        if (s.lv) { shotWait.set(sc.id, url => setShot(url, 'Echtes Bild vom Player, ' + clock(Date.now()) + ' Uhr.')); send({ t: 'cmd', screen: sc.id, cmd: 'shot' }); setShot('', 'Wird angefordert …'); }
        else if (!s.on) setShot('', 'Box ist offline, ein Foto ist gerade nicht möglich.');
        else { const c = sh.pub || sh.cfg, port = sc.orient === 'port', n = noticeFor(sc.id); setShot(stillOf(s.black ? { ...c, tpl: null, media: [] } : c, port ? 360 : 640, port ? 640 : 360, periodOf(c), 0, s.black || !n ? '' : n.text).toDataURL('image/jpeg', .85), 'Simuliert: so sieht das Bild der Box gerade aus.'); }
      })),
    lastShot ? [lastShot.url ? h('img', { class: 'shot', src: lastShot.url, alt: 'Bildschirmfoto von ' + sc.name, style: sc.orient === 'port' ? 'width:auto;max-height:340px;margin:0 auto' : null }) : null, h('span', { class: 'small' }, lastShot.note)] : null,
    h('div', { class: 'fld' }, h('h3', null, 'Einstellungen'),
      h('div', { class: 'grid2' },
        h('div', null, h('label', { for: 'dsName' }, 'Name'), h('input', { type: 'text', id: 'dsName', value: sc.name, onchange: (e: any) => { sc.name = e.target.value.trim() || sc.name; redraw(); } })),
        h('div', null, h('label', { for: 'dsPlace' }, 'Standort'), h('input', { type: 'text', id: 'dsPlace', value: sc.place, list: 'places', onchange: (e: any) => { sc.place = e.target.value.trim() || sc.place; redraw(); } }))),
      h('datalist', { id: 'places' }, [...new Set(S.screens.map(x => x.place))].map(p => h('option', { value: p }))),
      h('div', { class: 'grid2' },
        h('div', null, h('label', { for: 'dsShow' }, 'Zeigt'), h('select', { id: 'dsShow', onchange: (e: any) => { sc.show = e.target.value; logTo(sc, 'Slideshow gewechselt: ' + showById(sc.show).name); deliver(sc); redraw(); } }, S.shows.map(x => h('option', { value: x.id, selected: x.id === sc.show }, x.name)))),
        h('div', null, h('label', { for: 'dsOrient' }, 'Ausrichtung'), h('select', { id: 'dsOrient', onchange: (e: any) => { sc.orient = e.target.value; redraw(); } }, h('option', { value: 'land', selected: sc.orient === 'land' }, 'quer'), h('option', { value: 'port', selected: sc.orient === 'port' }, 'hochkant'))))),
    h('div', { class: 'fld' }, h('h3', null, 'Zustand'), kv),
    s.lv ? h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => openLive(sc) }, 'Player-Tab zeigen', icon('ext')))
      : h('div', { class: 'sim' }, h('span', null, 'Demo-Box, Werte sind gespielt. Mit „Live öffnen“ wird daraus ein echter Player.'),
        h('button', { class: 'btn sm', onclick: () => { if (sc.sim === 'online') { sc.sim = 'offline'; sc.lastSeen = Date.now(); logTo(sc, 'Verbindung verloren'); } else { sc.sim = 'online'; logTo(sc, 'Wieder online'); if (sh && sc.revision < sh.revision) deliver(sc); } redraw(); } }, sc.sim === 'online' ? 'Ausfall testen' : 'Wieder online'),
        h('button', { class: 'btn sm', onclick: () => openLive(sc) }, 'Live öffnen')),
    h('div', { class: 'fld' }, h('h3', null, 'Protokoll'), h('ul', { class: 'log' }, sc.log.slice(0, 8).map(l => h('li', null, h('time', null, clock(l.t)), h('span', null, l.msg))))),
    h('div', null, h('button', { class: 'btn ghost danger sm', onclick: () => { $('dlgScreen').close(); undoable('„' + sc.name + '“ entfernt.', () => { S.screens = S.screens.filter(z => z.id !== sc.id); }); } }, icon('trash'), 'Bildschirm entfernen')));
}

// ---------- Bildschirm koppeln ----------
function openPair() {
  const err = h('span', { class: 'small', style: 'color:var(--bad)', role: 'alert' });
  fill($('pairForm'), 
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dpTitle' }, 'Bildschirm koppeln'), h('button', { class: 'btn icon ghost', value: 'cancel', 'aria-label': 'Schließen' }, icon('x'))),
    h('p', { class: 'small' }, 'Box an den Fernseher stecken und mit dem WLAN verbinden. Auf dem Fernseher erscheint ein sechsstelliger Code. Im Prototyp geht jeder Code.'),
    h('div', null, h('label', { for: 'pCode' }, 'Code vom Fernseher'), h('input', { class: 'code', type: 'text', id: 'pCode', inputmode: 'numeric', maxlength: '7', placeholder: '482 915', autocomplete: 'off' })),
    h('div', { class: 'grid2' },
      h('div', null, h('label', { for: 'pName' }, 'Name'), h('input', { type: 'text', id: 'pName', placeholder: 'z. B. Theke' })),
      h('div', null, h('label', { for: 'pPlace' }, 'Standort'), h('input', { type: 'text', id: 'pPlace', list: 'pPlaces', value: S.screens[0] ? S.screens[0].place : '', placeholder: 'z. B. Filiale Mitte' }))),
    h('datalist', { id: 'pPlaces' }, [...new Set(S.screens.map(x => x.place))].map(p => h('option', { value: p }))),
    h('div', { class: 'grid2' },
      h('div', null, h('label', { for: 'pShow' }, 'Zeigt'), h('select', { id: 'pShow' }, S.shows.map(x => h('option', { value: x.id }, x.name)))),
      h('div', null, h('label', { for: 'pOrient' }, 'Ausrichtung'), h('select', { id: 'pOrient' }, h('option', { value: 'land' }, 'quer'), h('option', { value: 'port' }, 'hochkant')))),
    err, h('button', { class: 'btn primary lg', value: 'ok' }, 'Koppeln'));
  $('pairForm').onsubmit = (e: SubmitEvent) => {
    if ((e.submitter as any)?.value !== 'ok') return;
    const code = $('pCode').value.replace(/\D/g, ''), name = $('pName').value.trim();
    if (code.length !== 6) { e.preventDefault(); err.textContent = 'Der Code hat sechs Ziffern.'; $('pCode').focus(); return; }
    if (!name) { e.preventDefault(); err.textContent = 'Bitte einen Namen eingeben.'; $('pName').focus(); return; }
    const id = (name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'box') + '-' + code.slice(-3);
    const sc: Screen = { id, name, place: $('pPlace').value.trim() || 'Neuer Standort', orient: $('pOrient').value, show: $('pShow').value, power: true, sim: 'online', lastSeen: Date.now(), revision: 0, version: '0.3.1', temp: 44, disk: 12, net: 'WLAN, gut', booted: Date.now(), log: [] };
    logTo(sc, 'Gekoppelt mit Code ' + code.slice(0, 3) + ' ' + code.slice(3)); S.screens.push(sc); deliver(sc); save(); go('screens');
    toast('„' + name + '“ ist gekoppelt und zeigt „' + showById(sc.show).name + '“.');
  };
  $('dlgPair').showModal(); $('pCode').focus();
}

// ---------- Sofort-Hinweis ----------
function pushNotice() { S.screens.forEach(sc => { if (isLive(sc.id)) send({ t: 'notice', screen: sc.id, notice: noticeFor(sc.id) }); }); }
function stopNotice() { if (!S.notice) return; const txt = S.notice.text; undoable('Hinweis „' + txt + '“ beendet.', () => { S.notice = null; }); pushNotice(); }
$('noticeStop').append(icon('x')); $('noticeStop').onclick = stopNotice;
function openNotice() {
  const active = S.notice && (!S.notice.until || Date.now() < S.notice.until) ? S.notice : null;
  let len = 'today';
  const text = h('input', { type: 'text', id: 'nText', maxlength: '48', placeholder: 'z. B. Heute ab 18 Uhr geschlossen', value: active ? active.text : '', autocomplete: 'off' });
  const picked = () => S.screens.filter(sc => $('nt-' + sc.id) && $('nt-' + sc.id).checked);
  const first = () => picked()[0] || S.screens[0];
  const t = tv('land', { cfg: () => { const sc = first(), sh = sc && showById(sc.show); return sh ? sh.pub || sh.cfg : baseCfg('gastro'); }, period: () => 'day', notice: () => text.value.trim() || 'Dein Hinweis' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Dauer' }, [['hour', '1 Stunde'], ['today', 'Heute'], ['open', 'Bis ich ihn beende']].map(([k, l]) => h('button', { type: 'button', 'aria-pressed': String(k === len), onclick: (e: any) => { len = k; [...seg.children].forEach((x: any) => x.setAttribute('aria-pressed', String(x === e.currentTarget))); } }, l)));
  fill($('noticeForm'), 
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dnTitle' }, 'Sofort-Hinweis'), h('button', { class: 'btn icon ghost', value: 'cancel', 'aria-label': 'Schließen' }, icon('x'))),
    h('p', { class: 'small' }, 'Ein Band über allen Folien, sofort auf den gewählten Bildschirmen. Die Slideshow läuft darunter weiter.'),
    h('div', { class: 'stage round', style: 'aspect-ratio:16/8' }, t.frame),
    h('div', { class: 'fld' }, h('label', { for: 'nText', style: 'margin:0' }, 'Text'), text,
      h('div', { class: 'sugg' }, ['Heute geschlossen', 'Gleich zurück', 'Heute Abend Live-Musik', 'Kartenzahlung gerade nicht möglich'].map(sg => h('button', { type: 'button', onclick: () => { text.value = sg; text.focus(); } }, sg)))),
    h('div', { class: 'fld' }, h('span', { class: 'label', style: 'margin:0' }, 'Wie lange'), h('div', null, seg)),
    h('div', { class: 'fld' }, h('span', { class: 'label', style: 'margin:0' }, 'Auf welchen Bildschirmen'),
      h('div', { class: 'targets' }, S.screens.map(sc => h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'nt-' + sc.id, checked: active ? active.screens.includes(sc.id) : true }), sc.name, h('span', { class: 'small' }, sc.place + (isOn(sc) ? '' : ' · offline, kommt später an')))))),
    h('div', { class: 'row' }, h('button', { class: 'btn primary lg', value: 'ok', style: 'flex:1' }, icon('bolt'), active ? 'Hinweis ändern' : 'Jetzt zeigen'),
      active ? h('button', { class: 'btn lg', type: 'button', onclick: () => { $('dlgNotice').close(); stopNotice(); } }, 'Beenden') : null));
  $('noticeForm').onsubmit = (e: SubmitEvent) => {
    if ((e.submitter as any)?.value !== 'ok') return;
    const txt = text.value.trim(), to = picked();
    if (!txt) { e.preventDefault(); text.focus(); return; }
    if (!to.length) { e.preventDefault(); toast('Mindestens einen Bildschirm wählen.'); return; }
    const end = new Date(); end.setHours(23, 59, 59, 0);
    S.notice = { text: txt, until: len === 'hour' ? Date.now() + 3600e3 : len === 'today' ? end.getTime() : 0, screens: to.map(s => s.id) };
    to.forEach(sc => logTo(sc, 'Hinweis: ' + txt)); save(); pushNotice(); render();
    toast('Hinweis läuft auf ' + plural(to.length, 'Bildschirm', 'Bildschirmen') + (len === 'hour' ? ' für eine Stunde.' : len === 'today' ? ' bis heute Nacht.' : '.'));
  };
  $('dlgNotice').showModal(); text.focus();
}
$('openNotice').prepend(icon('bolt')); $('openNotice').onclick = openNotice;

// ---------- Inhalte ----------
let pvPeriod = 'day', pvOrient: 'land' | 'port' = 'land', pvRef: Pv = null, ed: any = {};
const shown = () => showById(cur) || S.shows[0];
// Kurze Zusammenfassung, was sich gegenüber dem veröffentlichten Stand geändert hat.
function changesOf(sh: Show): string[] {
  const a = sh.cfg, b = sh.pub, out: string[] = []; if (!b) return ['Noch nie veröffentlicht'];
  const j = (x: any) => JSON.stringify(x), T = a.tpl && TEMPLATES[a.tpl];
  if (a.tpl !== b.tpl) out.push('Vorlage gewechselt');
  else if (j(a.rows) !== j(b.rows)) {
    const d = a.rows.length - b.rows.length, same = Math.min(a.rows.length, b.rows.length); let ch2 = 0, off = 0;
    for (let i = 0; i < same; i++) { if (j(a.rows[i].c) !== j(b.rows[i].c)) ch2++; else if (!!a.rows[i].off !== !!b.rows[i].off) off++; }
    const u = (n: number) => n === 1 ? (T ? T.unit : 'Eintrag') : (T ? T.units : 'Einträge');
    if (ch2) out.push(ch2 + ' ' + u(ch2) + ' geändert'); if (off) out.push(off + ' ' + u(off) + ' ein- oder ausgeblendet');
    if (d > 0) out.push(d + ' ' + u(d) + ' neu'); if (d < 0) out.push(-d + ' ' + u(-d) + ' entfernt');
  }
  if (a.name !== b.name || a.accent !== b.accent || a.logo !== b.logo) out.push('Name, Farbe oder Logo');
  if (j(a.media) !== j(b.media)) out.push('Medien');
  if (j([a.dayStart, a.eveStart, a.offOn, a.offFrom, a.offTo, a.offDays]) !== j([b.dayStart, b.eveStart, b.offOn, b.offFrom, b.offTo, b.offDays])) out.push('Zeitplan');
  if (a.dur !== b.dur || a.fit !== b.fit) out.push('Anzeige');
  return out;
}
let softT: any;
// Nach jeder Eingabe: speichern und nur die Teile neu zeichnen, die sich ändern. Das Formular bleibt stehen.
function changed() { save(); renderPub(); renderPubbar(); clearTimeout(softT); softT = setTimeout(() => { renderShowList(); renderFilm(); renderNav(); }, 250); }
function newShow(tpl: string | null, name: string): Show { return { id: uid('s'), name, revision: 0, published: null, cfg: baseCfg(tpl), pub: null, history: [] }; }
function renderShows(v: HTMLElement) {
  if (!S.shows.length) { go('templates'); return; }
  if (!showById(cur)) cur = S.shows[0].id;
  const sh = shown();
  ed = { list: h('div', { class: 'slist' }), pane: h('div', { class: 'pane', role: 'tabpanel' }), tabs: h('div', { class: 'tabs', role: 'tablist' }), film: h('div', { class: 'film' }), info: h('span', { class: 'small' }), pub: h('div', { class: 'pub' }) };
  const t = tv(pvOrient, { cfg: () => shown().cfg, period: () => pvPeriod, onSlide: (i, n, p) => { ed.info.textContent = n ? 'Folie ' + (i + 1) + ' von ' + n : 'Keine Folien für den ' + PERIOD[p] + '.'; [...ed.film.children].forEach((b: any, k) => b.setAttribute('aria-current', String(k === i))); } });
  pvRef = t.pv;
  const segBtn = (group: string, val: string, label: string, on: boolean, fn: () => void) => h('button', { 'aria-pressed': String(on), onclick: (e: any) => { [...e.currentTarget.parentNode.children].forEach((x: any) => x.setAttribute('aria-pressed', String(x === e.currentTarget))); fn(); } }, label);
  const jump = () => { pvRef.idx = 0; pvRef.prev = null; pvRef.next = 0; pvRef.key = ''; renderFilm(); };
  v.append(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Inhalte'), h('p', null, 'Texte und Preise ändern, Vorschau prüfen, veröffentlichen. Die Bildschirme ziehen in Sekunden nach.')),
    h('button', { class: 'btn', onclick: () => go('templates') }, icon('plus'), 'Neue Slideshow')),
  h('div', { class: 'shows-wrap' }, ed.list,
    h('div', { class: 'card ed' },
      h('div', { class: 'ed-head' },
        h('input', { class: 'ed-name', type: 'text', id: 'sName', value: sh.name, 'aria-label': 'Name der Slideshow', oninput: (e: any) => { shown().name = e.target.value; changed(); } }),
        h('button', { class: 'btn icon ghost sm', title: 'Duplizieren', 'aria-label': 'Slideshow duplizieren', onclick: () => { const c = newShow(null, sh.name + ' (Kopie)'); c.cfg = clone(sh.cfg); S.shows.push(c); save(); go('shows', c.id); toast('Kopie angelegt.'); } }, icon('copy')),
        h('button', { class: 'btn icon ghost sm', title: 'Löschen', 'aria-label': 'Slideshow löschen', onclick: () => {
          const used = S.screens.filter(s => s.show === sh.id);
          if (used.length) { toast('Läuft noch auf ' + used.map(s => '„' + s.name + '“').join(', ') + '. Dort erst eine andere Slideshow wählen.'); return; }
          undoable('„' + sh.name + '“ gelöscht.', () => { S.shows = S.shows.filter(x => x.id !== sh.id); cur = S.shows[0] ? S.shows[0].id : null; });
        } }, icon('trash'))),
      ed.tabs, ed.pane),
    h('div', { class: 'card pv' },
      h('div', { class: 'pv-top' }, h('h2', null, 'Vorschau'),
        h('div', { class: 'row' },
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Tageszeit' }, segBtn('p', 'day', 'Tag', pvPeriod === 'day', () => { pvPeriod = 'day'; jump(); }), segBtn('p', 'eve', 'Abend', pvPeriod === 'eve', () => { pvPeriod = 'eve'; jump(); })),
          h('div', { class: 'seg', role: 'group', 'aria-label': 'Ausrichtung' }, segBtn('o', 'land', 'Quer', pvOrient === 'land', () => { pvOrient = 'land'; t.frame.className = 'tvf land'; renderFilm(); }), segBtn('o', 'port', 'Hoch', pvOrient === 'port', () => { pvOrient = 'port'; t.frame.className = 'tvf port'; renderFilm(); })))),
      h('div', { class: 'stage round' }, t.frame), ed.film, ed.info, ed.pub)));
  renderShowList(); renderTabs(); renderPane(); renderFilm(); renderPub();
}
function renderShowList() {
  if (!ed.list || !ed.list.isConnected) return;
  fill(ed.list, ...S.shows.map(sh => {
    const n = S.screens.filter(s => s.show === sh.id).length;
    return h('button', { class: 'sitem', 'aria-current': String(sh.id === shown().id), onclick: () => go('shows', sh.id) }, stillOf(sh.cfg, 120, 68),
      h('div', null, h('b', null, sh.name || 'Ohne Namen'), h('span', { class: 'small' }, isDirty(sh) ? h('span', { class: 'draft', title: 'Unveröffentlichte Änderungen' }) : null, n ? plural(n, 'Bildschirm', 'Bildschirme') : 'nicht zugewiesen')));
  }));
}
function renderTabs() {
  const c = shown().cfg, T = c.tpl && TEMPLATES[c.tpl];
  const defs = [['content', 'Inhalt', T ? c.rows.filter(r => !r.off).length : 0], ['media', 'Medien', c.media.length], ['plan', 'Zeitplan', 0], ['history', 'Verlauf', shown().history.length]];
  fill(ed.tabs, ...defs.map(([k, l, n]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k as string; renderTabs(); renderPane(); } }, l, n ? h('span', { class: 'n' }, String(n)) : null)));
}
function renderFilm() {
  if (!ed.film || !ed.film.isConnected) return;
  const c = shown().cfg, list = slidesOf(c, pvPeriod), port = pvOrient === 'port';
  fill(ed.film, ...list.map((_, i) => h('button', { 'aria-label': 'Folie ' + (i + 1) + ' zeigen', 'aria-current': String(pvRef && pvRef.idx === i), onclick: () => { pvRef.prev = null; pvRef.idx = i; pvRef.next = performance.now() + c.dur * 1000; pvRef.key = ''; } }, stillOf(c, port ? 45 : 142, 80, pvPeriod, i))));
  if (pvRef) pvRef.key = '';
}
function publish(sh: Show) {
  sh.revision++; sh.published = Date.now(); sh.pub = clone(sh.cfg); sh.history.unshift({ revision: sh.revision, at: sh.published, cfg: clone(sh.cfg) }); sh.history = sh.history.slice(0, 8);
  const to = S.screens.filter(s => s.show === sh.id); to.forEach(deliver); save(); render();
  const off = to.filter(s => !isOn(s)).length;
  toast(!to.length ? 'Stand ' + sh.revision + ' veröffentlicht. Noch keinem Bildschirm zugewiesen.' : off ? 'Veröffentlicht. ' + (to.length - off) + ' von ' + to.length + ' Bildschirmen zeigen es schon, der Rest holt es nach.' : 'Veröffentlicht. ' + (to.length === 1 ? 'Der Bildschirm zeigt' : to.length === 2 ? 'Beide Bildschirme zeigen' : 'Alle ' + to.length + ' Bildschirme zeigen') + ' jetzt Stand ' + sh.revision + '.');
}
function renderPub() {
  if (!ed.pub || !ed.pub.isConnected) return;
  const sh = shown(), dirty = isDirty(sh), to = S.screens.filter(s => s.show === sh.id), c = sh.cfg;
  const konf = c.tpl ? KONFIG_URL + '#' + new URLSearchParams({ tpl: c.tpl, name: c.name, items: itemsOf(c), accent: c.accent }) : null;
  fill(ed.pub, 
    h('div', { class: 'row' }, dirty ? h('span', { class: 'badge warn' }, sh.pub ? 'Entwurf' : 'Neu') : h('span', { class: 'badge ok' }, icon('check'), 'Veröffentlicht'),
      h('span', { class: 'small' }, sh.published ? 'Stand ' + sh.revision + ' · ' + dateTime(sh.published) : 'noch nicht auf einem Bildschirm')),
    dirty && sh.pub ? h('div', { class: 'changes' }, changesOf(sh).join(' · ')) : null,
    h('button', { class: 'btn primary lg', disabled: !dirty, title: 'Strg + Enter', onclick: () => publish(sh) }, !dirty ? 'Alles veröffentlicht' : to.length ? 'Auf ' + plural(to.length, 'Bildschirm', 'Bildschirme') + ' veröffentlichen' : 'Veröffentlichen'),
    h('span', { class: 'small' }, to.length ? 'Läuft auf: ' + to.map(s => s.name + (isOn(s) ? '' : ' (offline)')).join(', ') + '.' : 'Noch keinem Bildschirm zugewiesen. Das geht unter „Bildschirme“.'),
    h('div', { class: 'more' },
      dirty && sh.pub ? h('button', { class: 'btn ghost sm', onclick: () => undoable('Änderungen verworfen.', () => { sh.cfg = clone(sh.pub); }) }, 'Änderungen verwerfen') : null,
      h('button', { class: 'btn ghost sm', title: 'Dasselbe Paket als Datei für die Offline-Box', onclick: exportUsb }, icon('download'), 'Für USB-Stick'),
      konf ? h('a', { class: 'btn ghost sm', href: konf, target: '_blank', rel: 'noopener', title: 'Zeigt die Slideshow in einem Foto vom Schaufenster' }, icon('shop'), 'Im Schaufenster') : null));
}
function renderPubbar() {
  const sh = view === 'shows' && S.shows.length ? shown() : null, on = !!sh && isDirty(sh);
  $('pubbar').hidden = !on; document.body.classList.toggle('has-pubbar', on);
  if (on) { $('pubbarText').textContent = sh.pub ? changesOf(sh).join(' · ') : 'Noch nicht veröffentlicht'; $('pubbarBtn').onclick = () => publish(sh); }
}
async function exportUsb() {
  const sh = shown(), blob = await paketToFile(paketFor(sh, sh.cfg)), a = h('a', { href: URL.createObjectURL(blob), download: 'showcube-paket.json' });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Paket gespeichert. Auf den USB-Stick kopieren und im Player unter „Paket laden“ einlesen.');
}
function renderPane() {
  const sh = shown(), c = sh.cfg, p = ed.pane, T = c.tpl && TEMPLATES[c.tpl];
  const repaint = (focus?: string) => { changed(); renderTabs(); renderPane(); if (focus) { const f = p.querySelector(focus) as HTMLElement; if (f) f.focus(); } };
  if (tab === 'content') {
    const tplSel = h('select', { id: 'sTpl', onchange: (e: any) => {
      const k = e.target.value || null, N = k && TEMPLATES[k];
      undoable(N ? 'Vorlage „' + N.label + '“ gewählt.' : 'Vorlage entfernt.', () => { c.tpl = k; if (N) { c.name = c.name || N.name; c.rows = rowsOf(N.items); c.accent = N.accent; } });
    } }, h('option', { value: '' }, 'Keine Vorlage, nur eigene Medien'), Object.entries(TEMPLATES).map(([k, x]: any) => h('option', { value: k, selected: k === c.tpl }, x.label)));
    const tplFld = h('div', { class: 'fld' }, h('label', { for: 'sTpl', style: 'margin:0' }, 'Vorlage'), tplSel);
    if (!T) { fill(p, tplFld, h('div', { class: 'empty' }, 'Diese Slideshow zeigt nur eigene Bilder und Videos.', h('button', { class: 'btn', onclick: () => { tab = 'media'; renderTabs(); renderPane(); } }, 'Zu den Medien'))); return; }
    const logoUrl = c.logo && urlOf(c.logo);
    const design = [h('div', { class: 'brandrow' },
      h('div', null, h('label', { for: 'sBrand' }, 'Name des Betriebs'), h('input', { type: 'text', id: 'sBrand', value: c.name, oninput: (e: any) => { c.name = e.target.value; changed(); } })),
      h('div', null, h('span', { class: 'label' }, 'Farbe'), h('div', { class: 'swatches' }, SWATCHES.map(col => h('button', { style: 'background:' + col, 'aria-label': 'Farbe ' + col, 'aria-pressed': String(col === c.accent), onclick: () => { c.accent = col; repaint(); } }))))),
    h('div', { class: 'logo' },
      logoUrl ? h('img', { src: logoUrl, alt: 'Logo' }) : null,
      h('span', { class: 'btn sm file' }, icon('upload'), logoUrl ? 'Logo ersetzen' : 'Logo hochladen', h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Logo hochladen', onchange: (e: any) => { const f = e.target.files[0]; if (!f) return; const id = uid('logo'); putBlob(id, f); c.logo = id; const im = imgOf(id); im.onload = () => renderFilm(); repaint(); } })),
      logoUrl ? h('button', { class: 'btn ghost sm', onclick: () => { c.logo = null; repaint(); } }, 'Entfernen') : h('span', { class: 'small' }, 'Erscheint oben rechts auf den Folien.'))];
    // Preistabelle: eine Zeile pro Eintrag. Auge = heute ausblenden, ohne den Eintrag zu löschen.
    const cols = T.cols as any[], gc = cols.map(x => `minmax(0, ${x.grow}fr)`).join(' '), gm = cols.length > 2 ? 'minmax(0,1fr) minmax(0,1fr)' : cols.length === 2 && /Preis/.test(cols[1].label) ? 'minmax(0,1fr) 108px' : gc;
    const rows = h('div', { class: 'rows', style: `--cols:${gc};--cols-m:${gm}` }, h('div', { class: 'rows-h' }, h('span'), h('div', { class: 'cells' }, cols.map(x => h('span', null, x.label))), h('span')));
    let vis = 0; const move = (i: number, d: number, j: number) => { const k = i + d; if (k < 0 || k >= c.rows.length) return; c.rows.splice(k, 0, c.rows.splice(i, 1)[0]); repaint(`[data-cell="${k}-${j}"]`); };
    c.rows.forEach((r, i) => {
      const over = !r.off && ++vis > T.max, lbl = r.c[0] || 'Zeile ' + (i + 1);
      rows.append(h('div', { class: 'rw' + (r.off ? ' is-off' : '') + (over ? ' over' : '') }, h('span', { class: 'num' }, r.off ? '–' : String(vis)),
        h('div', { class: 'cells' }, cols.map((col, j) => {
          const common = { 'data-cell': i + '-' + j, 'aria-label': col.label + ', Zeile ' + (i + 1), onkeydown: (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(i, e.key === 'ArrowUp' ? -1 : 1, j); }
            else if (e.key === 'Enter' && !col.options) { e.preventDefault(); if (i === c.rows.length - 1) { c.rows.push({ c: cols.map(() => '') }); repaint(`[data-cell="${i + 1}-0"]`); } else (p.querySelector(`[data-cell="${i + 1}-${j}"]`) as HTMLElement).focus(); }
          } };
          return col.options ? h('select', { ...common, onchange: (e: any) => { r.c[j] = e.target.value; changed(); } }, col.options.map((o: string) => h('option', { selected: (r.c[j] || '').toUpperCase() === o }, o)))
            : h('input', { ...common, type: 'text', value: r.c[j] || '', placeholder: col.label, inputmode: /Preis/.test(col.label) ? 'decimal' : null, oninput: (e: any) => { r.c[j] = e.target.value; changed(); } });
        })),
        h('div', { class: 'acts' },
          h('button', { class: 'ib', title: 'Nach oben (Alt + ↑)', 'aria-label': 'Nach oben: ' + lbl, disabled: i === 0, onclick: () => move(i, -1, 0) }, icon('up')),
          h('button', { class: 'ib', title: 'Nach unten (Alt + ↓)', 'aria-label': 'Nach unten: ' + lbl, disabled: i === c.rows.length - 1, onclick: () => move(i, 1, 0) }, icon('down')),
          h('button', { class: 'ib', title: r.off ? 'Wieder zeigen' : 'Ausblenden, z. B. wenn es heute aus ist', 'aria-label': (r.off ? 'Wieder zeigen: ' : 'Ausblenden: ') + lbl, 'aria-pressed': String(!!r.off), onclick: () => { r.off = !r.off; repaint(); } }, icon(r.off ? 'eyeoff' : 'eye')),
          h('button', { class: 'ib', title: 'Löschen', 'aria-label': 'Löschen: ' + lbl, onclick: () => undoable('„' + lbl + '“ gelöscht.', () => { c.rows.splice(i, 1); }) }, icon('trash')))));
    });
    fill(p, h('div', { class: 'fld' }, h('h3', null, T.units), rows,
      h('div', { class: 'rows-foot' }, h('button', { class: 'btn sm', onclick: () => { c.rows.push({ c: cols.map(() => '') }); repaint(`[data-cell="${c.rows.length - 1}-0"]`); } }, icon('plus'), T.unit + ' hinzufügen'),
        h('span', { class: 'small' }, 'Enter springt in die nächste Zeile.')),
      vis > T.max ? h('div', { class: 'hint' }, icon('alert'), h('span', null, 'Damit alles lesbar bleibt, zeigt die Vorlage ' + T.max + ' ' + T.units + ' im Querformat. Die unteren ' + (vis - T.max) + ' sind gestrichelt markiert und erscheinen dort nicht. Mit dem Auge kannst du andere ausblenden.')) : null), h('h3', null, 'Gestaltung'), tplFld, design);
  } else if (tab === 'media') {
    const free = S.assets.filter(a => !c.media.some(m => m.id === a.id));
    fill(p, 
      c.media.length ? h('ul', { class: 'mlist' }, c.media.map((m, i) => {
        const a = assetById(m.id); if (!a) return null;
        return h('li', null, h(a.type === 'video' ? 'video' : 'img', { class: 'th', src: urlOf(a.id) || '', alt: '' }), h('span', { class: 'nm' }, a.name),
          h('span', { class: 'row', style: 'gap:2px' },
            h('select', { 'aria-label': 'Wann zeigen: ' + a.name, onchange: (e: any) => { m.when = e.target.value; changed(); } }, [['always', 'immer'], ['day', 'tagsüber'], ['eve', 'abends']].map(([val, tx]) => h('option', { value: val, selected: m.when === val }, tx))),
            h('button', { class: 'ib', 'aria-label': 'Nach oben: ' + a.name, disabled: i === 0, onclick: () => { c.media.splice(i - 1, 0, c.media.splice(i, 1)[0]); repaint(); } }, icon('up')),
            h('button', { class: 'ib', 'aria-label': 'Aus der Slideshow nehmen: ' + a.name, onclick: () => { c.media.splice(i, 1); repaint(); } }, icon('x'))));
      })) : h('div', { class: 'empty' }, 'Eigene Fotos und Videos laufen nach den Vorlagen-Folien.'),
      h('div', { class: 'row' },
        h('span', { class: 'btn file primary' }, icon('upload'), 'Hochladen', h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm', multiple: true, 'aria-label': 'Bilder oder Videos hochladen', onchange: (e: any) => { const ids = addFiles(e.target.files, true); ids.forEach(id => c.media.push({ id, when: 'always' })); repaint(); } })),
        free.length ? h('select', { style: 'flex:1;min-width:180px', 'aria-label': 'Aus der Bibliothek hinzufügen', onchange: (e: any) => { if (e.target.value) { c.media.push({ id: e.target.value, when: 'always' }); repaint(); } } }, h('option', { value: '' }, 'Aus der Bibliothek hinzufügen …'), free.map(a => h('option', { value: a.id }, (a.type === 'video' ? 'Video: ' : '') + a.name))) : null),
      h('span', { class: 'small' }, 'Bilder bleiben so lange stehen wie unter „Zeitplan“ eingestellt, Videos laufen bis zum Ende.'));
  } else if (tab === 'plan') {
    // Zeitleiste: 24 Stunden in Viertelstunden, gleiche Abschnitte zusammengefasst.
    const segs: { p: string; n: number }[] = [];
    for (let q = 0; q < 96; q++) { const pr = periodAt(c, q * 15); if (segs.length && segs[segs.length - 1].p === pr) segs[segs.length - 1].n++; else segs.push({ p: pr, n: 1 }); }
    const now = new Date(), pct = (now.getHours() * 60 + now.getMinutes()) / 14.4, DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const time = (id: string, label: string, k: string, dis = false) => h('div', null, h('label', { for: id }, label), h('input', { type: 'time', id, value: c[k], disabled: dis, onchange: (e: any) => { c[k] = e.target.value || c[k]; repaint('#' + id); } }));
    fill(p, 
      h('div', { class: 'tl' }, h('div', { class: 'tl-bar', role: 'img', 'aria-label': 'Tagesablauf: ' + segs.map(s => PERIOD[s.p] + ' ' + s.n / 4 + ' Stunden').join(', ') }, segs.map(s => h('div', { class: s.p, style: 'flex:' + s.n }, s.n >= 10 ? ({ day: 'Tag', eve: 'Abend', off: 'Aus' })[s.p] : ''))),
        h('div', { class: 'tl-now' + (pct > 85 ? ' right' : ''), style: 'left:' + pct + '%' }), h('div', { class: 'tl-ticks' }, ['0', '6', '12', '18', '24'].map(x => h('span', null, x + ' Uhr')))),
      h('div', { class: 'grid2' }, time('sDay', 'Tag-Folien ab', 'dayStart'), time('sEve', 'Abend-Folien ab', 'eveStart')),
      h('div', { class: 'fld' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: c.offOn, onchange: (e: any) => { c.offOn = e.target.checked; repaint(); } }), 'Nachts schwarz schalten'),
        h('div', { class: 'grid2' }, time('sOffFrom', 'Aus ab', 'offFrom', !c.offOn), time('sOffTo', 'Wieder an ab', 'offTo', !c.offOn))),
      h('div', { class: 'fld' }, h('span', { class: 'label', style: 'margin:0' }, 'Ruhetage'), h('div', { class: 'days' }, [1, 2, 3, 4, 5, 6, 0].map(d => h('button', { 'aria-pressed': String(c.offDays.includes(d)), 'aria-label': DAYS[d] + ' ist Ruhetag', onclick: () => { c.offDays = c.offDays.includes(d) ? c.offDays.filter(x => x !== d) : [...c.offDays, d].sort(); repaint(); } }, DAYS[d]))),
        h('span', { class: 'small' }, c.offDays.length ? 'An Ruhetagen bleibt der Bildschirm den ganzen Tag schwarz.' : 'Kein Ruhetag: der Bildschirm läuft jeden Tag.')),
      h('div', { class: 'grid2' },
        h('div', null, h('label', { for: 'sDur' }, 'Sekunden pro Folie'), h('input', { type: 'number', id: 'sDur', min: '3', max: '120', value: String(c.dur), onchange: (e: any) => { c.dur = Math.min(120, Math.max(3, +e.target.value || 8)); e.target.value = c.dur; changed(); } })),
        h('div', null, h('label', { for: 'sFit' }, 'Eigene Bilder'), h('select', { id: 'sFit', onchange: (e: any) => { c.fit = e.target.value; changed(); } }, h('option', { value: 'cover', selected: c.fit === 'cover' }, 'füllen den Bildschirm'), h('option', { value: 'contain', selected: c.fit === 'contain' }, 'ganz zeigen, mit Rand')))));
  } else {
    fill(p, sh.history.length ? h('ul', { class: 'hist' }, sh.history.map((ver, i) => {
      const same = JSON.stringify(ver.cfg) === JSON.stringify(c);
      return h('li', null, stillOf(ver.cfg, 96, 54), h('div', null, h('b', null, 'Stand ' + ver.revision + (i === 0 ? ' · auf den Bildschirmen' : '')), h('span', { class: 'small' }, dateTime(ver.at) + ' · ' + plural(ver.cfg.rows.filter(r => !r.off).length, 'Eintrag', 'Einträge'))),
        same ? h('span', { class: 'badge' }, 'wie im Editor') : h('button', { class: 'btn sm', onclick: () => undoable('Stand ' + ver.revision + ' in den Editor geholt. Noch nicht veröffentlicht.', () => { sh.cfg = clone(ver.cfg); tab = 'content'; }) }, icon('history'), 'Zurückholen'));
    })) : h('div', { class: 'empty' }, 'Noch nichts veröffentlicht. Jede Veröffentlichung landet hier und lässt sich mit einem Klick zurückholen.'),
      sh.history.length ? h('span', { class: 'small' }, 'Die letzten acht Stände bleiben gespeichert.') : null);
    (p.querySelectorAll('.hist canvas') as any).forEach((cv: HTMLCanvasElement) => { cv.style.cssText = 'width:72px;height:40px;border-radius:5px;flex:none'; });
  }
}

// ---------- Medien ----------
function addFiles(files: FileList | File[], quiet = false): string[] {
  const ids: string[] = [];
  [...files].forEach(f => { const type = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : null; if (!type) return; const id = uid('m'); putBlob(id, f); S.assets.unshift({ id, type, name: f.name, size: f.size, added: Date.now() }); ids.push(id); });
  save(); if (!quiet) { render(); toast(ids.length ? plural(ids.length, 'Datei', 'Dateien') + ' hochgeladen.' : 'Nur Bilder und Videos (MP4, WebM).'); }
  return ids;
}
let dragN = 0;
addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { dragN++; document.body.classList.add('dragging'); if (view !== 'media' && !document.querySelector('dialog[open]')) go('media'); } });
addEventListener('dragleave', () => { if (--dragN <= 0) { dragN = 0; document.body.classList.remove('dragging'); } });
addEventListener('dragover', e => e.preventDefault());
addEventListener('drop', e => { e.preventDefault(); dragN = 0; document.body.classList.remove('dragging'); if (e.dataTransfer && e.dataTransfer.files.length) { if (view !== 'media') go('media'); addFiles(e.dataTransfer.files); } });
function renderMedia(v: HTMLElement) {
  v.append(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Medien'), h('p', null, 'Deine Fotos und Videos. Einmal hochladen, in beliebig vielen Slideshows verwenden.'))),
    h('div', { class: 'drop' }, h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm', multiple: true, 'aria-label': 'Bilder oder Videos hochladen', onchange: (e: any) => { addFiles(e.target.files); } }), icon('upload'), h('b', null, 'Dateien hierher ziehen oder klicken'), h('span', { class: 'small' }, 'JPG, PNG, MP4 oder WebM. Ziehen geht von überall im Panel.')));
  if (!S.assets.length) return;
  v.append(h('div', { class: 'assets' }, S.assets.map(a => {
    const used = S.shows.filter(s => s.cfg.media.some(m => m.id === a.id));
    const th = h(a.type === 'video' ? 'video' : 'img', { class: 'th', src: urlOf(a.id) || '', alt: a.type === 'video' ? null : a.name, loading: a.type === 'video' ? null : 'lazy' });
    if (a.type === 'video') { th.muted = true; th.loop = true; th.onmouseenter = () => th.play().catch(() => {}); th.onmouseleave = () => th.pause(); }
    return h('div', { class: 'card asset' }, th, h('div', { class: 'body' }, h('span', { class: 'nm', title: a.name }, a.name), h('span', { class: 'small' }, (a.type === 'video' ? 'Video · ' : 'Bild · ') + kb(a.size)),
      h('div', { class: 'foot' }, used.length ? h('span', { class: 'badge ok', title: used.map(s => s.name).join(', ') }, 'in ' + plural(used.length, 'Slideshow', 'Slideshows')) : h('span', { class: 'badge' }, 'unbenutzt'),
        h('button', { class: 'ib', 'aria-label': 'Löschen: ' + a.name, title: 'Löschen', onclick: () => undoable('„' + a.name + '“ gelöscht' + (used.length ? ' und aus ' + plural(used.length, 'Slideshow', 'Slideshows') + ' entfernt.' : '.'), () => { S.shows.forEach(s => { s.cfg.media = s.cfg.media.filter(m => m.id !== a.id); }); S.assets = S.assets.filter(z => z.id !== a.id); }) }, icon('trash')))));
  })));
}

// ---------- Vorlagen ----------
const TPL_TEXT = {
  gastro: 'Menütafel mit Preisen, dazu ein Angebot. Mittags und abends eine eigene Karte.',
  makler: 'Bis zu vier Objekte mit Fläche, Preis und Energieklasse. Abends ein QR-Code zum Exposé.',
  laden: 'Große Angebote und Aktionen. Nach Ladenschluss ein Hinweis auf die Öffnungszeiten.',
};
function renderTemplates(v: HTMLElement) {
  const use = (k: string | null, name: string) => { const sh = newShow(k, name); S.shows.push(sh); save(); tab = k ? 'content' : 'media'; go('shows', sh.id); toast('Neue Slideshow angelegt. Texte anpassen, dann veröffentlichen.'); setTimeout(() => { const n = $('sName'); if (n) { n.focus(); n.select(); } }, 60); };
  v.append(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Vorlagen'), h('p', null, 'Such dir einen Start aus. Du trägst nur Texte und Preise ein, Gestaltung und Lesbarkeit übernimmt die Vorlage.'))),
    h('div', { class: 'tpls' },
      Object.entries(TEMPLATES).map(([k, T]: any) => {
        const cfg = baseCfg(k), t = tv('land', { cfg: () => cfg, period: () => 'day' }), short = T.label.split(':')[1]?.trim() || T.label;
        return h('article', { class: 'card tpl' }, h('div', { class: 'stage' }, t.frame), h('div', { class: 'body' }, h('h2', null, short), h('p', null, TPL_TEXT[k] || ''), h('div', { class: 'row' }, h('span', { class: 'badge' }, T.label.split(':')[0]), h('span', { style: 'flex:1' }), h('button', { class: 'btn primary sm', onclick: () => use(k, short) }, 'Verwenden'))));
      }),
      h('article', { class: 'card tpl' }, h('div', { class: 'blank' }, icon('media')), h('div', { class: 'body' }, h('h2', null, 'Nur eigene Medien'), h('p', null, 'Leere Slideshow für fertige Bilder und Videos, zum Beispiel vom Grafiker.'), h('div', { class: 'row' }, h('span', { style: 'flex:1' }), h('button', { class: 'btn sm', onclick: () => use(null, 'Neue Slideshow') }, 'Leer starten')))),
      [['Speisekarte über mehrere Bildschirme', 'Große Preisliste, auf zwei oder drei Fernseher verteilt. Der Prototyp steht, der Einbau folgt.'], ['Wartezimmer', 'Praxis-Infos, Öffnungszeiten und Hinweise. Noch nicht gebaut.']].map(([tt, pp]) =>
        h('article', { class: 'card tpl soon' }, h('div', { class: 'body' }, h('div', { class: 'row' }, h('h2', null, tt), h('span', { class: 'badge' }, 'bald')), h('p', null, pp))))));
}

// ---------- Befehlsleiste (Strg + K) ----------
let cmdItems: { label: string; hint: string; ic: string; run: () => void }[] = [], cmdSel = 0;
function openCmd() {
  const all = [
    ...VIEWS.map(([k, l, ic]) => ({ label: l, hint: 'Bereich', ic, run: () => go(k) })),
    { label: 'Sofort-Hinweis senden', hint: 'Befehl', ic: 'bolt', run: openNotice }, { label: 'Bildschirm koppeln', hint: 'Befehl', ic: 'plus', run: openPair },
    { label: 'Neue Slideshow', hint: 'Befehl', ic: 'plus', run: () => go('templates') }, { label: 'Hell oder dunkel umschalten', hint: 'Befehl', ic: 'moon', run: toggleTheme },
    ...S.screens.map(sc => ({ label: sc.name, hint: 'Bildschirm · ' + sc.place, ic: 'screens', run: () => { go('screens'); openScreen(sc.id); } })),
    ...S.shows.map(sh => ({ label: sh.name, hint: 'Slideshow', ic: 'slides', run: () => go('shows', sh.id) })),
    ...S.shows.flatMap(sh => sh.cfg.rows.filter(r => r.c[0]).map(r => ({ label: r.c[0], hint: (r.c[r.c.length - 1] !== r.c[0] ? r.c.slice(1).filter(Boolean).pop() + ' · ' : '') + sh.name, ic: 'search', run: () => { tab = 'content'; go('shows', sh.id); } }))),
  ];
  const draw = () => {
    const q = $('cmdIn').value.trim().toLowerCase(); cmdItems = all.filter(x => !q || (x.label + ' ' + x.hint).toLowerCase().includes(q)).slice(0, q ? 12 : 8); cmdSel = Math.min(cmdSel, Math.max(0, cmdItems.length - 1));
    fill($('cmdList'), ...(cmdItems.length ? cmdItems.map((x, i) => h('button', { role: 'option', 'aria-selected': String(i === cmdSel), onclick: () => { $('dlgCmd').close(); x.run(); }, onmousemove: () => { if (cmdSel !== i) { cmdSel = i; draw(); } } }, icon(x.ic), x.label, h('span', null, x.hint))) : [h('div', { class: 'none' }, 'Nichts gefunden.')]));
  };
  $('cmdIn').value = ''; cmdSel = 0; $('cmdIn').oninput = () => { cmdSel = 0; draw(); };
  $('cmdIn').onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cmdSel = (cmdSel + (e.key === 'ArrowDown' ? 1 : -1) + cmdItems.length) % Math.max(1, cmdItems.length); draw(); const s = $('cmdList').querySelector('[aria-selected=true]'); if (s) s.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && cmdItems[cmdSel]) { e.preventDefault(); $('dlgCmd').close(); cmdItems[cmdSel].run(); }
  };
  draw(); $('dlgCmd').showModal(); $('cmdIn').focus();
}
$('openCmd').prepend(icon('search')); $('openCmd').onclick = openCmd; document.querySelector('.cmd-in').prepend(icon('search'));
if (/Mac|iPhone|iPad/.test(navigator.platform)) $('kbd').textContent = '⌘ K';
$('dlgCmd').addEventListener('click', (e: MouseEvent) => { if (e.target === $('dlgCmd')) $('dlgCmd').close(); });
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('dlgCmd').open) $('dlgCmd').close(); else openCmd(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && view === 'shows' && !document.querySelector('dialog[open]') && S.shows.length && isDirty(shown())) { e.preventDefault(); publish(shown()); }
});

// ---------- Hell und dunkel ----------
const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
function paintTheme() { fill($('theme'), icon(isDark() ? 'sun' : 'moon')); $('theme').title = isDark() ? 'Helles Design' : 'Dunkles Design'; document.querySelector('meta[name=theme-color]').setAttribute('content', isDark() ? '#0d1110' : '#f6f5f1'); }
function toggleTheme() { const t = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('showcube-theme', t); } catch (e) {} paintTheme(); }
$('theme').onclick = toggleTheme; paintTheme();
$('resetDemo').onclick = () => undoable('Demo-Daten zurückgesetzt.', () => { S = seed(); cur = null; });

// ---------- Start ----------
let liveKey = '';
setInterval(() => {
  if (S.notice && S.notice.until && Date.now() > S.notice.until) { S.notice = null; save(); renderNav(); }
  const k = S.screens.filter(s => isLive(s.id)).map(s => s.id).join();
  if (k !== liveKey) { liveKey = k; render(); if (openId) drawScreenDlg(); } else { runTicks(); dticks.forEach(f => f()); }
}, 4000);
const start = async () => { await openDB(); await loadAll(); sweepBlobs(); route(); requestAnimationFrame(frame); };
fontsReady().then(start, start);
