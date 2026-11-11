import '../shared/fonts.css';
import { fontsReady, TEMPLATES, SWATCHES } from '../shared/templates';
import { CHANNEL, PAKET_FORMAT, PAKET_VERSION, paketToFile, type Msg, type Paket, type ShowConfig, type When } from '../shared/paket';

// Cloud-Panel, Prototyp. Kein Server: Zustand in localStorage, Dateien in IndexedDB.
// "Live öffnen" startet einen echten Player in einem zweiten Tab, verbunden über einen BroadcastChannel.
// Alles andere (Temperatur, IP, Online-Status der Demo-Boxen) ist gespielt.

const $ = (id: string) => document.getElementById(id) as any;
const el = (tag: string, cls?: string, text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e as any; };
const uid = (p: string) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const clock = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
function ago(t: number) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 10) return 'gerade eben'; if (s < 60) return 'vor ' + s + ' s';
  const m = Math.round(s / 60); if (m < 60) return 'vor ' + m + ' min';
  const h = Math.floor(m / 60); return 'vor ' + h + ' h ' + (m % 60) + ' min';
}
const dur = (s: number) => s < 60 ? s + ' s' : s < 3600 ? Math.floor(s / 60) + ' min' : Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min';

// Wo liegen Player und Konfigurator? Im Build alle drei nebeneinander in release/, in der Entwicklung je ein Ordner.
const REL = /\.html$/.test(location.pathname);
const PLAYER_URL = REL ? 'player.html' : '../player/';
const KONFIG_URL = REL ? 'konfigurator.html' : '../konfigurator/';

// ---------- Datenmodell ----------
type MediaUse = { id: string; when: When };
type Cfg = Omit<ShowConfig, 'media'> & { media: MediaUse[] };
interface Show { id: string; name: string; revision: number; published: number | null; dirty: boolean; cfg: Cfg; pub: Cfg | null; }
interface Screen { id: string; name: string; place: string; orient: 'land' | 'port'; show: string; power: boolean; sim: 'online' | 'offline'; lastSeen: number; revision: number; version: string; temp: number; disk: number; net: string; booted: number; log: { t: number; msg: string }[]; }
interface Asset { id: string; type: 'image' | 'video'; name: string; size: number; added: number; }
interface State { shows: Show[]; screens: Screen[]; assets: Asset[]; }

const baseCfg = (tpl: string | null): Cfg => {
  const T = tpl ? TEMPLATES[tpl] : null;
  return { tpl, name: T ? T.name : '', items: T ? T.items : '', accent: T ? T.accent : SWATCHES[0], dur: 8, fit: 'cover',
    dayStart: '06:00', eveStart: '17:00', offOn: true, offFrom: '22:00', offTo: '07:00', media: [] };
};
function seed(): State {
  const now = Date.now(), H = 3600e3;
  const mk = (id, name, cfg: Cfg): Show => ({ id, name, revision: 1, published: now - 26 * H, dirty: false, cfg, pub: JSON.parse(JSON.stringify(cfg)) });
  const shows = [
    mk('pizza', 'Pizzeria: Mittag und Abend', { ...baseCfg('gastro'), dayStart: '11:00', eveStart: '17:00', offFrom: '23:30', offTo: '10:30' }),
    mk('makler', 'Makler: Objekte im Fenster', { ...baseCfg('makler'), dur: 10, offFrom: '23:00', offTo: '06:00' }),
    mk('sale', 'Modehaus: Herbst-Sale', baseCfg('laden')),
  ];
  const scr = (id, name, place, orient, show, sim, lastSeen, temp, net): Screen => ({ id, name, place, orient, show, power: true, sim, lastSeen, revision: 1, version: '0.3.1', temp, disk: 18 + (id.length * 7) % 30, net, booted: now - 3 * 24 * H - id.length * 1e6, log: [{ t: now - 26 * H, msg: 'Inhalte Stand 1 übernommen' }, { t: now - 3 * 24 * H, msg: 'Box gestartet' }] });
  return {
    shows,
    screens: [
      scr('theke', 'Theke', 'Pizzeria Da Marco', 'land', 'pizza', 'online', now, 51, 'WLAN, gut'),
      scr('fenster', 'Schaufenster', 'Pizzeria Da Marco', 'port', 'pizza', 'online', now, 58, 'WLAN, mittel'),
      scr('hausmann', 'Fenster links', 'Hausmann Immobilien', 'land', 'makler', 'offline', now - 2 * H - 13 * 60e3, 47, 'LAN'),
    ],
    assets: [],
  };
}
const KEY = 'showcube-panel-v0';
let S: State = seed();
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.shows) S = s; } catch (e) {}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const showById = (id: string) => S.shows.find(s => s.id === id);
const assetById = (id: string) => S.assets.find(a => a.id === id);
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
const urlOf = (id: string) => { if (!urls.has(id) && blobs.has(id)) urls.set(id, URL.createObjectURL(blobs.get(id))); return urls.get(id); };
const imgs = new Map<string, HTMLImageElement>(), vids = new Map<string, HTMLVideoElement>();
function imgOf(id: string) { if (!imgs.has(id) && blobs.has(id)) { const i = new Image(); i.src = urlOf(id); imgs.set(id, i); } return imgs.get(id); }
function vidOf(id: string) { if (!vids.has(id) && blobs.has(id)) { const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.src = urlOf(id); vids.set(id, v); } return vids.get(id); }

// ---------- Zeitplan und Folien, wie im Player ----------
const mins = (s: string) => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + m; };
const inRange = (n, a, b) => a <= b ? n >= a && n < b : n >= a || n < b;
function periodOf(c: Cfg, now = new Date()) {
  const n = now.getHours() * 60 + now.getMinutes();
  if (c.offOn && inRange(n, mins(c.offFrom), mins(c.offTo))) return 'off';
  return inRange(n, mins(c.dayStart), mins(c.eveStart)) ? 'day' : 'eve';
}
const PERIOD = { day: 'Tag', eve: 'Abend', off: 'Nachts aus' };
const dataOf = (c: Cfg) => ({ name: c.name || ' ', accent: c.accent, logo: null, hours: 'Montag bis Samstag, 9 bis 19 Uhr',
  items: c.items.split('\n').map(l => l.split('|').map(s => s.trim())).filter(r => r[0]) });
function slidesOf(c: Cfg, p: string) {
  if (p === 'off') return [];
  const list = [];
  if (c.tpl && TEMPLATES[c.tpl]) TEMPLATES[c.tpl].slides(p === 'eve', dataOf(c)).forEach(fn => list.push({ kind: 'tpl', fn }));
  c.media.forEach(m => { const a = assetById(m.id); if (a && blobs.has(a.id) && (m.when === 'always' || m.when === p)) list.push({ kind: a.type, id: a.id }); });
  return list;
}
function drawItem(ctx: CanvasRenderingContext2D, w: number, h: number, it, c: Cfg, t: number) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  if (!it) return;
  if (it.kind === 'tpl') { ctx.save(); it.fn(ctx, w, h, dataOf(c), t); ctx.restore(); return; }
  const src: any = it.kind === 'image' ? imgOf(it.id) : vidOf(it.id);
  if (!src) return;
  if (it.kind === 'video' && src.paused) src.play().catch(() => {});
  const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight; if (!sw || !sh) return;
  const s = c.fit === 'contain' ? Math.min(w / sw, h / sh) : Math.max(w / sw, h / sh);
  try { ctx.drawImage(src, (w - sw * s) / 2, (h - sh * s) / 2, sw * s, sh * s); } catch (e) {}
}

// Ein kleiner Abspieler pro Vorschau-Leinwand. Ein gemeinsamer Takt zeichnet alle sichtbaren.
interface Pv { canvas: HTMLCanvasElement; cfg: () => Cfg; period: () => string; dark?: () => string; idx: number; next: number; info?: (i: number, n: number, p: string) => void; }
const pvs = new Set<Pv>();
function preview(canvas: HTMLCanvasElement, o: Partial<Pv>) { const p = { canvas, idx: 0, next: 0, ...o } as Pv; pvs.add(p); return p; }
function sizeTo(c: HTMLCanvasElement) {
  const r = c.getBoundingClientRect(), f = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * f), h = Math.round(r.height * f);
  if (w && h && (c.width !== w || c.height !== h)) { c.width = w; c.height = h; }
}
function frame(now: number) {
  for (const p of pvs) {
    if (!p.canvas.isConnected) { pvs.delete(p); continue; }
    if (!p.canvas.offsetParent) continue;
    sizeTo(p.canvas);
    const c = p.cfg(), per = p.period(), list = c ? slidesOf(c, per) : [], ctx = p.canvas.getContext('2d'), w = p.canvas.width, h = p.canvas.height;
    const msg = p.dark && p.dark();
    if (msg || !list.length) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); if (p.info) p.info(0, 0, per); continue; }
    if (now > p.next) { p.idx = (p.idx + 1) % list.length; p.next = now + Math.max(3, c.dur) * 1000; }
    if (p.idx >= list.length) p.idx = 0;
    drawItem(ctx, w, h, list[p.idx], c, now / 1000);
    if (p.info) p.info(p.idx, list.length, per);
  }
  requestAnimationFrame(frame);
}
function stillOf(c: Cfg, w: number, h: number, period = 'day') {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  drawItem(cv.getContext('2d'), w, h, slidesOf(c, period)[0], c, 0); return cv;
}

// ---------- Verbindung zu echten Playern (Tabs mit ?live=...) ----------
const ch = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
const live = new Map<string, { beat?: any; at: number; shot?: string }>();
const isLive = (id: string) => { const l = live.get(id); return !!l && Date.now() - l.at < 8000; };
const send = (m: Msg) => ch && ch.postMessage(m);
function paketFor(sh: Show, c: Cfg, sc?: Screen): Paket {
  const files = {};
  const media = c.media.map(m => { const a = assetById(m.id); if (!a || !blobs.has(a.id)) return null; files[a.id] = blobs.get(a.id); return { id: a.id, type: a.type, name: a.name, when: m.when }; }).filter(Boolean);
  return { format: PAKET_FORMAT, version: PAKET_VERSION, show: { id: sh.id, name: sh.name, revision: sh.revision, published: new Date(sh.published || Date.now()).toISOString() },
    screen: sc ? { id: sc.id, name: sc.name } : undefined, config: { ...c, media }, files };
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
  const l = live.get(sc.id) || { at: 0 }; const was = isLive(sc.id); l.at = Date.now(); live.set(sc.id, l);
  if (m.t === 'hello') { logTo(sc, 'Player verbunden'); sc.booted = Date.now(); deliver(sc); save(); }
  if (m.t === 'beat') { l.beat = m; sc.lastSeen = Date.now(); if (!was) { logTo(sc, 'Wieder online'); } }
  if (m.t === 'shot') { l.shot = m.url; const f = shotWait.get(sc.id); if (f) { shotWait.delete(sc.id); f(m.url); } }
  if (!was || m.t !== 'beat') renderAll();
};

// ---------- Navigation ----------
let view = 'screens';
function go(v: string) {
  view = v;
  document.querySelectorAll<HTMLButtonElement>('nav [data-view]').forEach(b => { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  ['screens', 'shows', 'media', 'templates'].forEach(k => $('v-' + k).hidden = k !== v);
  renderAll(); scrollTo(0, 0);
}
document.querySelectorAll<HTMLButtonElement>('nav [data-view]').forEach(b => b.onclick = () => go(b.dataset.view));
function toast(t: string) { const e = $('toast'); e.textContent = t; e.classList.remove('gone'); clearTimeout(e._t); e._t = setTimeout(() => e.classList.add('gone'), 3500); }
function renderAll() {
  $('acctName').textContent = 'Demo';
  $('plan').textContent = 'Cloud · ' + S.screens.length + ' Bildschirme · ' + S.screens.length * 12 + ' € / Monat';
  $('cScreens').textContent = S.screens.length; $('cShows').textContent = S.shows.length; $('cMedia').textContent = S.assets.length || '';
  if (view === 'screens') renderScreens();
  if (view === 'shows') renderShows();
  if (view === 'media') renderMedia();
  if (view === 'templates') renderTemplates();
}

// ---------- Bildschirme ----------
function stateOf(sc: Screen) {
  if (isLive(sc.id)) return { on: true, label: 'Online, live verbunden' };
  if (sc.sim === 'online') return { on: true, label: 'Online' };
  return { on: false, label: 'Offline seit ' + ago(sc.lastSeen).replace('vor ', '') };
}
function renderScreens() {
  const on = S.screens.filter(s => stateOf(s).on).length, stale = S.screens.filter(s => showById(s.show) && s.revision < showById(s.show).revision).length;
  const st = $('stats'); st.innerHTML = '';
  [[S.screens.length, 'Bildschirme'], [on, 'online'], [S.screens.length - on, 'offline'], [stale, 'Update ausstehend']].forEach(([n, l]) => { const c = el('div', 'card stat'); c.append(el('b', '', String(n)), el('span', 'small', String(l))); st.appendChild(c); });
  const g = $('screenGrid'); g.innerHTML = '';
  S.screens.forEach(sc => {
    const sh = showById(sc.show), s = stateOf(sc), card = el('article', 'card scr');
    const tv = el('div', 'tv' + (sc.orient === 'port' ? ' port' : '')), cv = el('canvas'); tv.appendChild(cv);
    const over = el('div', 'over'); over.hidden = true; tv.appendChild(over);
    if (isLive(sc.id)) { const t = el('span', 'badge live tag', 'LIVE'); tv.appendChild(t); }
    preview(cv, {
      cfg: () => { const x = showById(sc.show); return x && (x.pub || x.cfg); },
      period: () => { const x = showById(sc.show); return x ? periodOf(x.pub || x.cfg) : 'off'; },
      dark: () => {
        let m = '';
        if (!stateOf(sc).on) m = 'Keine Verbindung. Die Box spielt weiter, was sie zuletzt bekommen hat.';
        else if (!sc.power) m = 'Bildschirm ausgeschaltet';
        else { const x = showById(sc.show); if (x && periodOf(x.pub || x.cfg) === 'off') m = 'Nachts aus (Zeitplan)'; }
        over.hidden = !m; over.textContent = m; return m && stateOf(sc).on ? m : '';
      },
    });
    const body = el('div', 'body');
    const title = el('div', 'title'); title.append(el('span', 'dot ' + (s.on ? (sc.power ? 'on' : 'dark') : 'off')), el('h2', '', sc.name)); body.appendChild(title);
    body.appendChild(el('span', 'small', sc.place + ' · ' + s.label));
    const sel = el('select'); sel.setAttribute('aria-label', 'Slideshow für ' + sc.name);
    S.shows.forEach(x => { const o = el('option', '', x.name); o.value = x.id; sel.appendChild(o); }); sel.value = sc.show;
    sel.onchange = () => { sc.show = sel.value; logTo(sc, 'Slideshow gewechselt: ' + showById(sc.show).name); deliver(sc); save(); renderAll(); toast(stateOf(sc).on ? '„' + sc.name + '“ zeigt jetzt „' + showById(sc.show).name + '“.' : 'Gespeichert. „' + sc.name + '“ holt es sich, sobald die Box wieder online ist.'); };
    const lab = el('label', '', 'Zeigt'); body.append(lab, sel);
    const meta = el('span', 'small');
    if (sh) meta.textContent = (sc.revision < sh.revision ? 'Update ausstehend (Stand ' + sc.revision + ' von ' + sh.revision + ')' : 'Aktuell, Stand ' + sh.revision) + (isLive(sc.id) && live.get(sc.id).beat ? ' · Folie ' + live.get(sc.id).beat.slide + ' von ' + live.get(sc.id).beat.of : '');
    body.appendChild(meta);
    const row = el('div', 'row');
    const det = el('button', 'btn sm', 'Fernwartung'); det.onclick = () => openScreen(sc.id);
    const lv = el('button', 'btn sm', isLive(sc.id) ? 'Player-Tab zeigen' : 'Live öffnen'); lv.title = 'Echten Player in neuem Tab starten, verbunden mit diesem Bildschirm';
    lv.onclick = () => { const w = window.open(PLAYER_URL + '?live=' + encodeURIComponent(sc.id), 'showcube-' + sc.id); if (!w) toast('Der Browser hat das neue Fenster blockiert.'); else toast('Player startet. Er meldet sich gleich hier.'); };
    row.append(det, lv); body.appendChild(row);
    card.append(tv, body); g.appendChild(card);
  });
  if (!S.screens.length) g.appendChild(el('div', 'empty', 'Noch keine Bildschirme. Oben rechts „Bildschirm koppeln“.'));
}

let openId: string = null, lastShot: { id: string; url: string; note: string } = null;
function openScreen(id: string) { openId = id; lastShot = null; drawScreenDlg(); const d = $('dlgScreen'); if (!d.open) d.showModal(); }
$('dlgScreen').addEventListener('close', () => { openId = null; });
function drawScreenDlg() {
  const sc = S.screens.find(s => s.id === openId); if (!sc) return;
  const b = $('dsBody'), s = stateOf(sc), lv = isLive(sc.id), beat = lv && live.get(sc.id).beat, sh = showById(sc.show); b.innerHTML = '';
  const hd = el('div', 'row'); const h = el('h2', '', sc.name); h.id = 'dsTitle'; const x = el('button', 'icon x', '✕'); x.setAttribute('aria-label', 'Schließen'); x.onclick = () => $('dlgScreen').close();
  hd.append(el('span', 'dot ' + (s.on ? (sc.power ? 'on' : 'dark') : 'off')), h, x); b.appendChild(hd);
  b.appendChild(el('span', 'small', sc.place + ' · ' + s.label + (lv ? '' : ' · Werte simuliert')));
  const kv = el('dl', 'kv');
  const add = (k, v) => kv.append(el('dt', '', k), el('dd', '', v));
  add('Zuletzt gemeldet', s.on ? 'gerade eben' : ago(sc.lastSeen) + ' (' + clock(sc.lastSeen) + ' Uhr)');
  add('Zeigt', sh ? sh.name + ', Stand ' + sc.revision + (sc.revision < sh.revision ? ' (neu: ' + sh.revision + ')' : '') : '–');
  add('Gerade', beat ? PERIOD[beat.period] + ', Folie ' + beat.slide + ' von ' + beat.of : sh ? PERIOD[periodOf(sh.pub || sh.cfg)] : '–');
  add('Bildschirm', (sc.power ? 'an' : 'aus') + ' · ' + (beat ? beat.w + ' × ' + beat.h : sc.orient === 'port' ? '1080 × 1920' : '1920 × 1080'));
  add('Läuft seit', beat ? dur(beat.uptime) : dur(Math.round((Date.now() - sc.booted) / 1000)));
  add('Box', 'ShowCube ' + sc.version + ' · Raspberry Pi 5 · ' + sc.temp + ' °C · Speicher ' + sc.disk + ' % belegt');
  add('Netz', sc.net);
  b.appendChild(kv);
  const act = el('div', 'row');
  const btn = (t, f, cls = 'btn sm') => { const e = el('button', cls, t); e.onclick = f; act.appendChild(e); return e; };
  btn(sc.power ? 'Bildschirm aus' : 'Bildschirm an', () => { sc.power = !sc.power; if (lv) send({ t: 'cmd', screen: sc.id, cmd: 'power', on: sc.power }); logTo(sc, sc.power ? 'Bildschirm eingeschaltet' : 'Bildschirm ausgeschaltet'); save(); renderAll(); drawScreenDlg(); });
  btn('Neu starten', () => {
    logTo(sc, 'Neustart ausgelöst'); sc.booted = Date.now(); save();
    if (lv) send({ t: 'cmd', screen: sc.id, cmd: 'restart' }); else toast(s.on ? 'Box startet neu, in etwa 30 Sekunden wieder da.' : 'Box ist offline, der Befehl wartet.');
    drawScreenDlg();
  });
  btn('Identifizieren', () => { if (lv) send({ t: 'cmd', screen: sc.id, cmd: 'identify', label: sc.name }); toast(lv ? 'Im Player-Tab blinkt jetzt „' + sc.name + '“.' : 'Auf dem Fernseher würde jetzt „' + sc.name + '“ blinken.'); logTo(sc, 'Identifizieren'); drawScreenDlg(); });
  btn('Bildschirmfoto', () => {
    const setShot = (url, note) => { lastShot = { id: sc.id, url, note }; drawScreenDlg(); };
    if (lv) { shotWait.set(sc.id, url => setShot(url, 'Echtes Bild vom Player, ' + clock(Date.now()) + ' Uhr.')); send({ t: 'cmd', screen: sc.id, cmd: 'shot' }); setShot('', 'Wird angefordert …'); }
    else if (!s.on) setShot('', 'Box ist offline, kein Bildschirmfoto möglich.');
    else { const c = sh.pub || sh.cfg, port = sc.orient === 'port', p = periodOf(c), blank = !sc.power || p === 'off';
      setShot(stillOf(blank ? { ...c, tpl: null, media: [] } : c, port ? 270 : 480, port ? 480 : 270, p).toDataURL('image/jpeg', .85), 'Simuliert: so sähe das Bild der Box gerade aus.'); }
  });
  if (!lv) btn(sc.sim === 'online' ? 'Ausfall simulieren' : 'Wieder online simulieren', () => {
    if (sc.sim === 'online') { sc.sim = 'offline'; sc.lastSeen = Date.now(); logTo(sc, 'Verbindung verloren'); }
    else { sc.sim = 'online'; logTo(sc, 'Wieder online'); if (sh && sc.revision < sh.revision) deliver(sc); }
    save(); renderAll(); drawScreenDlg();
  });
  b.appendChild(act);
  if (lastShot && lastShot.id === sc.id) {
    if (lastShot.url) { const shot = el('img', 'shot'); shot.src = lastShot.url; shot.alt = 'Bildschirmfoto von ' + sc.name; if (sc.orient === 'port') shot.style.cssText = 'width:auto;max-height:340px;margin:0 auto'; b.appendChild(shot); }
    b.appendChild(el('span', 'small', lastShot.note));
  }
  b.appendChild(el('h3', '', 'Protokoll'));
  const ul = el('ul', 'log'); sc.log.forEach(l => { const li = el('li'); const t = el('time', '', clock(l.t)); li.append(t, el('span', '', l.msg)); ul.appendChild(li); }); b.appendChild(ul);
  const rm = el('button', 'btn danger sm', 'Bildschirm entfernen');
  rm.onclick = () => { if (rm.dataset.armed !== '1') { rm.dataset.armed = '1'; rm.textContent = 'Wirklich entfernen?'; return; } S.screens = S.screens.filter(z => z !== sc); save(); $('dlgScreen').close(); renderAll(); };
  b.appendChild(rm);
}

$('addScreen').onclick = () => {
  const ps = $('pShow'); ps.innerHTML = ''; S.shows.forEach(x => { const o = el('option', '', x.name); o.value = x.id; ps.appendChild(o); });
  $('pCode').value = ''; $('pName').value = ''; $('pErr').textContent = ''; $('dlgPair').showModal(); $('pCode').focus();
};
$('pairForm').addEventListener('submit', (e: SubmitEvent) => {
  if ((e.submitter as any)?.value !== 'ok') return;
  const code = $('pCode').value.replace(/\D/g, ''), name = $('pName').value.trim();
  if (code.length !== 6) { e.preventDefault(); $('pErr').textContent = 'Der Code hat sechs Ziffern.'; return; }
  if (!name) { e.preventDefault(); $('pErr').textContent = 'Bitte einen Namen eingeben.'; return; }
  const id = name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) + '-' + code.slice(-3);
  const sc: Screen = { id, name, place: 'Neuer Standort', orient: $('pOrient').value, show: $('pShow').value, power: true, sim: 'online', lastSeen: Date.now(), revision: 0, version: '0.3.1', temp: 44, disk: 12, net: 'WLAN, gut', booted: Date.now(), log: [] };
  logTo(sc, 'Gekoppelt mit Code ' + code.slice(0, 3) + ' ' + code.slice(3)); S.screens.push(sc); deliver(sc); save(); renderAll();
  toast('„' + name + '“ ist gekoppelt. Mit „Live öffnen“ siehst du den echten Player.');
});

// ---------- Slideshows ----------
let cur: string = null, pvPeriod = 'day', pvOrient = 'land', pvRef: Pv = null;
const shown = () => showById(cur) || S.shows[0];
function touch() { const sh = shown(); sh.dirty = true; save(); renderShowList(); renderPub(); }
function renderShows() {
  if (!S.shows.length) { S.shows.push(newShow(null)); save(); }
  if (!showById(cur)) cur = S.shows[0].id;
  renderShowList(); renderEditor();
}
function newShow(tpl: string | null, name?: string): Show {
  return { id: uid('s'), name: name || 'Neue Slideshow', revision: 0, published: null, dirty: true, cfg: baseCfg(tpl), pub: null };
}
function renderShowList() {
  const l = $('showList'); l.innerHTML = '';
  S.shows.forEach(sh => {
    const b = el('button', 'sitem'); b.setAttribute('aria-current', String(sh.id === cur));
    const n = S.screens.filter(s => s.show === sh.id).length;
    const txt = el('div'); txt.append(el('b', '', sh.name), el('span', 'small', (n ? n + ' Bildschirm' + (n > 1 ? 'e' : '') : 'nicht zugewiesen') + (sh.dirty ? ' · Entwurf' : '')));
    const cv = stillOf(sh.cfg, 128, 72); b.append(cv, txt);
    b.onclick = () => { cur = sh.id; renderShows(); };
    l.appendChild(b);
  });
}
const sw = $('sSwatches');
SWATCHES.forEach(c => { const b = el('button'); b.style.background = c; b.setAttribute('aria-label', 'Farbe ' + c); b.onclick = () => { shown().cfg.accent = c; syncSw(); touch(); }; sw.appendChild(b); });
function syncSw() { [...sw.children].forEach((b: any, i) => b.setAttribute('aria-pressed', String(SWATCHES[i] === shown().cfg.accent))); }
const tplSel = $('sTpl');
[['', 'Keine Vorlage, nur eigene Medien'], ...Object.entries(TEMPLATES).map(([k, v]) => [k, v.label])].forEach(([k, l]) => { const o = el('option', '', l); o.value = k; tplSel.appendChild(o); });
function renderEditor() {
  const sh = shown(), c = sh.cfg;
  $('sName').value = sh.name; tplSel.value = c.tpl || ''; $('tplFields').hidden = !c.tpl;
  $('sBrand').value = c.name; $('sItems').value = c.items; $('sItemsHelp').textContent = c.tpl ? TEMPLATES[c.tpl].help : ''; syncSw();
  $('sDay').value = c.dayStart; $('sEve').value = c.eveStart; $('sOffOn').checked = c.offOn; $('sOffFrom').value = c.offFrom; $('sOffTo').value = c.offTo; $('sDur').value = c.dur; $('sFit').value = c.fit;
  renderShowMedia(); renderPub();
  if (!pvRef) pvRef = preview($('pvCanvas'), { cfg: () => shown().cfg, period: () => pvPeriod, info: (i, n, p) => { $('pvInfo').textContent = n ? 'Folie ' + (i + 1) + ' von ' + n + ' · ' + PERIOD[p] : 'Keine Folien für ' + PERIOD[p] + '. Vorlage wählen oder Medien hinzufügen.'; } });
  pvRef.idx = 0; pvRef.next = performance.now() + c.dur * 1000;
}
function renderShowMedia() {
  const c = shown().cfg, ul = $('sMedia'); ul.innerHTML = '';
  c.media.forEach((m, i) => {
    const a = assetById(m.id); if (!a) return;
    const li = el('li'), th = el(a.type === 'video' ? 'video' : 'img', 'th'); th.src = urlOf(a.id) || ''; if (a.type === 'video') th.muted = true; else th.alt = '';
    const ctl = el('span', 'row'), sel = el('select'); sel.setAttribute('aria-label', 'Wann zeigen: ' + a.name);
    [['always', 'immer'], ['day', 'tagsüber'], ['eve', 'abends']].forEach(([v, t]) => { const o = el('option', '', t); o.value = v; sel.appendChild(o); });
    sel.value = m.when; sel.onchange = () => { m.when = sel.value; touch(); };
    const up = el('button', 'icon', '↑'); up.setAttribute('aria-label', 'Nach oben: ' + a.name); up.disabled = i === 0; up.onclick = () => { c.media.splice(i - 1, 0, c.media.splice(i, 1)[0]); touch(); renderShowMedia(); };
    const x = el('button', 'icon', '✕'); x.setAttribute('aria-label', 'Aus Slideshow entfernen: ' + a.name); x.onclick = () => { c.media.splice(i, 1); touch(); renderShowMedia(); };
    ctl.append(sel, up, x); li.append(th, el('span', 'nm', (a.type === 'video' ? 'Video: ' : '') + a.name), ctl); ul.appendChild(li);
  });
  const add = $('sAddMedia'); add.innerHTML = '';
  const free = S.assets.filter(a => !c.media.some(m => m.id === a.id));
  const o0 = el('option', '', S.assets.length ? (free.length ? 'Medium aus der Bibliothek hinzufügen …' : 'Alle Medien sind schon drin') : 'Noch keine Medien hochgeladen'); o0.value = ''; add.appendChild(o0);
  free.forEach(a => { const o = el('option', '', (a.type === 'video' ? 'Video: ' : '') + a.name); o.value = a.id; add.appendChild(o); });
  add.disabled = !free.length;
}
function renderPub() {
  const sh = shown(), n = S.screens.filter(s => s.show === sh.id);
  $('pubState').innerHTML = '';
  $('pubState').append(sh.dirty ? el('span', 'badge dirty', sh.revision ? 'Geänderter Entwurf' : 'Noch nie veröffentlicht') : el('span', 'badge', 'Veröffentlicht'),
    el('span', 'small', sh.published ? 'Stand ' + sh.revision + ' vom ' + new Date(sh.published).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : ''));
  $('publish').disabled = !sh.dirty;
  $('publish').textContent = n.length ? 'Auf ' + n.length + ' Bildschirm' + (n.length > 1 ? 'e' : '') + ' veröffentlichen' : 'Veröffentlichen';
  $('pubHint').textContent = n.length ? 'Geht an: ' + n.map(s => s.name + (stateOf(s).on ? '' : ' (offline, holt es später)')).join(', ') + '.' : 'Noch keinem Bildschirm zugewiesen. Das geht unter „Bildschirme“.';
  const c = sh.cfg, w = $('window');
  if (c.tpl) { w.href = KONFIG_URL + '#' + new URLSearchParams({ tpl: c.tpl, name: c.name, items: c.items, accent: c.accent }); w.removeAttribute('aria-disabled'); w.style.pointerEvents = ''; w.style.opacity = ''; }
  else { w.removeAttribute('href'); w.setAttribute('aria-disabled', 'true'); w.style.pointerEvents = 'none'; w.style.opacity = '.5'; }
}
$('sName').oninput = (e) => { shown().name = e.target.value; touch(); };
tplSel.onchange = () => {
  const sh = shown(), k = tplSel.value || null, T = k && TEMPLATES[k];
  sh.cfg.tpl = k; if (T) { sh.cfg.name = T.name; sh.cfg.items = T.items; sh.cfg.accent = T.accent; }
  touch(); renderEditor();
};
$('sBrand').oninput = (e) => { shown().cfg.name = e.target.value; touch(); };
$('sItems').oninput = (e) => { shown().cfg.items = e.target.value; touch(); };
([['sDay', 'dayStart'], ['sEve', 'eveStart'], ['sOffFrom', 'offFrom'], ['sOffTo', 'offTo'], ['sFit', 'fit']] as const).forEach(([id, k]) => { $(id).onchange = (e) => { (shown().cfg as any)[k] = e.target.value; touch(); }; });
$('sOffOn').onchange = (e) => { shown().cfg.offOn = e.target.checked; touch(); };
$('sDur').onchange = (e) => { const v = Math.min(120, Math.max(3, +e.target.value || 8)); e.target.value = v; shown().cfg.dur = v; touch(); };
$('sAddMedia').onchange = (e) => { if (!e.target.value) return; shown().cfg.media.push({ id: e.target.value, when: 'always' }); touch(); renderShowMedia(); };
$('sGoMedia').onclick = () => go('media');
$('pvNext').onclick = () => { if (pvRef) pvRef.next = 0; };
document.querySelectorAll<HTMLButtonElement>('[data-pp]').forEach(b => b.onclick = () => { pvPeriod = b.dataset.pp; document.querySelectorAll('[data-pp]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); if (pvRef) pvRef.idx = -1, pvRef.next = 0; });
document.querySelectorAll<HTMLButtonElement>('[data-po]').forEach(b => b.onclick = () => { pvOrient = b.dataset.po; document.querySelectorAll('[data-po]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('pvTv').classList.toggle('port', pvOrient === 'port'); });
$('newShow').onclick = () => { const sh = newShow('gastro'); S.shows.push(sh); cur = sh.id; save(); renderShows(); $('sName').focus(); $('sName').select(); };
$('sDelete').onclick = () => {
  const sh = shown(), used = S.screens.filter(s => s.show === sh.id);
  if (used.length) { toast('Läuft noch auf ' + used.map(s => '„' + s.name + '“').join(', ') + '. Erst dort eine andere Slideshow wählen.'); return; }
  if (S.shows.length < 2) { toast('Die letzte Slideshow bleibt.'); return; }
  S.shows = S.shows.filter(x => x !== sh); cur = S.shows[0].id; save(); renderShows();
};
$('publish').onclick = () => {
  const sh = shown(); sh.revision++; sh.published = Date.now(); sh.dirty = false; sh.pub = JSON.parse(JSON.stringify(sh.cfg));
  const to = S.screens.filter(s => s.show === sh.id); to.forEach(deliver); save(); renderShowList(); renderPub();
  const off = to.filter(s => !stateOf(s).on).length;
  toast('Stand ' + sh.revision + ' veröffentlicht' + (to.length ? ', ' + (to.length - off) + ' von ' + to.length + ' Bildschirmen haben ihn schon' : '') + '.');
};
$('exportUsb').onclick = async () => {
  // Exportiert wird der aktuelle Entwurf, damit man auch ohne Veröffentlichen testen kann.
  const sh = shown(), p = paketFor(sh, sh.cfg);
  const blob = await paketToFile(p), a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'showcube-paket.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Paket gespeichert. Auf den USB-Stick kopieren, im Player unter „Paket laden“ einlesen.');
};

// ---------- Medien ----------
function addFiles(files: FileList | File[]) {
  let n = 0;
  [...files].forEach(f => {
    const type = f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'image' : null; if (!type) return;
    const id = uid('m'); putBlob(id, f); S.assets.unshift({ id, type, name: f.name, size: f.size, added: Date.now() }); n++;
  });
  save(); renderAll(); if (n) toast(n + (n > 1 ? ' Dateien' : ' Datei') + ' hochgeladen. In einer Slideshow unter „Eigene Bilder und Videos“ hinzufügen.'); else toast('Nur Bilder und Videos (MP4, WebM).');
}
$('mediaIn').onchange = (e) => { addFiles(e.target.files); e.target.value = ''; };
const drop = $('drop');
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
drop.addEventListener('drop', (e: DragEvent) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
const kb = (n: number) => n > 1e6 ? (n / 1e6).toFixed(1).replace('.', ',') + ' MB' : Math.round(n / 1e3) + ' KB';
function renderMedia() {
  const g = $('assetGrid'); g.innerHTML = '';
  if (!S.assets.length) { g.appendChild(el('div', 'empty', 'Noch keine Medien. Zum Ausprobieren reicht ein Foto vom Handy.')); return; }
  S.assets.forEach(a => {
    const c = el('div', 'card asset'), th = el(a.type === 'video' ? 'video' : 'img', 'th'); th.src = urlOf(a.id) || ''; if (a.type === 'video') { th.muted = true; th.loop = true; th.onmouseenter = () => th.play().catch(() => {}); th.onmouseleave = () => th.pause(); } else th.alt = a.name;
    const used = S.shows.filter(s => s.cfg.media.some(m => m.id === a.id));
    const b = el('div', 'body'); b.append(el('span', 'nm', a.name), el('span', 'small', (a.type === 'video' ? 'Video · ' : 'Bild · ') + kb(a.size) + (blobs.has(a.id) ? '' : ' · Datei fehlt')), el('span', 'small', used.length ? 'In: ' + used.map(s => s.name).join(', ') : 'In keiner Slideshow'));
    const x = el('button', 'btn danger sm', 'Löschen');
    x.onclick = () => {
      if (used.length && x.dataset.armed !== '1') { x.dataset.armed = '1'; x.textContent = 'Auch aus ' + used.length + ' Slideshow' + (used.length > 1 ? 's' : '') + ' entfernen?'; return; }
      used.forEach(s => { s.cfg.media = s.cfg.media.filter(m => m.id !== a.id); s.dirty = true; });
      S.assets = S.assets.filter(z => z !== a); delBlob(a.id); imgs.delete(a.id); vids.delete(a.id); save(); renderAll();
    };
    b.appendChild(x); c.append(th, b); g.appendChild(c);
  });
}

// ---------- Vorlagen ----------
const TPL_TEXT = {
  gastro: 'Menütafel mit Preisen und ein Angebot. Mittags und abends eigene Karte.',
  makler: 'Bis zu vier Objekte mit Fläche, Preis und Energieklasse, abends ein QR-Code zum Exposé.',
  laden: 'Große Angebote und Aktionen. Nach Ladenschluss ein Hinweis auf die Öffnungszeiten.',
};
function renderTemplates() {
  const g = $('tplGrid'); g.innerHTML = '';
  Object.entries(TEMPLATES).forEach(([k, T]) => {
    const c = el('article', 'card tpl'), cv = el('canvas'); c.appendChild(cv);
    const cfg = baseCfg(k); preview(cv, { cfg: () => cfg, period: () => 'day' });
    const b = el('div', 'body'); b.append(el('h2', '', T.label), el('p', '', TPL_TEXT[k] || ''));
    const btn = el('button', 'btn primary sm', 'Slideshow daraus machen');
    btn.onclick = () => { const sh = newShow(k, T.label.split(':')[1]?.trim() || T.label); S.shows.push(sh); cur = sh.id; save(); go('shows'); toast('Neue Slideshow aus „' + T.label + '“. Texte und Preise anpassen, dann veröffentlichen.'); };
    b.appendChild(btn); c.appendChild(b); g.appendChild(c);
  });
  [['Speisekarte mit Preisliste', 'Mehrere Bildschirme, Preise als Tabelle, „aus“ und „Angebot“ mit einem Klick. Prototyp gibt es schon, Einbau folgt.'],
    ['Wartezimmer', 'Praxis-Infos, Öffnungszeiten, Wartehinweise. Noch nicht gebaut.']].forEach(([t, p]) => {
    const c = el('article', 'card tpl soon'), cv = el('canvas'); cv.width = 320; cv.height = 180; const x = cv.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, 320, 180);
    const b = el('div', 'body'); const h = el('div', 'row'); h.append(el('h2', '', t), el('span', 'badge', 'bald')); b.append(h, el('p', '', p)); c.append(cv, b); g.appendChild(c);
  });
}

// ---------- Start ----------
setInterval(() => { if (view === 'screens' && !$('dlgScreen').open) renderScreens(); if (openId) drawScreenDlg(); }, 5000);
const start = async () => { await openDB(); await loadAll(); renderAll(); requestAnimationFrame(frame); };
fontsReady().then(start, start);
