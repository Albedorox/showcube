import '../shared/fonts.css';
import '../shared/fonts-marke.css';
import { fontsReady, TEMPLATES, SWATCHES, drawNotice } from '../shared/templates';
import { activeOn, expired, zeitraumText, bausteinActive, bausteinSlide, bausteinTitle, bausteinVideos, BAUSTEINE, LEISTE, leisteH, drawLeiste, fetchWetter, findPlace, WETTER_DEMO, type Baustein, type BausteinKind, type Leiste, type Wetter, type Zeitraum } from '../shared/bausteine';
import { useMarke, logoBild, markeAusDatei, markeAlsDatei, MARKE_FORMAT, type Marke } from '../shared/marke';
import { drawDesign, freieFelder, type DesignVorlage } from '../shared/design';
import { hatServer, verbinden, SPEICHER, BUCKET } from '../shared/cloud';
import { werbeSlots, mischen, proTag, rund, berichtKodieren, TAKTE, FREI_ID, type WerbeSlot, type WerbungCfg, type Bericht } from '../shared/werbung';
import { CHANNEL, PAKET_FORMAT, PAKET_VERSION, paketToFile, type Msg, type Notice, type Paket, type ShowConfig, type When } from '../shared/paket';

// Cloud-Panel. Drei Zustände:
// - Start: nicht angemeldet. Nur der Anmelde-Bildschirm, keine Inhalte.
// - Demo: Beispiel-Betriebe zum Ausprobieren. Lebt nur in diesem Tab (sessionStorage), nichts wird gespeichert.
// - Konto: alles liegt auf dem Server (Abschnitt "ShowCube Cloud" unten), die Bildschirme sind echte Boxen.
// In der Demo gilt:
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
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2h5"/>',
  ticker: '<rect x="2" y="15" width="20" height="6" rx="1.5"/><path d="M6 18h8M3 5h18M3 10h12"/>', chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  brush: '<path d="M14.5 4.5l5 5L10 19l-5 1 1-5z"/><path d="M13 6l5 5"/>', palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15.5" cy="7.5" r="1.2"/>',
  coins: '<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M3 11v4c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4"/><circle cx="17" cy="16" r="4.5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
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
const DESIGNER_URL = REL ? 'designer.html' : '../designer/';
const BERICHT_URL = REL ? 'bericht.html' : '../bericht/';

// ---------- Datenmodell ----------
type Row = { c: string[]; off?: boolean };
type MediaUse = { id: string; when: When; dauer?: number } & Zeitraum;
interface Cfg { tpl: string | null; name: string; rows: Row[]; accent: string; logo: string | null; dur: number; fit: 'cover' | 'contain'; dayStart: string; eveStart: string; offOn: boolean; offFrom: string; offTo: string; offDays: number[]; media: MediaUse[]; extras: Baustein[]; leiste: Leiste; marke?: boolean; }
interface Version { revision: number; at: number; cfg: Cfg; }
interface Show { id: string; name: string; revision: number; published: number | null; cfg: Cfg; pub: Cfg | null; history: Version[]; }
interface Screen { id: string; name: string; place: string; orient: 'land' | 'port'; show: string; power: boolean; sim: 'online' | 'offline'; lastSeen: number; revision: number; version: string; kennung?: string; temp: number; disk: number; net: string; booted: number; log: { t: number; msg: string }[]; }
interface Asset { id: string; type: 'image' | 'video'; name: string; size: number; added: number; }
interface State { shows: Show[]; screens: Screen[]; assets: Asset[]; notice: (Notice & { screens: string[] }) | null; alert?: { on: boolean; after: number; to: string };
  marke?: Marke | null;          // Marken-Kit des Betriebs, gilt für alle Slideshows (außer sie schalten es ab)
  partner?: Partner[];           // Eingeladene Agenturen (Prototyp: Einladung wird noch nicht verschickt)
  werbung?: Werbung;             // Partner-Slots (Werbepartner), siehe shared/werbung.ts
}
interface Partner { email: string; name: string; am: number; }
// Partner-Slots: Sendezeit an Geschäfte aus der Nachbarschaft vermieten. Standardmäßig aus, dann ist davon nichts zu sehen.
// Kontakt und Abmachung sind nur Notizen für den Laden. Abgerechnet wird außerhalb von ShowCube.
interface Werbepartner extends WerbeSlot { on: boolean; shows: string[]; kontakt?: string; abmachung?: string; seit: number; }
interface Werbung { on: boolean; plaetze: number; frei: Werbepartner; partner: Werbepartner[]; }

const rowsOf = (items: string): Row[] => items.split('\n').filter(l => l.trim()).map(l => ({ c: l.split('|').map(s => s.trim()) }));
const baseCfg = (tpl: string | null): Cfg => {
  const T = tpl ? TEMPLATES[tpl] : null;
  return { tpl, name: T ? T.name : '', rows: T ? rowsOf(T.items) : [], accent: T ? T.accent : SWATCHES[0], logo: null, dur: 8, fit: 'cover',
    dayStart: '06:00', eveStart: '17:00', offOn: true, offFrom: '22:00', offTo: '07:00', offDays: [], media: [], extras: [], leiste: { ...LEISTE } };
};
const bau = (kind: BausteinKind, f: Record<string, string> = {}, z: Zeitraum = {}): Baustein => ({ id: uid('b'), kind, on: true, when: 'always', ...z, f: { ...BAUSTEINE[kind].f, ...f } });
const dayPlus = (n: number) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
function seed(): State {
  const now = Date.now(), H = 3600e3;
  const mk = (id: string, name: string, cfg: Cfg): Show => ({ id, name, revision: 1, published: now - 26 * H, cfg, pub: clone(cfg), history: [{ revision: 1, at: now - 26 * H, cfg: clone(cfg) }] });
  const scr = (id: string, name: string, place: string, orient: any, show: string, sim: any, lastSeen: number, temp: number, net: string): Screen => ({ id, name, place, orient, show, power: true, sim, lastSeen, revision: 1, version: '0.3.1', temp, disk: 18 + (id.length * 7) % 30, net, booted: now - 3 * 24 * H - id.length * 1e6,
    log: [{ t: now - 26 * H, msg: 'Inhalte Stand 1 übernommen' }, { t: now - 3 * 24 * H, msg: 'Box gestartet' }] });
  return {
    shows: [
      mk('pizza', 'Mittags- und Abendkarte', { ...baseCfg('gastro'), dayStart: '11:00', eveStart: '17:00', offFrom: '23:30', offTo: '10:30', offDays: [1],
        extras: [bau('reviews'), bau('qr', { title: 'Die ganze Karte aufs Handy', url: 'https://da-marco.example/karte' })],
        leiste: { on: true, ticker: 'Heute frisch: Kürbis-Pizza mit Salbei · Jeden Mittwoch Pasta-Abend · Auch zum Mitnehmen: 0751 123456', clock: true, weather: true, place: 'Ravensburg, Baden-Württemberg', lat: 47.781, lon: 9.612 } }),
      mk('makler', 'Objekte im Fenster', { ...baseCfg('makler'), dur: 10, offFrom: '23:00', offTo: '06:00', extras: [bau('qr', { title: 'Alle Exposés aufs Handy', text: 'Grundrisse, Fotos und Besichtigungstermine, auch nach Ladenschluss.', url: 'https://hausmann.example/objekte' })] }),
      mk('sale', 'Herbst-Sale', { ...baseCfg('laden'), extras: [bau('countdown', { kicker: 'Nur bis Sonntag', title: 'Herbst-Sale', big: 'bis −30 %', until: dayPlus(2) + 'T20:00' }, { to: dayPlus(2) })] }),
    ],
    screens: [
      scr('theke', 'Theke', 'Pizzeria Da Marco', 'land', 'pizza', 'online', now, 51, 'WLAN, gut'),
      scr('fenster', 'Schaufenster', 'Pizzeria Da Marco', 'port', 'pizza', 'online', now, 58, 'WLAN, mittel'),
      scr('hausmann', 'Fenster links', 'Hausmann Immobilien', 'land', 'makler', 'offline', now - 2 * H - 13 * 60e3, 47, 'LAN'),
      scr('linde', 'Eingang', 'Modehaus Linde', 'land', 'sale', 'online', now, 49, 'LAN'),
    ],
    assets: [], notice: null, werbung: werbungStart(true),
  };
}
const werbePartner = (name: string, folie: Baustein, o: Partial<Werbepartner> = {}): Werbepartner => ({ id: uid('w'), name, alle: 5, when: 'always', folie, on: true, shows: [], seit: Date.now(), ...o });
// Neue Konten starten ohne Partner. Die Demo bringt zwei Beispiel-Partner der Pizzeria mit (sichtbar erst, wenn Partner-Slots an sind).
function werbungStart(beispiele = false): Werbung {
  const frei = werbePartner('Werbeplatz frei', bau('werbeplatz'), { id: FREI_ID, alle: 6, on: true });
  if (!beispiele) return { on: false, plaetze: 3, frei, partner: [] };
  return { on: false, plaetze: 3, frei: { ...frei, folie: bau('werbeplatz', { url: 'mailto:info@da-marco.example?subject=Werbeplatz%20auf%20dem%20Bildschirm' }) }, partner: [
    werbePartner('Blumen Berger', bau('anzeige', { firma: 'Blumen Berger', title: 'Frische Tulpen für dein Zuhause', text: 'Nur zwei Minuten von hier, Marktstraße 12. Mit diesem Bildschirm 10 % auf jeden Strauß.', url: 'https://blumen-berger.example', farbe: '#c2185b' }),
      { shows: ['pizza'], from: dayPlus(-12), to: dayPlus(18), kontakt: 'Frau Berger, 0751 445566', abmachung: '35 € im Monat, bar am Monatsanfang', seit: Date.now() - 12 * 864e5 }),
    werbePartner('Fahrschule Ost', bau('anzeige', { firma: 'Fahrschule Ost', title: 'Führerschein in den Ferien', text: 'Intensivkurs ab 3. August. Theorie abends, Praxis tagsüber.', url: 'https://fahrschule-ost.example', farbe: '#1f6f8b' }),
      { alle: 8, shows: ['pizza'], from: dayPlus(-5), to: dayPlus(25), kontakt: 'Herr Yilmaz', abmachung: 'Tausch gegen Gutscheine für die Fahrschüler', seit: Date.now() - 5 * 864e5 }),
  ] };
}
const KEY = 'showcube-panel-v1';
// Die Demo lebt nur in diesem Tab: Neu laden behält sie, Tab schließen verwirft sie.
const DKEY = 'showcube-demo';
const leer = (): State => ({ shows: [], screens: [], assets: [], notice: null });
// Ohne Server-Zugang (lokale Entwicklung ohne backend.json) gibt es nichts zum Anmelden, dann ist das Panel immer die Demo.
let demo = !hatServer;
let S: State = leer();
try {
  // Früher lag die Demo dauerhaft im Browser. Das räumen wir weg, damit niemand sie für echte Daten hält.
  localStorage.removeItem(KEY);
  const d = sessionStorage.getItem(DKEY);
  if (d != null) { demo = true; const s = JSON.parse(d || 'null'); if (s && s.shows && s.screens) S = s; else S = seed(); }
  else if (demo) S = seed();
} catch (e) { if (demo) S = seed(); }
let saveOK = true;
function save() { if (konto) { cacheCloud(); planeSync(); return; } if (!demo) return; try { sessionStorage.setItem(DKEY, JSON.stringify(S)); } catch (e) { saveOK = false; } }
// Ältere oder vom Server geladene Stände ergänzen.
function normalize(x: State) {
  x.shows.forEach(sh => [sh.cfg, sh.pub, ...sh.history.map(v => v.cfg)].forEach(c => { if (c) { c.extras = c.extras || []; c.leiste = c.leiste || { ...LEISTE }; } }));
  x.alert = x.alert || { on: true, after: 10, to: 'E-Mail und Push' };
  x.werbung = x.werbung || werbungStart();
}
normalize(S);
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
// Für Video-Ebenen eigener Vorlagen: der Film läuft in der Vorschau in der Schleife.
function filmVon(id: string) { const v = vidOf(id); if (v && v.paused) v.play().catch(() => {}); return v; }

// ---------- Zeitplan und Folien, wie im Player ----------
const mins = (s: string) => { const [a, b] = (s || '0:0').split(':').map(Number); return a * 60 + b; };
const inRange = (n: number, a: number, b: number) => a <= b ? n >= a && n < b : n >= a || n < b;
function periodAt(c: Cfg, n: number) { if (c.offOn && inRange(n, mins(c.offFrom), mins(c.offTo))) return 'off'; return inRange(n, mins(c.dayStart), mins(c.eveStart)) ? 'day' : 'eve'; }
function periodOf(c: Cfg, now = new Date()) { if ((c.offDays || []).includes(now.getDay())) return 'rest'; return periodAt(c, now.getHours() * 60 + now.getMinutes()); }
const PERIOD = { day: 'Tag', eve: 'Abend', off: 'Nachts aus', rest: 'Ruhetag' };
// Die Marke gilt für jede Slideshow, außer dort ist sie abgeschaltet (cfg.marke === false).
const markeOf = (c: Cfg): Marke | null => (c && c.marke !== false && S.marke) || null;
function dataOf(c: Cfg) {
  const li = c.logo && imgOf(c.logo), m = markeOf(c);
  return { name: c.name || (m && m.name) || ' ', accent: m ? m.farben.primaer : c.accent, logo: li && li.complete && li.naturalWidth ? li : logoBild(m), marke: m, hours: 'Montag bis Samstag, 9 bis 19 Uhr', video: filmVon, vorschau: true,
    items: c.rows.filter(r => !r.off && (r.c[0] || '').trim()).map(r => r.c) };
}
// Vorschau-Datum: im Editor lässt sich ein anderer Tag simulieren, um Zeiträume zu prüfen.
let day = new Date();
const vorschauTagVon = () => day;
// Folien-Funktionen je Baustein merken, solange sich der Baustein nicht ändert (sonst würde jedes Bild neu gebaut).
const fnCache = new Map<string, { key: string; fn: any }>();
function slideFn(b: Baustein) { if (b.kind === 'design') return bausteinSlide(b); const key = JSON.stringify(b), hit = fnCache.get(b.id); if (hit && hit.key === key) return hit.fn; const fn = bausteinSlide(b); fnCache.set(b.id, { key, fn }); return fn; }
// showId: mit Partner-Slots dieser Slideshow (Bildschirme, Wiedergabe-Nachweis). Ohne: nur die eigenen Folien (Editor).
function slidesOf(c: Cfg, p: string, showId?: string, at?: Date) {
  if (p === 'off' || p === 'rest') return [];
  const day = at || vorschauTagVon();
  const list: any[] = [];
  const fits = (x: { when: When }) => x.when === 'always' || x.when === p;
  if (c.tpl && TEMPLATES[c.tpl]) TEMPLATES[c.tpl].slides(p === 'eve', dataOf(c)).forEach((fn, i) => list.push({ kind: 'tpl', fn, label: TEMPLATES[c.tpl].label.split(':')[0] + ', Folie ' + (i + 1) }));
  (c.extras || []).forEach(b => { if (fits(b) && bausteinActive(b, day)) list.push({ kind: 'tpl', fn: slideFn(b), label: BAUSTEINE[b.kind].label + ': ' + bausteinTitle(b), bau: b.id, videos: bausteinVideos(b, markeOf(c)) }); });
  c.media.forEach(m => { const a = assetById(m.id); if (a && blobs.has(a.id) && fits(m) && activeOn(m, day)) list.push({ kind: a.type, id: a.id, label: a.name, dauer: m.dauer }); });
  if (!showId) return list;
  return mischen(list, werbeSlots(werbungFor(showId, c), p, day).map(w => ({ alle: w.alle, item: { kind: 'tpl', fn: slideFn(w.folie), label: 'Partner: ' + w.name, partner: w.id } })));
}
// Wie lange eine Folie in der Vorschau steht, wie auf der Box: eigene Dauer, sonst Filmlänge (wenn bekannt), sonst „Sekunden pro Folie“.
function dauerVon(it: any, c: Cfg) {
  if (it && it.dauer) return it.dauer;
  const filme = it ? (it.kind === 'video' ? [it.id] : it.videos || []) : [];
  const laengen = filme.map((id: string) => { const v = vidOf(id); return v && isFinite(v.duration) ? v.duration : 0; }).filter(Boolean);
  return laengen.length ? Math.max(...laengen) : Math.max(3, c.dur);
}
function drawItem(ctx: CanvasRenderingContext2D, w: number, h2: number, it: any, c: Cfg, t: number) {
  if (!it) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h2); return; }
  if (it.kind === 'tpl') { useMarke(markeOf(c)); ctx.save(); it.fn(ctx, w, h2, dataOf(c), t); ctx.restore(); return; }
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h2);
  const src: any = it.kind === 'image' ? imgOf(it.id) : vidOf(it.id); if (!src) return;
  if (it.kind === 'video' && src.paused) src.play().catch(() => {});
  const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight; if (!sw || !sh) return;
  const s = c.fit === 'contain' ? Math.min(w / sw, h2 / sh) : Math.max(w / sw, h2 / sh);
  try { ctx.drawImage(src, (w - sw * s) / 2, (h2 - sh * s) / 2, sw * s, sh * s); } catch (e) {}
}
// Wetter für die Vorschau: echt von Open-Meteo, wenn erreichbar. Sonst ein Beispielwert, deutlich so beschriftet.
const wxCache = new Map<string, { wx: Wetter | null; demo: boolean; at: number }>();
function wxFor(L: Leiste): { wx: Wetter | null; demo: boolean } {
  if (!L.weather || L.lat == null) return { wx: null, demo: false };
  const k = L.lat + ',' + L.lon, hit = wxCache.get(k);
  if (!hit || Date.now() - hit.at > 15 * 60e3) {
    wxCache.set(k, { wx: hit ? hit.wx : WETTER_DEMO, demo: hit ? hit.demo : true, at: Date.now() });
    fetchWetter(L.lat, L.lon).then(wx => wxCache.set(k, { wx, demo: false, at: Date.now() }), () => {});
  }
  return wxCache.get(k);
}
// Zeichnet ein ganzes Bild wie auf der Box: Folie, darüber der Hinweis, darunter die Infoleiste.
function paintScreen(ctx: CanvasRenderingContext2D, w: number, hh: number, c: Cfg, draw: (h2: number) => void, notice: string, t: number) {
  const L = c.leiste, bh = L && L.on ? leisteH(w, hh) : 0, h2 = hh - bh;
  draw(h2); if (notice) drawNotice(ctx, w, h2, notice, c.accent);
  if (bh) drawLeiste(ctx, h2, w, bh, L, dataOf(c), t, wxFor(L).wx, new Date());
}
function stillOf(c: Cfg, w: number, h2: number, period = 'day', i = 0, notice = '') {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h2; const x = cv.getContext('2d'), list = slidesOf(c, period);
  if (!list.length) { x.fillStyle = '#000'; x.fillRect(0, 0, w, h2); return cv; }
  paintScreen(x, w, h2, c, hh => drawItem(x, w, hh, list[i], c, 99), notice, 0); return cv;
}

// Ein Abspieler pro Vorschau-Leinwand. Ein gemeinsamer Takt (30 Bilder/s) zeichnet nur die sichtbaren.
interface Pv { showId?: () => string; shownIdx?: number; shownAt?: number; canvas: HTMLCanvasElement; cfg: () => Cfg | null; period: () => string; black?: () => boolean; notice?: () => string; onSlide?: (i: number, n: number, p: string) => void; idx: number; next: number; prev: any; fadeAt: number; key: string; }
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
    const c = p.cfg(), per = p.period(), list = c ? slidesOf(c, per, p.showId && p.showId()) : [], ctx = cv.getContext('2d');
    if (!list.length || (p.black && p.black())) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, hh); p.prev = null; }
    else {
      if (p.idx >= list.length) p.idx = 0;
      if (!p.next) p.next = now + dauerVon(list[p.idx], c) * 1000;
      if (now > p.next) { p.prev = list[p.idx]; p.fadeAt = now; p.shownAt = null; p.idx = (p.idx + 1) % list.length; p.next = now + dauerVon(list[p.idx], c) * 1000; }
      const a = p.prev ? Math.min(1, (now - p.fadeAt) / 450) : 1;
      // Animationen eigener Vorlagen laufen ab Beginn der Folie.
      if (p.shownIdx !== p.idx || p.shownAt == null) { p.shownIdx = p.idx; p.shownAt = now; }
      const ts = (now - p.shownAt) / 1000;
      paintScreen(ctx, w, hh, c, h2 => {
        if (a < 1) { drawItem(ctx, w, h2, p.prev, c, 99); ctx.globalAlpha = a; }
        drawItem(ctx, w, h2, list[p.idx], c, ts); ctx.globalAlpha = 1;
      }, (p.notice && p.notice()) || '', now / 1000);
    }
    const key = p.idx + '/' + list.length + '/' + per;
    if (key !== p.key) { p.key = key; if (p.onSlide) p.onSlide(p.idx, list.length, per); }
  }
}

// ---------- Verbindung zu echten Playern (Tabs mit ?live=...) ----------
const ch = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
const live = new Map<string, { beat?: any; at: number }>();
// Echte Boxen melden sich alle 10 Sekunden, Player-Tabs alle 3 Sekunden.
const isLive = (id: string) => { const l = live.get(id); return !!l && Date.now() - l.at < (konto ? 35000 : 8000); };
const send = (m: Msg) => { if (konto) cloudSend(m); else if (ch) ch.postMessage(m); };
const isOn = (sc: Screen) => isLive(sc.id) || sc.sim === 'online';
function noticeFor(id: string): Notice | null { const n = S.notice; return n && n.screens.includes(id) && (!n.until || Date.now() < n.until) ? { text: n.text, until: n.until } : null; }
function toConfig(c: Cfg, sc?: Screen): ShowConfig {
  const media = c.media.map(m => { const a = assetById(m.id); return a && (blobs.has(a.id) || (konto && hochgeladen.has(a.id))) ? { id: a.id, type: a.type, name: a.name, when: m.when, from: m.from, to: m.to, days: m.days, ...(m.dauer ? { dauer: m.dauer } : {}) } : null; }).filter(Boolean);
  return { tpl: c.tpl, name: c.name, items: itemsOf(c), accent: c.accent, dur: c.dur, fit: c.fit, dayStart: c.dayStart, eveStart: c.eveStart, offOn: c.offOn, offFrom: c.offFrom, offTo: c.offTo, offDays: c.offDays, notice: sc ? noticeFor(sc.id) : null, media, extras: clone(c.extras || []), leiste: c.leiste && c.leiste.on ? { ...c.leiste } : null, marke: markeOf(c) };
}
// Filme aus Video-Ebenen eigener Vorlagen, die mit ins Paket müssen.
const filmeIn = (config: ShowConfig) => [...new Set((config.extras || []).flatMap(b => bausteinVideos(b, config.marke)))].filter(id => assetById(id));
function paketFor(sh: Show, c: Cfg, sc?: Screen): Paket {
  const config = toConfig(c, sc), files: Record<string, Blob> = {};
  config.media.forEach(m => { files[m.id] = blobs.get(m.id); });
  filmeIn(config).forEach(id => { if (blobs.has(id)) files[id] = blobs.get(id); });
  if (c.logo && blobs.has(c.logo)) files.logo = blobs.get(c.logo);
  config.werbung = werbungFor(sh.id, c);
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
function toast(text: string, undo?: () => void, label = 'Rückgängig', ms = 0) {
  $('toastText').textContent = text; undoFn = undo || null; $('toastUndo').hidden = !undo; $('toastUndo').textContent = label;
  $('toast').classList.remove('gone'); clearTimeout(toastT); toastT = setTimeout(() => $('toast').classList.add('gone'), ms || (undo ? 7000 : 3800));
}
$('toastUndo').onclick = () => { const f = undoFn; undoFn = null; $('toast').classList.add('gone'); if (f) f(); };
function undoable(text: string, change: () => void) {
  const before = JSON.stringify(S); change(); save(); render();
  toast(text, () => { S = JSON.parse(before); save(); render(); pushNotice(); if (openId) drawScreenDlg(); toast('Rückgängig gemacht.'); });
}

// ---------- Navigation ----------
const VIEWS_BASIS = [['screens', 'Bildschirme', 'screens'], ['shows', 'Inhalte', 'slides'], ['media', 'Medien', 'media'], ['templates', 'Vorlagen', 'templates']];
// „Partner“ erscheint nur, wenn Partner-Slots in den Einstellungen eingeschaltet sind.
const views = () => S.werbung && S.werbung.on ? [...VIEWS_BASIS, ['werbung', 'Partner', 'coins']] : VIEWS_BASIS;
let view = 'screens', cur: string = null, tab = 'content', placeFilter = '';
let ticks: (() => void)[] = [];
const runTicks = () => ticks.forEach(f => f());
function go(v: string, id?: string) { const hsh = '#' + v + (id ? '/' + id : ''); if (location.hash === hsh) route(); else location.hash = hsh; }
function route() {
  const [v, id] = location.hash.slice(1).split('/');
  view = views().some(x => x[0] === v) ? v : 'screens';
  if (view !== 'shows') day = new Date();
  if (view === 'shows' && id && showById(id)) cur = id;
  render(); scrollTo(0, 0);
}
addEventListener('hashchange', route);
function renderNav() {
  const drafts = S.shows.filter(isDirty).length, off = S.screens.filter(s => !isOn(s)).length;
  const count = { screens: off ? h('span', { class: 'n alert', title: off + ' offline' }, String(off)) : h('span', { class: 'n' }, String(S.screens.length)),
    shows: drafts ? h('span', { class: 'n alert', title: 'Unveröffentlichte Änderungen' }, String(drafts)) : h('span', { class: 'n' }, String(S.shows.length)),
    media: S.assets.length ? h('span', { class: 'n' }, String(S.assets.length)) : null, templates: null, werbung: null };
  const mk = (withCount: boolean) => views().map(([k, label, ic]) => h('button', { 'aria-current': view === k ? 'page' : null, onclick: () => go(k) }, icon(ic), label, withCount ? count[k] : null));
  fill($('nav'), ...mk(true)); fill($('tabbar'), ...mk(false));
  $('planName').textContent = 'Cloud · ' + plural(S.screens.length, 'Bildschirm', 'Bildschirme');
  $('planInfo').textContent = S.screens.length * 12 + ' € im Monat · ' + (konto ? konto.email : 'Demo'); paintKonto();
  const n = S.notice && (!S.notice.until || Date.now() < S.notice.until) ? S.notice : null;
  $('noticeChip').hidden = !n; if (n) $('noticeChipText').textContent = 'Hinweis läuft: „' + n.text + '“';
}
function render() {
  ticks = []; renderNav();
  const v = $('view'); v.replaceChildren();
  v.style.animation = 'none'; void v.offsetWidth; v.style.animation = '';
  ({ screens: renderScreens, shows: renderShows, media: renderMedia, templates: renderTemplates, werbung: renderWerbung })[view](v);
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
  const t = tv(sc.orient, { cfg, showId: () => sc.show, period: () => { const c = cfg(); return c ? periodOf(c) : 'off'; }, black: () => stateOf(sc).black, notice: () => { const n = isOn(sc) && noticeFor(sc.id); return n ? n.text : ''; }, ...extra });
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
  const A = S.alert;
  v.append(h('div', { class: 'alertset' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: A.on, onchange: (e: any) => { A.on = e.target.checked; save(); render(); } }), 'Melde dich, wenn ein Bildschirm ausfällt'),
    A.on ? [h('select', { 'aria-label': 'Nach wie vielen Minuten', onchange: (e: any) => { A.after = +e.target.value; save(); render(); } }, [5, 10, 30, 60].map(m => h('option', { value: String(m), selected: A.after === m }, 'nach ' + m + ' min'))),
      h('select', { 'aria-label': 'Wie benachrichtigen', onchange: (e: any) => { A.to = e.target.value; save(); render(); } }, ['E-Mail und Push', 'nur E-Mail', 'nur Push aufs Handy'].map(x => h('option', { selected: A.to === x }, x))),
      h('span', null, 'Prototyp: es wird nichts verschickt, das Panel zeigt nur, wann es passiert wäre.')] : null));
  const attn = h('div', { class: 'attn' });
  S.screens.filter(s => !isOn(s)).forEach(sc => {
    const sh = showById(sc.show), t = h('span', { class: 'small' });
    const upd = () => { const at = sc.lastSeen + A.after * 60e3, sent = A.on && Date.now() > at; t.textContent = 'Seit ' + since(sc.lastSeen) + '. Die Box zeigt weiter den letzten Stand' + (sh && sc.revision < sh.revision ? ' und holt Stand ' + sh.revision + ', sobald sie wieder da ist.' : '.') + (sent ? ' ' + (A.to === 'nur Push aufs Handy' ? 'Push' : 'E-Mail') + ' an dich ging um ' + clock(at) + ' Uhr raus.' : A.on ? ' Meldung an dich um ' + clock(at) + ' Uhr, falls sie bis dahin nicht zurück ist.' : ''); };
    upd(); ticks.push(upd);
    attn.append(h('div', { class: 'attn-item bad' }, icon('alert'), h('div', null, h('b', null, '„' + sc.name + '“ bei ' + sc.place + ' ist offline'), t), h('button', { class: 'btn sm', onclick: () => openScreen(sc.id) }, 'Ansehen')));
  });
  S.shows.filter(sh => isDirty(sh) && S.screens.some(s => s.show === sh.id)).forEach(sh => attn.append(h('div', { class: 'attn-item' }, icon('clock'),
    h('div', null, h('b', null, '„' + sh.name + '“ hat unveröffentlichte Änderungen'), h('span', { class: 'small' }, changesOf(sh).join(', ') + '. Die Bildschirme zeigen noch Stand ' + sh.revision + '.')),
    h('button', { class: 'btn sm', onclick: () => go('shows', sh.id) }, 'Öffnen'))));
  if (attn.children.length) v.append(attn);
  const hilfe = einrichtung(); if (hilfe) v.append(hilfe);
  if (!n) { if (!hilfe) v.append(h('div', { class: 'empty' }, h('b', null, 'Box an den Fernseher stecken, Code eingeben, fertig.'), h('button', { class: 'btn primary', onclick: openPair }, icon('plus'), 'Ersten Bildschirm koppeln'))); return; }
  const places = [...new Set(S.screens.map(s => s.place))];
  if (placeFilter && !places.includes(placeFilter)) placeFilter = '';
  if (places.length > 1) v.append(h('div', { class: 'filter' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Standort' },
    [['', 'Alle Standorte'], ...places.map(p => [p, p])].map(([k, l]) => h('button', { 'aria-pressed': String(placeFilter === k), onclick: () => { placeFilter = k; render(); } }, l)))));
  const grid = h('div', { class: 'screens' });
  S.screens.filter(sc => !placeFilter || sc.place === placeFilter).sort((a, b2) => places.indexOf(a.place) - places.indexOf(b2.place)).forEach(sc => {
    const s = stateOf(sc), t = screenTv(sc), dot = h('span', { class: 'dot ' + s.dot }), lab = h('span', { class: 'small' }), tag = h('div', { class: 'tag' });
    const sel = h('select', { id: 'sel-' + sc.id, onchange: () => { sc.show = sel.value; const sh = showById(sc.show); logTo(sc, 'Slideshow gewechselt: ' + sh.name); deliver(sc); save(); render(); toast(isOn(sc) ? '„' + sc.name + '“ zeigt jetzt „' + sh.name + '“.' : 'Gespeichert. „' + sc.name + '“ holt es sich, sobald die Box wieder online ist.'); } },
      showById(sc.show) ? null : h('option', { value: '', selected: true, disabled: true }, S.shows.length ? 'Slideshow wählen' : 'Noch keine Slideshow'), S.shows.map(x => h('option', { value: x.id, selected: x.id === sc.show }, x.name)));
    const upd = () => {
      const st = stateOf(sc), b = st.lv && live.get(sc.id).beat; dot.className = 'dot ' + st.dot; t.upd();
      lab.textContent = sc.place + ' · ' + st.label + (b && b.of ? ' · Folie ' + b.slide + ' von ' + b.of : '');
      fill(tag, st.lv && !konto ? h('span', { class: 'badge live' }, 'LIVE') : null, noticeFor(sc.id) && st.on ? h('span', { class: 'badge' }, 'Hinweis') : null);
    };
    upd(); ticks.push(upd);
    grid.append(h('article', { class: 'card scr' },
      h('button', { class: 'stage', 'aria-label': 'Fernwartung für ' + sc.name, onclick: () => openScreen(sc.id) }, t.frame, tag),
      h('div', { class: 'body' },
        h('div', null, h('div', { class: 'title' }, dot, h('h2', null, sc.name)), lab),
        h('div', { class: 'shows' }, h('label', { for: 'sel-' + sc.id }, 'Zeigt'), sel),
        h('div', { class: 'foot' }, h('button', { class: 'btn sm', onclick: () => openScreen(sc.id) }, 'Fernwartung'),
          konto ? null : h('button', { class: 'btn sm', title: 'Startet einen echten Player in einem neuen Tab, verbunden mit diesem Bildschirm', onclick: () => openLive(sc) }, s.lv ? 'Player-Tab zeigen' : 'Live öffnen', icon('ext'))))));
  });
  grid.append(h('button', { class: 'addcard', onclick: openPair }, icon('plus'), 'Bildschirm koppeln'));
  v.append(grid);
}
// Einrichtungshilfe für frische Konten: drei Schritte, bis der erste Fernseher läuft. Verschwindet, sobald alle erledigt sind.
function einrichtung() {
  if (!konto) return null;
  const hatShow = S.shows.length > 0, hatPub = S.shows.some(sh => sh.pub), hatBox = S.screens.length > 0;
  if (hatShow && hatPub && hatBox) return null;
  const erste = S.shows.find(sh => !sh.pub) || S.shows[0];
  const steps: [boolean, string, string, string, () => void][] = [
    [hatShow, 'Erste Slideshow anlegen', 'Vorlage aussuchen und Texte, Preise und Logo eintragen.', 'Vorlage wählen', () => go('templates')],
    [hatPub, 'Veröffentlichen', 'Vorschau prüfen und freigeben. Erst dann kann eine Box die Slideshow zeigen.', 'Zur Slideshow', () => erste ? go('shows', erste.id) : go('templates')],
    [hatBox, 'Bildschirm koppeln', 'Box an den Fernseher stecken, mit dem WLAN verbinden und den sechsstelligen Code vom Fernseher eingeben.', 'Bildschirm koppeln', openPair],
  ];
  const next = steps.findIndex(x => !x[0]);
  return h('section', { class: 'card setup', 'aria-labelledby': 'setupTitle' },
    h('div', null, h('h2', { id: 'setupTitle' }, 'Willkommen bei ShowCube' + (konto.name ? ', ' + konto.name : '')), h('p', { class: 'small' }, 'Dein Konto ist noch leer. In drei Schritten läuft dein erster Bildschirm.')),
    h('ol', null, steps.map(([ok, t, text, label, run], i) => h('li', { class: ok ? 'done' : i === next ? 'next' : '' },
      h('span', { class: 'num', 'aria-hidden': 'true' }, ok ? icon('check') : String(i + 1)),
      h('div', null, h('b', null, t, ok ? h('span', { class: 'small' }, ' · erledigt') : null), h('span', { class: 'small' }, text)),
      ok ? null : h('button', { class: 'btn sm' + (i === next ? ' primary' : ''), onclick: run }, label)))));
}
function openLive(sc: Screen) {
  const w = window.open(PLAYER_URL + '?live=' + encodeURIComponent(sc.id), 'showcube-' + sc.id);
  toast(w ? 'Player startet in einem neuen Tab und meldet sich gleich hier.' : 'Der Browser hat das neue Fenster blockiert.');
}

// ---------- Wiedergabe-Nachweis ----------
// Live-Player zählen selbst mit. Für Demo-Boxen rechnen wir aus Zeitplan und Folienlänge hoch, wie oft jede Folie heute lief.
function playsOf(sc: Screen): { n: Record<string, number>; real: boolean } {
  const l = live.get(sc.id), b = isLive(sc.id) && l && l.beat;
  if (b && b.plays) return { n: b.plays, real: true };
  const sh = showById(sc.show), c = sh && (sh.pub || sh.cfg), out: Record<string, number> = {};
  if (!c || (c.offDays || []).includes(new Date().getDay())) return { n: out, real: false };
  const now = new Date(), upto = Math.min(now.getHours() * 60 + now.getMinutes(), !isOn(sc) ? new Date(sc.lastSeen).getHours() * 60 + new Date(sc.lastSeen).getMinutes() : 1440);
  for (let m = 0; m < upto; m++) {
    const per = periodAt(c, m); if (per === 'off') continue;
    const list = slidesOf(c, per, sc.show, new Date()); if (!list.length) continue;
    const each = 60 / (Math.max(3, c.dur) * list.length);
    list.forEach(it => { out[it.label] = (out[it.label] || 0) + each; });
  }
  Object.keys(out).forEach(k => { out[k] = Math.round(out[k]); if (!out[k]) delete out[k]; });
  return { n: out, real: false };
}
function playsCsv(sc: Screen) {
  const { n } = playsOf(sc), d = new Date().toLocaleDateString('de-DE');
  const rows = [['Datum', 'Bildschirm', 'Standort', 'Folie', 'Wiedergaben'], ...Object.entries(n).map(([k, v]) => [d, sc.name, sc.place, k, String(v)])];
  const csv = rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const a = h('a', { href: URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), download: 'wiedergaben-' + sc.id + '.csv' });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Wiedergabe-Bericht gespeichert. Öffnet sich in Excel oder Numbers.');
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
      ...(konto ? [['Box', 'ShowCube ' + (sc.version || '–')] as [string, string], ...(sc.kennung ? [['Box-Kennung', sc.kennung] as [string, string]] : [])] : [['Box', 'ShowCube ' + sc.version + ' · ' + sc.temp + ' °C · Speicher ' + sc.disk + ' %'], ['Netz', sc.net]] as [string, string][])];
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
    (() => {
      const box = h('div', { class: 'fld' }), upd2 = () => {
        const { n, real } = playsOf(sc), ent = Object.entries(n).sort((a, b2) => b2[1] - a[1]), max = ent.length ? ent[0][1] : 1, sum = ent.reduce((x, e) => x + e[1], 0);
        fill(box, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', { style: 'margin:0' }, 'Heute gezeigt'), ent.length ? h('button', { class: 'btn ghost sm', onclick: () => playsCsv(sc) }, icon('download'), 'Bericht (CSV)') : null),
          ent.length ? [h('span', { class: 'small' }, plural(sum, 'Wiedergabe', 'Wiedergaben') + ' seit Mitternacht' + (real ? ', vom Player gezählt.' : ', hochgerechnet aus dem Zeitplan (Demo-Box).')),
            h('ul', { class: 'pop' }, ent.slice(0, 8).map(([k, v]) => h('li', null, h('span', { title: k }, k), h('b', null, v + '×'), h('i', { style: '--w:' + Math.max(3, Math.round(v / max * 100)) + '%' }))))]
            : h('span', { class: 'small' }, 'Heute noch nichts gezeigt.'));
      };
      upd2(); dticks.push(upd2); return box;
    })(),
    konto ? h('span', { class: 'small' }, 'Echte Box. Sie meldet sich alle 10 Sekunden. Befehle kommen beim nächsten Melden an.')
    : s.lv ? h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => openLive(sc) }, 'Player-Tab zeigen', icon('ext')))
      : h('div', { class: 'sim' }, h('span', null, 'Demo-Box, Werte sind gespielt. Mit „Live öffnen“ wird daraus ein echter Player.'),
        h('button', { class: 'btn sm', onclick: () => { if (sc.sim === 'online') { sc.sim = 'offline'; sc.lastSeen = Date.now(); logTo(sc, 'Verbindung verloren'); } else { sc.sim = 'online'; logTo(sc, 'Wieder online'); if (sh && sc.revision < sh.revision) deliver(sc); } redraw(); } }, sc.sim === 'online' ? 'Ausfall testen' : 'Wieder online'),
        h('button', { class: 'btn sm', onclick: () => openLive(sc) }, 'Live öffnen')),
    h('div', { class: 'fld' }, h('h3', null, 'Protokoll'), h('ul', { class: 'log' }, sc.log.slice(0, 8).map(l => h('li', null, h('time', null, clock(l.t)), h('span', null, l.msg))))),
    h('div', null, h('button', { class: 'btn ghost danger sm', onclick: () => { $('dlgScreen').close(); if (konto) { cloudEntfernen(sc); return; } undoable('„' + sc.name + '“ entfernt.', () => { S.screens = S.screens.filter(z => z.id !== sc.id); }); } }, icon('trash'), 'Bildschirm entfernen')));
}

// ---------- Bildschirm koppeln ----------
function openPair() {
  const err = h('span', { class: 'small', style: 'color:var(--bad)', role: 'alert' });
  fill($('pairForm'), 
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dpTitle' }, 'Bildschirm koppeln'), h('button', { class: 'btn icon ghost', type: 'button', onclick: (e: any) => e.currentTarget.closest('dialog').close(), 'aria-label': 'Schließen' }, icon('x'))),
    h('p', { class: 'small' }, 'Box an den Fernseher stecken und mit dem WLAN verbinden. Auf dem Fernseher erscheint ein sechsstelliger Code.' + (konto ? '' : ' In der Demo geht jeder Code.')),
    h('div', null, h('label', { for: 'pCode' }, 'Code vom Fernseher'), h('input', { class: 'code', type: 'text', id: 'pCode', inputmode: 'numeric', maxlength: '7', placeholder: '482 915', autocomplete: 'off' })),
    h('div', { class: 'grid2' },
      h('div', null, h('label', { for: 'pName' }, 'Name'), h('input', { type: 'text', id: 'pName', placeholder: 'z. B. Theke' })),
      h('div', null, h('label', { for: 'pPlace' }, 'Standort'), h('input', { type: 'text', id: 'pPlace', list: 'pPlaces', value: S.screens[0] ? S.screens[0].place : '', placeholder: 'z. B. Filiale Mitte' }))),
    h('datalist', { id: 'pPlaces' }, [...new Set(S.screens.map(x => x.place))].map(p => h('option', { value: p }))),
    h('div', { class: 'grid2' },
      h('div', null, h('label', { for: 'pShow' }, 'Zeigt'), h('select', { id: 'pShow' }, S.shows.length ? null : h('option', { value: '' }, 'Noch keine Slideshow'), S.shows.map(x => h('option', { value: x.id }, x.name)))),
      h('div', null, h('label', { for: 'pOrient' }, 'Ausrichtung'), h('select', { id: 'pOrient' }, h('option', { value: 'land' }, 'quer'), h('option', { value: 'port' }, 'hochkant')))),
    err, h('button', { class: 'btn primary lg', value: 'ok' }, 'Koppeln'));
  $('pairForm').onsubmit = (e: SubmitEvent) => {
    if ((e.submitter as any)?.value !== 'ok') return;
    const code = $('pCode').value.replace(/\D/g, ''), name = $('pName').value.trim();
    if (code.length !== 6) { e.preventDefault(); err.textContent = 'Der Code hat sechs Ziffern.'; $('pCode').focus(); return; }
    if (!name) { e.preventDefault(); err.textContent = 'Bitte einen Namen eingeben.'; $('pName').focus(); return; }
    if (konto) { e.preventDefault(); cloudKoppeln(code, name, $('pPlace').value.trim(), $('pOrient').value, $('pShow').value, err, e.submitter as HTMLButtonElement); return; }
    const id = (name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'box') + '-' + code.slice(-3);
    const sc: Screen = { id, name, place: $('pPlace').value.trim() || 'Neuer Standort', orient: $('pOrient').value, show: $('pShow').value, power: true, sim: 'online', lastSeen: Date.now(), revision: 0, version: '0.3.1', temp: 44, disk: 12, net: 'WLAN, gut', booted: Date.now(), log: [] };
    logTo(sc, 'Gekoppelt mit Code ' + code.slice(0, 3) + ' ' + code.slice(3)); S.screens.push(sc); deliver(sc); save(); go('screens');
    const zeigt = showById(sc.show); toast('„' + name + '“ ist gekoppelt' + (zeigt ? ' und zeigt „' + zeigt.name + '“.' : '.'));
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
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dnTitle' }, 'Sofort-Hinweis'), h('button', { class: 'btn icon ghost', type: 'button', onclick: (e: any) => e.currentTarget.closest('dialog').close(), 'aria-label': 'Schließen' }, icon('x'))),
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
  if (a.name !== b.name || a.accent !== b.accent || a.logo !== b.logo || a.marke !== b.marke) out.push('Name, Farbe oder Logo');
  if (j(a.media) !== j(b.media)) out.push('Medien');
  if (j(a.extras) !== j(b.extras)) out.push('Bausteine');
  if (j(a.leiste) !== j(b.leiste)) out.push('Infoleiste');
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
  const defs = [['content', 'Inhalt', T ? c.rows.filter(r => !r.off).length : 0], ['extras', 'Bausteine', (c.extras || []).filter(b => b.on).length + (c.leiste && c.leiste.on ? 1 : 0)], ['media', 'Medien', c.media.length], ['plan', 'Zeitplan', 0], ['history', 'Verlauf', shown().history.length]];
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
  const to = S.screens.filter(s => s.show === sh.id); to.forEach(deliver); if (konto) offenePakete.add(sh.id); save(); render();
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
      markeOf(c) ? h('div', null, h('span', { class: 'label' }, 'Farben'), h('button', { class: 'mchip', title: 'Marke ansehen', onclick: () => go('templates') }, [markeOf(c).farben.primaer, markeOf(c).farben.zweit, markeOf(c).farben.dunkel, markeOf(c).farben.hell].map(col => h('i', { style: 'background:' + col })), 'aus der Marke'))
        : h('div', null, h('span', { class: 'label' }, 'Farbe'), h('div', { class: 'swatches' }, SWATCHES.map(col => h('button', { style: 'background:' + col, 'aria-label': 'Farbe ' + col, 'aria-pressed': String(col === c.accent), onclick: () => { c.accent = col; repaint(); } })), (() => { const eigen = !SWATCHES.includes(c.accent); return h('label', { class: 'picker' + (eigen ? ' on' : ''), title: 'Eigene Farbe wählen', style: eigen ? '--c:' + c.accent : null }, h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(c.accent) ? c.accent : '#0b7a67', 'aria-label': 'Eigene Farbe wählen', oninput: (e: any) => { c.accent = e.target.value; changed(); const l = e.target.parentElement; l.classList.add('on'); l.style.setProperty('--c', c.accent); l.parentElement.querySelectorAll('button').forEach((b: any) => b.setAttribute('aria-pressed', 'false')); }, onchange: () => repaint() })); })()))),
    S.marke ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: c.marke !== false, onchange: (e: any) => { c.marke = e.target.checked ? undefined : false; repaint(); } }), 'Marke „' + S.marke.name + '“ verwenden: Farben, Schriften, Logo und Übergänge') : null,
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
  } else if (tab === 'extras') {
    renderExtras(p, c, repaint);
  } else if (tab === 'media') {
    const free = S.assets.filter(a => !c.media.some(m => m.id === a.id));
    fill(p, 
      c.media.length ? h('ul', { class: 'mlist' }, c.media.map((m, i) => {
        const a = assetById(m.id); if (!a) return null;
        return h('li', null, h(a.type === 'video' ? 'video' : 'img', { class: 'th', src: urlOf(a.id) || '', alt: '' }), h('span', { class: 'nm' }, a.name, expired(m) ? h('span', { class: 'badge', style: 'margin-left:6px' }, 'abgelaufen') : m.to ? h('span', { class: 'small', style: 'margin-left:6px' }, zeitraumText(m)) : null),
          h('span', { class: 'row', style: 'gap:2px' },
            h('select', { 'aria-label': 'Wann zeigen: ' + a.name, onchange: (e: any) => { m.when = e.target.value; changed(); } }, [['always', 'immer'], ['day', 'tagsüber'], ['eve', 'abends']].map(([val, tx]) => h('option', { value: val, selected: m.when === val }, tx))),
            h('input', { type: 'date', value: m.to || '', title: 'Zeigen bis (leer = immer)', 'aria-label': 'Zeigen bis: ' + a.name, onchange: (e: any) => { m.to = e.target.value || undefined; repaint(); } }),
            h('label', { class: 'sek', title: a.type === 'video' ? 'Leer = ganzer Film. Mit Zahl wird nach so vielen Sekunden weitergeschaltet.' : 'Leer = „Sekunden pro Folie“ aus dem Zeitplan.' },
              h('input', { type: 'number', min: 1, max: 600, step: 1, inputmode: 'numeric', value: m.dauer || '', placeholder: a.type === 'video' ? 'ganz' : String(c.dur), 'aria-label': 'Dauer in Sekunden: ' + a.name, onchange: (e: any) => { const n = Math.round(+e.target.value); if (n > 0) m.dauer = Math.min(600, n); else delete m.dauer; changed(); } }), 's'),
            h('button', { class: 'ib', 'aria-label': 'Nach oben: ' + a.name, disabled: i === 0, onclick: () => { c.media.splice(i - 1, 0, c.media.splice(i, 1)[0]); repaint(); } }, icon('up')),
            h('button', { class: 'ib', 'aria-label': 'Aus der Slideshow nehmen: ' + a.name, onclick: () => { c.media.splice(i, 1); repaint(); } }, icon('x'))));
      })) : h('div', { class: 'empty' }, 'Eigene Fotos und Videos laufen nach den Vorlagen-Folien.'),
      h('div', { class: 'row' },
        h('span', { class: 'btn file primary' }, icon('upload'), 'Hochladen', h('input', { type: 'file', accept: 'image/*,video/mp4,video/webm', multiple: true, 'aria-label': 'Bilder oder Videos hochladen', onchange: (e: any) => { const ids = addFiles(e.target.files, true); ids.forEach(id => c.media.push({ id, when: 'always' })); repaint(); } })),
        free.length ? h('select', { style: 'flex:1;min-width:180px', 'aria-label': 'Aus der Bibliothek hinzufügen', onchange: (e: any) => { if (e.target.value) { c.media.push({ id: e.target.value, when: 'always' }); repaint(); } } }, h('option', { value: '' }, 'Aus der Bibliothek hinzufügen …'), free.map(a => h('option', { value: a.id }, (a.type === 'video' ? 'Video: ' : '') + a.name))) : null),
      h('span', { class: 'small' }, 'Dauer in Sekunden: leer heißt bei Bildern „Sekunden pro Folie“ aus dem Zeitplan, bei Videos der ganze Film. Videos laufen stumm. Mit einem Datum verschwindet ein Medium danach von selbst. Einen Film in dein eigenes Design setzen geht mit einer Video-Ebene im Vorlagen-Designer.'));
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

// ---------- Bausteine und Infoleiste (Reiter im Editor) ----------
let extrasTick: () => void = null; const runExtrasTick = () => extrasTick && extrasTick();
const KIND_ICON: Record<BausteinKind, string> = { qr: 'qr', reviews: 'star', countdown: 'timer', design: 'brush', anzeige: 'coins', werbeplatz: 'coins' };
const isoDay = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function bauState(b: Baustein): [string, string] {
  if (!b.on) return ['', 'aus'];
  if (expired(b) || (b.kind === 'countdown' && b.f.until && Date.parse(b.f.until) <= Date.now())) return ['bad', 'abgelaufen'];
  if (!bausteinActive(b, new Date())) return ['warn', b.from && isoDay(new Date()) < b.from ? 'geplant' : 'heute nicht'];
  return ['ok', 'läuft'];
}
function zeitraumFields(z: Zeitraum & { when?: When }, idp: string, repaint: (f?: string) => void, withWhen = true) {
  const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], days = z.days || [];
  return h('div', { class: 'zr' },
    withWhen ? h('div', null, h('label', { for: idp + 'w' }, 'Tageszeit'), h('select', { id: idp + 'w', onchange: (e: any) => { z.when = e.target.value; repaint(); } }, [['always', 'immer'], ['day', 'tagsüber'], ['eve', 'abends']].map(([v, t]) => h('option', { value: v, selected: z.when === v }, t)))) : null,
    h('div', null, h('label', { for: idp + 'f' }, 'Ab (leer = sofort)'), h('input', { type: 'date', id: idp + 'f', value: z.from || '', onchange: (e: any) => { z.from = e.target.value || undefined; repaint('#' + idp + 'f'); } })),
    h('div', null, h('label', { for: idp + 't' }, 'Bis (leer = immer)'), h('input', { type: 'date', id: idp + 't', value: z.to || '', onchange: (e: any) => { z.to = e.target.value || undefined; repaint('#' + idp + 't'); } })),
    h('div', { class: 'days', role: 'group', 'aria-label': 'Nur an diesen Tagen' }, [1, 2, 3, 4, 5, 6, 0].map(d => h('button', { 'aria-pressed': String(days.includes(d)), title: 'Nur an diesen Tagen zeigen. Keiner gewählt = jeden Tag.', onclick: () => { z.days = days.includes(d) ? days.filter(x => x !== d) : [...days, d]; if (!z.days.length) delete z.days; repaint(); } }, DAYS[d]))));
}
// Bild aus einer Datei verkleinern (höchstens 1600 Pixel), damit Vorlagen und Pakete klein bleiben.
function bildKlein(f: File, max = 1600): Promise<string> {
  return new Promise((res, rej) => {
    const i = new Image(); i.onerror = rej;
    i.onload = () => { const s = Math.min(1, max / Math.max(i.naturalWidth, i.naturalHeight)), cv = h('canvas'); cv.width = Math.round(i.naturalWidth * s); cv.height = Math.round(i.naturalHeight * s); cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height); URL.revokeObjectURL(i.src); res(cv.toDataURL(f.type === 'image/png' ? 'image/png' : 'image/jpeg', .86)); };
    i.src = URL.createObjectURL(f);
  });
}
const vorlageVon = (b: Baustein) => S.marke && S.marke.vorlagen.find(v => v.id === b.f.vorlage);
// Eigene Vorlage: der Kunde füllt nur die Felder aus, die beim Gestalten freigegeben wurden.
function designFelder(b: Baustein, mitVideo = true) {
  const v = vorlageVon(b); if (!v) return [];
  return freieFelder(v).filter(el => mitVideo || el.typ !== 'video').map(el => ({ k: el.id, label: el.frei, ph: el.typ === 'bild' || el.typ === 'video' ? '' : el.text || '', type: el.typ === 'bild' || el.typ === 'video' ? el.typ : el.typ === 'qr' ? 'url' : 'text', wide: el.typ !== 'text' || (el.text || '').length > 24 }));
}
function renderExtras(p: HTMLElement, c: Cfg, repaint: (f?: string) => void) {
  const list = c.extras, L = c.leiste, M = markeOf(c);
  const addDesign = (v: DesignVorlage) => { list.push(bau('design', { vorlage: v.id, titel: v.name })); repaint(); toast('„' + v.name + '“ hinzugefügt. Nur die freigegebenen Felder sind änderbar, der Rest bleibt im Design der Marke.'); };
  const add = (k: BausteinKind) => { const b = bau(k); if (k === 'countdown') { b.f.until = dayPlus(3) + 'T20:00'; b.to = dayPlus(3); } list.push(b); repaint(); toast(BAUSTEINE[k].label + ' hinzugefügt. Die Folie läuft nach den Vorlagen-Folien.'); };
  const cards = list.map((b, i) => {
    const B = BAUSTEINE[b.kind], [cls, st] = bauState(b), idp = 'b' + i, title = bausteinTitle(b);
    return h('div', { class: 'bst' + (b.on ? '' : ' is-off') },
      h('div', { class: 'bst-h' }, icon(KIND_ICON[b.kind]), h('b', null, B.label + (title && title !== B.label ? ': ' + title : '')), h('span', { class: 'badge ' + cls }, st),
        h('button', { class: 'ib', title: 'Nach oben', 'aria-label': 'Nach oben: ' + B.label, disabled: i === 0, onclick: () => { list.splice(i - 1, 0, list.splice(i, 1)[0]); repaint(); } }, icon('up')),
        h('button', { class: 'ib', title: b.on ? 'Ausschalten, ohne zu löschen' : 'Wieder einschalten', 'aria-label': (b.on ? 'Ausschalten: ' : 'Einschalten: ') + B.label, 'aria-pressed': String(!b.on), onclick: () => { b.on = !b.on; repaint(); } }, icon(b.on ? 'eye' : 'eyeoff')),
        h('button', { class: 'ib', title: 'Löschen', 'aria-label': 'Löschen: ' + B.label, onclick: () => undoable(B.label + ' gelöscht.', () => { list.splice(i, 1); }) }, icon('trash'))),
      b.kind === 'design' && !vorlageVon(b) ? h('span', { class: 'small' }, 'Diese Vorlage gibt es in der Marke nicht mehr. Die Folie wird übersprungen.') : null,
      h('div', { class: 'bst-f' }, (b.kind === 'design' ? designFelder(b) : B.fields).map((fd: any) => {
        const id = idp + fd.k, isQ = /^q\d/.test(fd.k);
        if (fd.type === 'video') {
          // Video-Ebene: Film aus den Medien wählen oder gleich hochladen. Die Folie läuft so lange wie der Film.
          const filme = S.assets.filter(a => a.type === 'video'), a = b.f[fd.k] && assetById(b.f[fd.k]);
          return h('div', { class: 'wide' }, h('label', { for: id }, fd.label), h('div', { class: 'row' },
            a ? h('video', { class: 'th', src: urlOf(a.id) || '', muted: true }) : null,
            h('select', { id, style: 'flex:1;min-width:160px', onchange: (e: any) => { if (e.target.value) b.f[fd.k] = e.target.value; else delete b.f[fd.k]; repaint('#' + id); } },
              h('option', { value: '' }, filme.length ? 'Film aus den Medien wählen …' : 'Noch kein Film in den Medien'), filme.map(x => h('option', { value: x.id, selected: x.id === b.f[fd.k] }, x.name))),
            h('span', { class: 'btn sm file' }, icon('upload'), 'Film hochladen', h('input', { type: 'file', accept: 'video/mp4,video/webm', 'aria-label': fd.label + ' hochladen', onchange: (e: any) => { const ids = addFiles(e.target.files, true); if (ids[0]) { b.f[fd.k] = ids[0]; repaint(); } } }))),
            h('span', { class: 'small' }, a ? 'Läuft stumm. Die Folie dauert so lange wie der Film.' : 'Ohne Film bleibt die Fläche auf dem Bildschirm leer.'));
        }
        if (fd.type === 'bild') return h('div', { class: 'wide' }, h('span', { class: 'label' }, fd.label), h('div', { class: 'logo' }, b.f[fd.k] ? h('img', { src: b.f[fd.k], alt: '' }) : null,
          h('span', { class: 'btn sm file' }, icon('upload'), b.f[fd.k] ? 'Bild ersetzen' : 'Eigenes Bild', h('input', { type: 'file', accept: 'image/*', 'aria-label': fd.label, onchange: async (e: any) => { const f = e.target.files[0]; if (!f) return; b.f[fd.k] = await bildKlein(f); repaint(); } })),
          b.f[fd.k] ? h('button', { class: 'btn ghost sm', onclick: () => { delete b.f[fd.k]; repaint(); } }, 'Bild der Vorlage') : h('span', { class: 'small' }, 'Ohne eigenes Bild bleibt das Bild aus der Vorlage.')));
        const inp = isQ ? h('textarea', { id, rows: 2, placeholder: fd.ph || '', oninput: (e: any) => { b.f[fd.k] = e.target.value; changed(); } }, b.f[fd.k] || '')
          : h('input', { id, type: fd.type || 'text', value: b.f[fd.k] || '', placeholder: fd.ph || '', oninput: (e: any) => { b.f[fd.k] = e.target.value; if (fd.k === 'until') { b.to = (e.target.value || '').slice(0, 10) || undefined; } changed(); } });
        return h('div', { class: fd.wide ? 'wide' : null }, h('label', { for: id }, fd.label), inp);
      })),
      b.kind === 'reviews' ? h('span', { class: 'small' }, 'Tipp: Den Link zum Bewerten gibt es im Google-Unternehmensprofil unter „Rezensionen erhalten“. Später holt ShowCube Sterne und Stimmen automatisch.') : null,
      zeitraumFields(b, idp, repaint));
  });
  // Infoleiste
  const wxInfo = h('span', { class: 'small' });
  const wxUpd = () => { const r = wxFor(L); wxInfo.textContent = !L.weather ? '' : L.lat == null ? 'Ort suchen, damit das Wetter erscheint.' : r.demo ? 'Wetter für ' + L.place + '. Gerade nicht erreichbar, die Vorschau zeigt einen Beispielwert. Die Box zeigt nur echtes Wetter.' : 'Wetter live für ' + L.place + ' (Open-Meteo, ohne Konto, alle 15 Minuten).'; };
  const placeIn = h('input', { type: 'text', id: 'lPlace', value: L.place || '', placeholder: 'z. B. Ravensburg', onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); search(); } } });
  const search = async () => {
    const q = placeIn.value.trim(); if (!q) return; wxInfo.textContent = 'Suche „' + q + '“ …';
    try { const r = await findPlace(q); if (!r) { wxInfo.textContent = 'Kein Ort „' + q + '“ gefunden.'; return; } L.place = r.name; L.lat = r.lat; L.lon = r.lon; repaint(); }
    catch (e) { L.place = q; wxInfo.textContent = 'Ortssuche gerade nicht erreichbar. Bitte später noch einmal.'; changed(); }
  };
  extrasTick = wxUpd; if (!ticks.includes(runExtrasTick)) ticks.push(runExtrasTick);
  fill(p,
    h('div', { class: 'fld' }, h('h3', null, 'Zusatzfolien'), h('span', { class: 'small', style: 'margin-top:-4px' }, 'Fertige Folien, die zu jedem Betrieb passen. Mit Zeitraum laufen sie von selbst an und ab.'),
      cards.length ? cards : null,
      h('div', { class: 'bst-add' }, (Object.keys(BAUSTEINE) as BausteinKind[]).filter(k => !['design', 'anzeige', 'werbeplatz'].includes(k)).map(k => h('button', { onclick: () => add(k) }, h('b', null, icon(KIND_ICON[k]), BAUSTEINE[k].label), h('span', null, BAUSTEINE[k].desc))),
        M ? M.vorlagen.map(v => h('button', { class: 'own', onclick: () => addDesign(v) }, h('b', null, icon('brush'), v.name), h('span', null, 'Eigene Vorlage im Design von „' + M.name + '“' + (M.agentur ? ', gestaltet von ' + M.agentur : '') + '.')))
          : h('button', { class: 'own', onclick: () => go('templates') }, h('b', null, icon('palette'), 'Eigene Vorlagen'), h('span', null, 'Folien in deinem CI: Marke einrichten oder von deiner Agentur gestalten lassen.')))),
    h('div', { class: 'fld' }, h('h3', null, 'Infoleiste'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: L.on, onchange: (e: any) => { L.on = e.target.checked; repaint(); } }), 'Leiste unten einblenden: Laufband, Uhr und Wetter'),
      L.on ? [
        h('span', { class: 'small' }, 'Die Folien werden dafür etwas niedriger, nichts wird verdeckt. Ohne Laufband-Text steht dort der Name des Betriebs.'),
        h('div', null, h('label', { for: 'lTick' }, 'Laufband'), h('textarea', { id: 'lTick', rows: 2, placeholder: 'Heute frisch: … · Jeden Mittwoch: …', oninput: (e: any) => { L.ticker = e.target.value; changed(); } }, L.ticker || '')),
        h('div', { class: 'row' }, h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: L.clock, onchange: (e: any) => { L.clock = e.target.checked; repaint(); } }), 'Uhrzeit und Datum'),
          h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: L.weather, onchange: (e: any) => { L.weather = e.target.checked; repaint(); } }), 'Wetter')),
        L.weather ? h('div', { class: 'leiste-f' }, h('div', null, h('label', { for: 'lPlace' }, 'Ort fürs Wetter'), placeIn), h('button', { class: 'btn', onclick: search }, icon('search'), 'Suchen')) : null,
        wxInfo] : null),
    h('div', { class: 'fld' }, h('h3', null, 'Vorschau an einem anderen Tag'),
      h('div', { class: 'leiste-f' }, h('div', null, h('label', { for: 'pvDay' }, 'So sähe die Slideshow aus am'), h('input', { type: 'date', id: 'pvDay', value: isoDay(day), onchange: (e: any) => { day = e.target.value ? new Date(e.target.value + 'T12:00') : new Date(); renderFilm(); if (pvRef) { pvRef.idx = 0; pvRef.key = ''; } } })),
        h('button', { class: 'btn ghost', onclick: () => { day = new Date(); repaint(); } }, 'Heute')),
      h('span', { class: 'small' }, 'Nur für die Vorschau hier. Praktisch, um zu prüfen, ob das Wochenangebot am Montag wirklich weg ist.')));
  wxUpd();
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
// ---------- Marke und eigene Vorlagen ----------
// Die Marke kommt aus dem Vorlagen-Designer (designer.html): vom Kunden selbst oder von seiner Agentur.
// Übergabe zwischen Designer und Panel im selben Browser über localStorage, sonst als Datei (showcube-marke.json).
const UEBERGABE = 'showcube-marke-uebergabe', BEARBEITEN = 'showcube-marke-bearbeiten';
function setMarke(m: Marke | null, text: string) {
  undoable(text, () => { S.marke = m; });
  // Was schon läuft, bekommt die neue Marke gleich mit (Demo: Player-Tabs; Konto: beim nächsten Veröffentlichen).
  S.screens.forEach(sc => { if (isLive(sc.id)) deliver(sc); });
  if (konto && m) setTimeout(() => toast('Marke gespeichert. Veröffentliche deine Slideshows, damit die Bildschirme sie zeigen.'), 7200);
}
function openDesigner() {
  try { if (S.marke) localStorage.setItem(BEARBEITEN, JSON.stringify(S.marke)); else localStorage.removeItem(BEARBEITEN); } catch (e) {}
  window.open(DESIGNER_URL + '?von=panel', '_blank', 'noopener');
}
async function markeLaden(f: File) {
  try { const m = markeAusDatei(await f.text()); setMarke(m, 'Marke „' + m.name + '“ übernommen' + (m.agentur ? ', gestaltet von ' + m.agentur : '') + '.'); }
  catch (e) { toast('Konnte das Markenpaket nicht lesen: ' + (e as Error).message); }
}
function markeSpeichern() {
  const a = h('a', { href: URL.createObjectURL(markeAlsDatei(S.marke)), download: 'showcube-marke.json' });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
// Aus dem Designer: panel.html?marke übernimmt das dort gespeicherte Markenpaket.
function markeUebergabe() {
  if (!new URLSearchParams(location.search).has('marke')) return;
  history.replaceState(null, '', location.pathname + location.hash);
  let m: Marke | null = null; try { m = markeAusDatei(localStorage.getItem(UEBERGABE) || ''); localStorage.removeItem(UEBERGABE); } catch (e) {}
  if (!m) return;
  if (!konto && !demo) demoStart();
  go('templates'); setMarke(m, 'Marke „' + m.name + '“ aus dem Designer übernommen.');
}
function openPartner() {
  const err = h('span', { class: 'small', style: 'color:var(--bad)', role: 'alert' });
  fill($('partnerForm'),
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dpaTitle' }, 'Agentur einladen'), h('button', { class: 'btn icon ghost', type: 'button', onclick: (e: any) => e.currentTarget.closest('dialog').close(), 'aria-label': 'Schließen' }, icon('x'))),
    h('p', { class: 'small' }, 'Deine Werbeagentur oder dein Grafiker gestaltet Marke und Vorlagen für dich. Sie sieht keine Bildschirme, keine Preise und veröffentlicht nichts. Du entscheidest, was auf die Bildschirme kommt.'),
    h('div', { class: 'grid2' },
      h('div', null, h('label', { for: 'paName' }, 'Agentur'), h('input', { type: 'text', id: 'paName', placeholder: 'z. B. Werbeagentur Nord' })),
      h('div', null, h('label', { for: 'paMail' }, 'E-Mail'), h('input', { type: 'email', id: 'paMail', placeholder: 'kontakt@agentur.de' }))),
    h('ul', { class: 'rights' }, h('li', null, icon('check'), 'Darf: Logo, Farben, Schriften, Übergänge und eigene Vorlagen gestalten'), h('li', null, icon('check'), 'Darf: festlegen, welche Felder du selbst ausfüllst'), h('li', { class: 'no' }, icon('x'), 'Darf nicht: Bildschirme steuern, veröffentlichen, Abo ändern')),
    h('p', { class: 'small' }, 'Vorschau: Die Einladung wird noch nicht verschickt. Bis dahin schickt die Agentur ihr Markenpaket als Datei, du lädst es hier unter „Markenpaket laden“.'),
    err, h('button', { class: 'btn primary lg', value: 'ok' }, 'Einladen'));
  $('partnerForm').onsubmit = (e: SubmitEvent) => {
    if ((e.submitter as any)?.value !== 'ok') return;
    const name = $('paName').value.trim(), email = $('paMail').value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { e.preventDefault(); err.textContent = 'Bitte eine gültige E-Mail eintragen.'; return; }
    undoable((name || email) + ' vorgemerkt. Die Einladung geht raus, sobald Partner-Zugänge freigeschaltet sind.', () => { S.partner = [...(S.partner || []).filter(x => x.email !== email), { name: name || email.split('@')[1], email, am: Date.now() }]; });
  };
  $('dlgPartner').showModal(); $('paName').focus();
}
function markeKarte(): HTMLElement {
  const m = S.marke, datei = h('span', { class: 'btn sm file' }, icon('upload'), 'Markenpaket laden', h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Markenpaket laden', onchange: (e: any) => { const f = e.target.files[0]; if (f) markeLaden(f); } }));
  const partner = S.partner || [];
  const agentur = h('div', { class: 'partner' },
    h('div', { class: 'row' }, h('h3', null, 'Agentur'), h('span', { style: 'flex:1' }), h('button', { class: 'btn sm', onclick: openPartner }, icon('user'), 'Agentur einladen')),
    partner.length ? partner.map(pa => h('div', { class: 'row' }, h('b', null, pa.name), h('span', { class: 'small' }, pa.email), h('span', { class: 'badge warn' }, 'vorgemerkt'), h('span', { style: 'flex:1' }),
      h('button', { class: 'ib', 'aria-label': 'Entfernen: ' + pa.name, title: 'Entfernen', onclick: () => undoable(pa.name + ' entfernt.', () => { S.partner = partner.filter(x => x !== pa); }) }, icon('trash'))))
      : h('span', { class: 'small' }, 'Lass deine Werbeagentur Marke und Vorlagen gestalten. Du füllst danach nur noch Texte, Preise und Bilder aus.'));
  if (!m) return h('section', { class: 'card marke leer' },
    h('div', { class: 'mk-h' }, h('div', { class: 'mk-ic' }, icon('palette')), h('div', null, h('h2', null, 'Alles im Design deiner Marke'), h('p', { class: 'small' }, 'Logo hochladen, Farben kommen automatisch aus dem Logo, Schrift aussuchen. Danach erscheinen alle Vorlagen, Bausteine und Übergänge in deinem CI. Eigene Vorlagen mit Animationen gestaltest du im Vorlagen-Designer, selbst oder mit deiner Agentur.'))),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: openDesigner }, icon('brush'), 'Marke einrichten'), datei),
    agentur);
  const tvs = m.vorlagen.map(v => {
    const cfg = { ...baseCfg(null), dur: 6, extras: [bau('design', { vorlage: v.id, titel: v.name })] }, t = tv('land', { cfg: () => cfg, period: () => 'day' });
    return h('div', { class: 'mk-v' }, h('div', { class: 'stage', style: 'border-radius:10px' }, t.frame), h('span', null, v.name));
  });
  return h('section', { class: 'card marke' },
    h('div', { class: 'mk-h' },
      m.logo ? h('img', { class: 'mk-logo', src: m.logo, alt: 'Logo' }) : h('div', { class: 'mk-ic' }, icon('palette')),
      h('div', null, h('h2', null, m.name), h('p', { class: 'small' }, 'Deine Marke' + (m.agentur ? ', gestaltet von ' + m.agentur : '') + '. Gilt für alle Slideshows, einzeln abschaltbar.')),
      h('span', { style: 'flex:1' }),
      h('div', { class: 'mchip' }, [m.farben.primaer, m.farben.zweit, m.farben.dunkel, m.farben.hell].map(col => h('i', { style: 'background:' + col, title: col })))),
    h('div', { class: 'mk-facts small' }, h('span', null, h('b', null, 'Titel: '), m.schrift.titel.data ? 'eigene Schrift' : m.schrift.titel.name), h('span', null, h('b', null, 'Text: '), m.schrift.text.data ? 'eigene Schrift' : m.schrift.text.name),
      h('span', null, h('b', null, 'Übergang: '), ({ blende: 'Überblenden', schieben: 'Schieben', zoom: 'Zoomen', hart: 'Harter Schnitt' } as any)[m.bewegung.uebergang])),
    tvs.length ? [h('h3', null, 'Eigene Vorlagen'), h('div', { class: 'mk-vs' }, tvs), h('p', { class: 'small' }, 'Einfügen im Editor unter „Bausteine“. Dort füllst du nur die freigegebenen Felder aus.')]
      : h('p', { class: 'small' }, 'Noch keine eigenen Vorlagen. Im Designer gibt es Startpunkte wie „Angebot groß“ oder „Termin und QR“.'),
    h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: openDesigner }, icon('brush'), 'Im Designer bearbeiten'), datei,
      h('button', { class: 'btn ghost sm', onclick: markeSpeichern }, icon('download'), 'Als Datei'),
      h('button', { class: 'btn ghost sm danger', onclick: () => setMarke(null, 'Marke entfernt. Die Vorlagen zeigen wieder die ShowCube-Farben.') }, 'Entfernen')),
    agentur);
}
function renderTemplates(v: HTMLElement) {
  const use = (k: string | null, name: string) => { const sh = newShow(k, name); S.shows.push(sh); save(); tab = k ? 'content' : 'media'; go('shows', sh.id); toast('Neue Slideshow angelegt. Texte anpassen, dann veröffentlichen.'); setTimeout(() => { const n = $('sName'); if (n) { n.focus(); n.select(); } }, 60); };
  v.append(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Vorlagen'), h('p', null, 'Such dir einen Start aus. Du trägst nur Texte und Preise ein, Gestaltung und Lesbarkeit übernimmt die Vorlage.'))),
    markeKarte(),
    h('div', { class: 'tpls' },
      Object.entries(TEMPLATES).map(([k, T]: any) => {
        const cfg = baseCfg(k), t = tv('land', { cfg: () => cfg, period: () => 'day' }), short = T.label.split(':')[1]?.trim() || T.label;
        return h('article', { class: 'card tpl' }, h('div', { class: 'stage' }, t.frame), h('div', { class: 'body' }, h('h2', null, short), h('p', null, TPL_TEXT[k] || ''), h('div', { class: 'row' }, h('span', { class: 'badge' }, T.label.split(':')[0]), h('span', { style: 'flex:1' }), h('button', { class: 'btn primary sm', onclick: () => use(k, short) }, 'Verwenden'))));
      }),
      h('article', { class: 'card tpl' }, h('div', { class: 'blank' }, icon('media')), h('div', { class: 'body' }, h('h2', null, 'Nur eigene Medien'), h('p', null, 'Leere Slideshow für fertige Bilder und Videos, zum Beispiel vom Grafiker.'), h('div', { class: 'row' }, h('span', { style: 'flex:1' }), h('button', { class: 'btn sm', onclick: () => use(null, 'Neue Slideshow') }, 'Leer starten')))),
      [['Speisekarte über mehrere Bildschirme', 'Große Preisliste, auf zwei oder drei Fernseher verteilt. Der Prototyp steht, der Einbau folgt.'], ['Wartezimmer', 'Praxis-Infos, Öffnungszeiten und Hinweise. Noch nicht gebaut.']].map(([tt, pp]) =>
        h('article', { class: 'card tpl soon' }, h('div', { class: 'body' }, h('div', { class: 'row' }, h('h2', null, tt), h('span', { class: 'badge' }, 'bald')), h('p', null, pp))))));
}

// ---------- Partner-Slots: Werbepartner ----------
// Eingeschaltet unter „Einstellungen“. Dann gibt es den Bereich „Partner“: Partner anlegen, Folie gestalten,
// Takt und Laufzeit festlegen, Bericht-Link verschicken. Kein Geld über ShowCube, der Laden rechnet selbst ab.
const W = () => S.werbung;
// Wie viele Minuten am Tag zeigt diese Slideshow etwas? (ohne Nachtruhe)
function sendeMinuten(c: Cfg) { let n = 0; for (let m = 0; m < 1440; m++) if (periodAt(c, m) !== 'off') n++; return n; }
const minCache = new Map<string, number>();
function sendeMin(c: Cfg) { const k = [c.offOn, c.offFrom, c.offTo].join(); if (!minCache.has(k)) minCache.set(k, sendeMinuten(c)); return minCache.get(k); }
const reichweite = (c: Cfg, alle = 5) => 'Bei jeder ' + alle + '. Folie läuft deine Anzeige hier rund ' + rund(proTag(sendeMin(c), c.dur, alle)).toLocaleString('de-DE') + '-mal am Tag.';
const fuerShow = (p: Werbepartner, showId: string) => !p.shows.length || p.shows.includes(showId);
const alsSlot = (p: Werbepartner): WerbeSlot => ({ id: p.id, name: p.name, alle: p.alle, when: p.when, from: p.from, to: p.to, days: p.days, folie: p.folie });
// Was von den Partner-Slots im Paket einer Slideshow landet. null = Partner-Slots aus.
function werbungFor(showId: string, c?: Cfg): WerbungCfg | null {
  const w = W(); if (!w || !w.on) return null;
  const partner = w.partner.filter(p => p.on && fuerShow(p, showId)).map(alsSlot);
  let frei = w.frei.on && fuerShow(w.frei, showId) ? alsSlot(w.frei) : null;
  if (frei && c) frei = { ...frei, folie: { ...frei.folie, f: { ...frei.folie.f, reichweite: reichweite(c) } } };
  return partner.length || frei ? { plaetze: w.plaetze, partner, frei } : null;
}
// Nach jeder Änderung an Partnern: neuer Stand für alle veröffentlichten Slideshows, damit die Boxen ihn holen.
function werbungSenden() {
  S.shows.filter(sh => sh.pub).forEach(sh => {
    const to = S.screens.filter(s => s.show === sh.id);
    sh.revision++; sh.published = Date.now(); to.forEach(deliver); if (konto) offenePakete.add(sh.id);
  });
  save();
}
function werbeAenderung(text: string, change: () => void) {
  const before = JSON.stringify(S.werbung); change(); werbungSenden(); render();
  toast(text, () => { S.werbung = JSON.parse(before); werbungSenden(); render(); toast('Rückgängig gemacht.'); });
}
function partnerState(p: Werbepartner): [string, string] {
  if (!p.on) return ['', 'pausiert'];
  if (expired(p)) return ['bad', 'abgelaufen'];
  if (p.from && isoDay(new Date()) < p.from) return ['warn', 'ab ' + zeitraumText({ from: p.from }).replace('ab ', '')];
  if (!activeOn(p, new Date())) return ['warn', 'heute nicht'];
  return ['ok', 'läuft'];
}
const taktText = (n: number) => 'jede ' + n + '. Folie';
const showsText = (p: Werbepartner) => !p.shows.length ? 'alle Slideshows' : p.shows.map(id => showById(id)).filter(Boolean).map(x => '„' + x.name + '“').join(', ') || 'keine Slideshow';
// Eine Folie allein, für Vorschauen im Partner-Bereich. Name und Farbe kommen aus der ersten Slideshow des Ladens.
function folienCfg(b: () => Baustein): () => Cfg {
  const base = { ...(S.shows[0] ? S.shows[0].cfg : baseCfg(null)), tpl: null as string | null, media: [] as MediaUse[], leiste: { ...LEISTE, on: false }, dur: 6 };
  return () => ({ ...base, extras: [b()] });
}
// Einblendungen eines Partners: von den Boxen gezählt (letzte 62 Tage), sonst aus Zeitplan und Takt hochgerechnet.
function hochgerechnet(c: Cfg, showId: string, d: Date, id: string, bis = 1440) {
  if ((c.offDays || []).includes(d.getDay())) return 0;
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12), mins = { day: 0, eve: 0 };
  for (let m = 0; m < bis; m++) { const p = periodAt(c, m); if (p !== 'off') mins[p]++; }
  let n = 0;
  (['day', 'eve'] as const).forEach(p => { if (!mins[p]) return; const list = slidesOf(c, p, showId, at); if (!list.length) return; const k = list.filter(it => it.partner === id).length; n += mins[p] * 60 / (Math.max(3, c.dur) * list.length) * k; });
  return Math.round(n);
}
function partnerZahlen(p: Werbepartner) {
  const tage = new Map<string, number>(), bs: { sc: Screen; n: number }[] = []; let echt = !!konto, alleEcht = true;
  const heute = isoDay(new Date()), start = p.from || isoDay(new Date(p.seit || Date.now()));
  S.screens.filter(sc => fuerShow(p, sc.show) && showById(sc.show)).forEach(sc => {
    const sh = showById(sc.show), c = sh.pub || sh.cfg, l = live.get(sc.id), hist = l && l.beat && l.beat.werbung;
    let n = 0;
    if (hist) { Object.entries(hist as Record<string, Record<string, number>>).forEach(([d, x]) => { const v = x[p.id] || 0; if (v) { tage.set(d, (tage.get(d) || 0) + v); n += v; } }); }
    else {
      alleEcht = false;
      const d = new Date(start + 'T12:00'), ende = p.to && p.to < heute ? p.to : heute;
      for (let i = 0; i < 62 && isoDay(d) <= ende; i++, d.setDate(d.getDate() + 1)) {
        const k = isoDay(d), now = new Date(), bis = k === heute ? now.getHours() * 60 + now.getMinutes() : 1440;
        const v = isOn(sc) || k !== heute ? hochgerechnet(c, sc.show, d, p.id, bis) : 0;
        if (v) { tage.set(k, (tage.get(k) || 0) + v); n += v; }
      }
    }
    bs.push({ sc, n });
  });
  // Nur mit Konto und nur wenn jede Box selbst gezählt hat, heißt es im Bericht „gezählt“. Die Demo ist immer Beispielwert.
  echt = echt && alleEcht && bs.length > 0;
  const summe = [...tage.values()].reduce((a, b) => a + b, 0);
  return { tage, bs, echt, summe, heute: tage.get(heute) || 0 };
}
function berichtFuer(p: Werbepartner): string {
  const z = partnerZahlen(p), sh = S.shows.find(x => fuerShow(p, x.id)), c = sh ? sh.pub || sh.cfg : baseCfg(null);
  const cv = stillOf(folienCfg(() => p.folie)(), 320, 180, 'day', 0);
  const betrieb = (konto && konto.name) || (z.bs[0] && z.bs[0].sc.place) || (S.marke && S.marke.name) || c.name || 'deinem Laden';
  const b: Bericht = { v: 1, partner: p.name, betrieb, von: p.from, bis: p.to, takt: p.alle, sek: c.dur, stand: new Date().toISOString(), echt: z.echt,
    tage: [...z.tage.entries()].sort((a, b2) => a[0] < b2[0] ? -1 : 1), bildschirme: z.bs.map(x => [x.sc.name, x.sc.place, x.n]), bild: cv.toDataURL('image/jpeg', .62) };
  return new URL(BERICHT_URL, location.href).href + '#' + berichtKodieren(b);
}
function berichtKopieren(p: Werbepartner) {
  const url = berichtFuer(p);
  (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(
    () => toast('Bericht-Link für ' + p.name + ' kopiert. Schick ihn per Mail oder WhatsApp, ein Konto braucht ' + p.name + ' nicht.'),
    () => { window.open(url, '_blank', 'noopener'); toast('Kopieren ging nicht. Der Bericht ist im neuen Tab offen, dort die Adresse kopieren.'); });
}

function renderWerbung(v: HTMLElement) {
  const w = W(), now = new Date();
  const zahlen = new Map(w.partner.map(p => [p.id, partnerZahlen(p)]));
  const belegt = w.partner.filter(p => p.on && !expired(p) && !(p.from && isoDay(now) < p.from)).length;
  const heute = [...zahlen.values()].reduce((a, z) => a + z.heute, 0);
  v.append(h('div', { class: 'head' }, h('div', null, h('h1', null, 'Werbepartner'),
    h('p', null, 'Vermiete Sendezeit auf deinen Bildschirmen an Geschäfte aus der Nachbarschaft. Preis und Laufzeit machst du mit ihnen aus und rechnest selbst ab. ShowCube spielt die Anzeigen ein und zählt mit.')),
    h('button', { class: 'btn primary', onclick: () => openWerbepartner(null) }, icon('plus'), 'Partner hinzufügen')));
  v.append(h('div', { class: 'wstats' },
    h('div', { class: 'card' }, h('span', { class: 'small' }, 'Plätze belegt'), h('b', null, belegt + ' von ' + w.plaetze)),
    h('div', { class: 'card' }, h('span', { class: 'small' }, 'Heute eingeblendet'), h('b', null, heute.toLocaleString('de-DE') + '×')),
    h('div', { class: 'card' }, h('span', { class: 'small' }, 'Freie Plätze bewerben'), h('b', null, w.frei.on ? (belegt < w.plaetze ? 'läuft' : 'pausiert, alles belegt') : 'aus'))));
  const list = h('div', { class: 'wlist' });
  w.partner.forEach(p => {
    const z = zahlen.get(p.id), [cls, st] = partnerState(p), t = tv('land', { cfg: folienCfg(() => p.folie), period: () => 'day' });
    list.append(h('article', { class: 'card wcard' + (p.on ? '' : ' is-off') },
      h('div', { class: 'stage' }, t.frame),
      h('div', { class: 'body' },
        h('div', { class: 'row' }, h('h2', null, p.name), h('span', { class: 'badge ' + cls }, st)),
        h('span', { class: 'small' }, [taktText(p.alle), ({ always: '', day: 'tagsüber', eve: 'abends' } as any)[p.when], zeitraumText(p) || 'ohne Ende', showsText(p)].filter(Boolean).join(' · ')),
        h('div', { class: 'wnum' }, h('span', null, h('b', null, z.heute.toLocaleString('de-DE') + '×'), ' heute'), h('span', null, h('b', null, z.summe.toLocaleString('de-DE') + '×'), ' seit Start'),
          h('span', { class: 'small' }, z.echt ? 'von den Boxen gezählt' : 'hochgerechnet aus dem Zeitplan')),
        p.abmachung ? h('span', { class: 'small note' }, icon('coins'), h('span', null, 'Abmachung: ' + p.abmachung)) : null,
        h('div', { class: 'foot' },
          h('button', { class: 'btn sm', onclick: () => openWerbepartner(p) }, 'Bearbeiten'),
          h('button', { class: 'btn sm', title: 'Link zum Bericht kopieren, ohne Anmeldung lesbar', onclick: () => berichtKopieren(p) }, icon('link'), 'Bericht-Link'),
          h('a', { class: 'btn ghost sm', href: '#werbung', onclick: (e: Event) => { e.preventDefault(); window.open(berichtFuer(p), '_blank', 'noopener'); } }, 'Ansehen', icon('ext')),
          h('span', { style: 'flex:1' }),
          h('button', { class: 'ib', title: p.on ? 'Pausieren' : 'Wieder einschalten', 'aria-label': (p.on ? 'Pausieren: ' : 'Einschalten: ') + p.name, 'aria-pressed': String(!p.on), onclick: () => werbeAenderung(p.on ? p.name + ' pausiert.' : p.name + ' läuft wieder.', () => { p.on = !p.on; }) }, icon(p.on ? 'eye' : 'eyeoff')),
          h('button', { class: 'ib', title: 'Löschen', 'aria-label': 'Löschen: ' + p.name, onclick: () => werbeAenderung(p.name + ' entfernt.', () => { w.partner = w.partner.filter(x => x !== p); }) }, icon('trash'))))));
  });
  if (!w.partner.length) list.append(h('div', { class: 'empty' }, h('b', null, 'Noch keine Werbepartner.'),
    h('span', null, 'Die Folie „Werbeplatz frei“ wirbt auf deinen Bildschirmen schon um die ersten. Fragt jemand an, legst du ihn hier an.'),
    h('button', { class: 'btn primary', onclick: () => openWerbepartner(null) }, icon('plus'), 'Ersten Partner hinzufügen')));
  v.append(list);
  // Freier Platz: der Bildschirm wirbt selbst um neue Partner.
  const f = w.frei, ft = tv('land', { cfg: folienCfg(() => ({ ...f.folie, f: { ...f.folie.f, reichweite: reichweite(S.shows[0] ? S.shows[0].pub || S.shows[0].cfg : baseCfg(null)) } })), period: () => 'day' });
  const re = () => { save(); werbungSenden(); };
  v.append(h('section', { class: 'card wfrei' },
    h('div', { class: 'stage' }, ft.frame),
    h('div', { class: 'body' },
      h('div', { class: 'row' }, h('h2', null, 'Werbeplatz frei'), h('span', { class: 'badge ' + (f.on ? 'ok' : '') }, f.on ? 'an' : 'aus')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: f.on, onchange: (e: any) => werbeAenderung(e.target.checked ? 'Freie Plätze werden beworben.' : 'Folie „Werbeplatz frei“ ausgeschaltet.', () => { f.on = e.target.checked; }) }), 'Freie Plätze auf dem Bildschirm bewerben'),
      h('span', { class: 'small' }, 'Läuft nur, solange weniger Partner gebucht sind, als du Plätze hast. Die Zahl, wie oft eine Anzeige am Tag läuft, rechnet ShowCube aus deinem Zeitplan.'),
      h('div', { class: 'grid2' },
        h('div', null, h('label', { for: 'wfPl' }, 'Plätze insgesamt'), h('select', { id: 'wfPl', onchange: (e: any) => werbeAenderung('Jetzt ' + e.target.value + ' Plätze.', () => { w.plaetze = +e.target.value; }) }, [1, 2, 3, 4, 5, 6].map(n => h('option', { value: String(n), selected: w.plaetze === n }, String(n))))),
        h('div', null, h('label', { for: 'wfTakt' }, 'Wie oft'), h('select', { id: 'wfTakt', onchange: (e: any) => werbeAenderung('Gespeichert.', () => { f.alle = +e.target.value; }) }, TAKTE.map(n => h('option', { value: String(n), selected: f.alle === n }, taktText(n)))))),
      h('div', { class: 'bst-f' }, BAUSTEINE.werbeplatz.fields.map(fd => h('div', { class: fd.wide ? 'wide' : null }, h('label', { for: 'wf' + fd.k }, fd.label),
        h('input', { id: 'wf' + fd.k, type: fd.type || 'text', value: f.folie.f[fd.k] || '', placeholder: fd.ph || '', oninput: (e: any) => { f.folie.f[fd.k] = e.target.value; save(); }, onchange: re })))))));
  v.append(h('section', { class: 'card whow' }, h('h2', null, 'So verdient dein Bildschirm mit'),
    h('ol', null,
      h('li', null, h('b', null, 'Platz anbieten. '), 'Die Folie „Werbeplatz frei“ läuft zwischen deinen Inhalten und zeigt einen QR-Code zu dir.'),
      h('li', null, h('b', null, 'Partner anlegen. '), 'Fragt der Blumenladen von nebenan, legst du ihn hier an: Anzeige gestalten oder sein Bild hochladen, Takt und Laufzeit wählen.'),
      h('li', null, h('b', null, 'Bericht schicken. '), 'Mit „Bericht-Link“ bekommt dein Partner seine Zahlen ohne Konto. Das ist dein Argument fürs nächste Mal.'),
      h('li', null, h('b', null, 'Selbst abrechnen. '), 'Preis machst du direkt mit dem Partner aus. ShowCube nimmt keine Provision und verschickt keine Rechnungen.'))));
}

// Partner anlegen oder bearbeiten (Seitenblatt mit Vorschau).
let wEdit: { p: Werbepartner; neu: boolean } | null = null;
function openWerbepartner(p: Werbepartner | null) {
  wEdit = p ? { p: clone(p), neu: false } : { p: werbePartner('', bau('anzeige', { firma: '', title: '', text: '', url: '' }), { from: isoDay(new Date()), to: dayPlus(30) }), neu: true };
  drawWerbeDlg(); const d = $('dlgWerbung'); if (!d.open) d.showModal();
  if (wEdit.neu) setTimeout(() => { const n = $('wpName'); if (n) n.focus(); }, 30);
}
function drawWerbeDlg() {
  const e = wEdit, p = e.p, b = $('dwBody'), M = S.marke;
  const redraw = () => drawWerbeDlg(), t = tv('land', { cfg: folienCfg(() => p.folie), period: () => 'day' });
  const err = h('span', { class: 'small', style: 'color:var(--bad)', role: 'alert' }), hint = h('span', { class: 'small' });
  const hintUpd = () => {
    const shows = S.shows.filter(sh => fuerShow(p, sh.id) && S.screens.some(sc => sc.show === sh.id));
    hint.textContent = !shows.length ? 'Die gewählten Slideshows laufen noch auf keinem Bildschirm.' : 'Das sind ' + shows.map(sh => { const c = sh.pub || sh.cfg; return 'auf „' + sh.name + '“ etwa ' + rund(proTag(sendeMin(c), c.dur, p.alle)).toLocaleString('de-DE') + '-mal am Tag'; }).join(', ') + ', je Bildschirm.';
  };
  hintUpd();
  const art = p.folie.kind;
  const kinds: [string, string, () => void][] = [['anzeige', 'Anzeige', () => { p.folie = bau('anzeige', { firma: p.name, title: '', text: '', url: '' }); }],
    ...(M ? M.vorlagen.map(vo => ['v:' + vo.id, vo.name, () => { p.folie = bau('design', { vorlage: vo.id, titel: vo.name }); }] as [string, string, () => void]) : [])];
  const cur = art === 'design' ? 'v:' + p.folie.f.vorlage : 'anzeige';
  const fields: any[] = art === 'design' ? designFelder(p.folie, false) : [...BAUSTEINE.anzeige.fields, { k: 'bild', label: 'Bild', type: 'bild', wide: true }];
  const swatches = ['#c2185b', '#d9482b', '#e09a1a', '#2f7d32', '#1f6f8b', '#3b3f9c', '#5d4037', '#212121'];
  fill(b,
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dwTitle' }, e.neu ? 'Neuer Werbepartner' : p.name), h('button', { class: 'btn icon ghost', 'aria-label': 'Schließen', onclick: () => $('dlgWerbung').close() }, icon('x'))),
    h('div', { class: 'stage round' }, t.frame),
    h('div', { class: 'fld' }, h('h3', null, 'Partner'),
      h('div', { class: 'grid2' },
        h('div', null, h('label', { for: 'wpName' }, 'Name'), h('input', { type: 'text', id: 'wpName', value: p.name, placeholder: 'z. B. Blumen Berger', oninput: (ev: any) => { const alt = p.name; p.name = ev.target.value; if (p.folie.kind === 'anzeige' && (p.folie.f.firma || '') === alt) { p.folie.f.firma = p.name; const fi = $('wpffirma'); if (fi) fi.value = p.name; } } })),
        h('div', null, h('label', { for: 'wpKontakt' }, 'Ansprechpartner'), h('input', { type: 'text', id: 'wpKontakt', value: p.kontakt || '', placeholder: 'Name, Telefon', oninput: (ev: any) => { p.kontakt = ev.target.value; } }))),
      h('div', null, h('label', { for: 'wpAb' }, 'Abmachung (nur für dich)'), h('input', { type: 'text', id: 'wpAb', value: p.abmachung || '', placeholder: 'z. B. 35 € im Monat, bar', oninput: (ev: any) => { p.abmachung = ev.target.value; } })),
      h('span', { class: 'small' }, 'Name, Kontakt und Abmachung sieht nur dein Konto. Abgerechnet wird direkt zwischen euch, nicht über ShowCube.')),
    h('div', { class: 'fld' }, h('h3', null, 'Folie'),
      kinds.length > 1 ? h('div', { class: 'seg wrap', role: 'group', 'aria-label': 'Art der Folie' }, kinds.map(([k, l, run]) => h('button', { 'aria-pressed': String(k === cur), onclick: () => { if (k !== cur) { run(); redraw(); } } }, k === 'anzeige' ? l : 'Vorlage: ' + l)))
        : h('span', { class: 'small' }, 'Eigene Vorlagen aus dem Vorlagen-Designer stehen hier zur Wahl, sobald deine Marke eingerichtet ist.'),
      h('div', { class: 'bst-f' }, fields.map((fd: any) => {
        const id = 'wpf' + fd.k;
        if (fd.type === 'bild') return h('div', { class: 'wide' }, h('span', { class: 'label' }, fd.label), h('div', { class: 'logo' }, p.folie.f[fd.k] ? h('img', { src: p.folie.f[fd.k], alt: '' }) : null,
          h('span', { class: 'btn sm file' }, icon('upload'), p.folie.f[fd.k] ? 'Bild ersetzen' : 'Bild hochladen', h('input', { type: 'file', accept: 'image/*', 'aria-label': fd.label, onchange: async (ev: any) => { const fl = ev.target.files[0]; if (!fl) return; p.folie.f[fd.k] = await bildKlein(fl, 1280); redraw(); } })),
          p.folie.f[fd.k] ? h('button', { class: 'btn ghost sm', onclick: () => { delete p.folie.f[fd.k]; redraw(); } }, 'Bild entfernen') : null),
          art === 'anzeige' ? h('span', { class: 'small' }, 'Hat dein Partner eine fertige Anzeige? Bild hochladen und die Überschrift leer lassen, dann zeigt die Folie nur das Bild.') : null);
        return h('div', { class: fd.wide ? 'wide' : null }, h('label', { for: id }, fd.label), h('input', { id, type: fd.type || 'text', value: p.folie.f[fd.k] || '', placeholder: fd.ph || '', oninput: (ev: any) => { p.folie.f[fd.k] = ev.target.value; } }));
      })),
      art === 'anzeige' ? h('div', null, h('span', { class: 'label' }, 'Farbe des Partners'), h('div', { class: 'swatches' }, swatches.map(col => h('button', { style: 'background:' + col, 'aria-label': 'Farbe ' + col, 'aria-pressed': String(p.folie.f.farbe === col), onclick: () => { p.folie.f.farbe = col; redraw(); } })),
        h('label', { class: 'picker' + (swatches.includes(p.folie.f.farbe) ? '' : ' on'), title: 'Eigene Farbe', style: '--c:' + (p.folie.f.farbe || '') }, h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(p.folie.f.farbe || '') ? p.folie.f.farbe : '#c2185b', 'aria-label': 'Eigene Farbe', oninput: (ev: any) => { p.folie.f.farbe = ev.target.value; } })))) : null),
    h('div', { class: 'fld' }, h('h3', null, 'Sendezeit'),
      h('div', null, h('label', { for: 'wpTakt' }, 'Wie oft'), h('select', { id: 'wpTakt', onchange: (ev: any) => { p.alle = +ev.target.value; hintUpd(); } }, TAKTE.map(n => h('option', { value: String(n), selected: p.alle === n }, taktText(n))))),
      hint,
      zeitraumFields(p, 'wpz', () => redraw())),
    h('div', { class: 'fld' }, h('h3', null, 'Auf welchen Slideshows'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !p.shows.length, onchange: (ev: any) => { p.shows = ev.target.checked ? [] : S.shows.slice(0, 1).map(x => x.id); redraw(); } }), 'Auf allen Slideshows'),
      p.shows.length ? S.shows.map(sh => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: p.shows.includes(sh.id), onchange: (ev: any) => { p.shows = ev.target.checked ? [...p.shows, sh.id] : p.shows.filter(x => x !== sh.id); if (!p.shows.length) p.shows = []; hintUpd(); } }), sh.name,
        h('span', { class: 'small' }, ' · ' + (S.screens.filter(sc => sc.show === sh.id).map(sc => sc.name).join(', ') || 'auf keinem Bildschirm')))) : null),
    err,
    h('div', { class: 'row' }, h('button', { class: 'btn primary lg', onclick: () => {
      p.name = p.name.trim(); if (!p.name) { err.textContent = 'Bitte einen Namen für den Partner eintragen.'; $('wpName').focus(); return; }
      if (p.from && p.to && p.to < p.from) { err.textContent = 'Das Ende liegt vor dem Start.'; return; }
      $('dlgWerbung').close();
      werbeAenderung(e.neu ? p.name + ' angelegt. Die Anzeige geht gleich auf die Bildschirme.' : p.name + ' gespeichert.', () => { const w = W(); w.partner = e.neu ? [...w.partner, p] : w.partner.map(x => x.id === p.id ? p : x); });
    } }, e.neu ? 'Partner anlegen' : 'Speichern'), h('button', { class: 'btn lg ghost', onclick: () => $('dlgWerbung').close() }, 'Abbrechen')));
}
$('dlgWerbung').addEventListener('click', (e: MouseEvent) => { if (e.target === $('dlgWerbung')) $('dlgWerbung').close(); });

// ---------- Einstellungen ----------
function openSettings() {
  const w = W();
  fill($('settingsForm'),
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dsetTitle' }, 'Einstellungen'), h('button', { class: 'btn icon ghost', type: 'button', onclick: () => $('dlgSettings').close(), 'aria-label': 'Schließen' }, icon('x'))),
    h('h3', null, 'Zusatzfunktionen'),
    h('label', { class: 'opt' }, h('input', { type: 'checkbox', id: 'setWerbung', checked: w.on, onchange: (e: any) => {
      w.on = e.target.checked; werbungSenden(); $('dlgSettings').close();
      if (w.on) { go('werbung'); toast('Partner-Slots sind an. Unter „Partner“ legst du Werbepartner an.'); } else { if (view === 'werbung') go('screens'); else render(); toast('Partner-Slots sind aus. Die Bildschirme zeigen keine Partner-Folien mehr.'); }
    } }),
      h('span', null, h('b', null, 'Partner-Slots: Dein Bildschirm verdient mit'),
        h('span', { class: 'small' }, 'Vermiete Sendezeit an Geschäfte aus der Nachbarschaft. Ihre Anzeigen laufen zwischen deinen Folien, jeder Partner bekommt einen Bericht-Link mit seinen Zahlen. Abrechnen tust du selbst. Ausgeschaltet ist davon nichts zu sehen.'))),
    h('button', { class: 'btn lg', value: 'ok' }, 'Fertig'));
  $('dlgSettings').showModal();
}
$('settings').prepend(icon('gear')); $('settings').onclick = openSettings;
$('dlgSettings').addEventListener('click', (e: MouseEvent) => { if (e.target === $('dlgSettings')) $('dlgSettings').close(); });

// ---------- Befehlsleiste (Strg + K) ----------
let cmdItems: { label: string; hint: string; ic: string; run: () => void }[] = [], cmdSel = 0;
function openCmd() {
  if (!konto && !demo) return;
  const all = [
    ...views().map(([k, l, ic]) => ({ label: k === 'werbung' ? 'Werbepartner' : l, hint: 'Bereich', ic, run: () => go(k) })),
    { label: 'Einstellungen', hint: 'Partner-Slots und mehr', ic: 'gear', run: openSettings },
    { label: 'Sofort-Hinweis senden', hint: 'Befehl', ic: 'bolt', run: openNotice }, { label: 'Bildschirm koppeln', hint: 'Befehl', ic: 'plus', run: openPair },
    { label: 'Neue Slideshow', hint: 'Befehl', ic: 'plus', run: () => go('templates') }, { label: 'Vorlagen-Designer öffnen', hint: 'Marke und eigene Vorlagen', ic: 'brush', run: openDesigner }, { label: 'Hell oder dunkel umschalten', hint: 'Befehl', ic: 'moon', run: toggleTheme },
    ...(konto && konto.admin ? [{ label: 'Betrieb öffnen', hint: 'Admin', ic: 'shop', run: openBetriebe }] : []),
    ...(sb ? [konto ? { label: 'Abmelden', hint: 'Konto · ' + konto.email, ic: 'user', run: abmelden } : { label: 'Anmelden', hint: 'Konto', ic: 'user', run: () => openLogin() }] : []),
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
const resetDemo = () => undoable('Demo zurückgesetzt.', () => { S = seed(); normalize(S); cur = null; });

// ---------- ShowCube Cloud: Konto, Speichern auf dem Server, echte Boxen ----------
// Ohne Anmeldung zeigt das Panel den Anmelde-Bildschirm (oder auf Wunsch die Demo). Mit Konto:
// - Slideshows, Dateien, Hinweis und Einstellungen werden kurz nach jeder Änderung auf den Server geschrieben.
//   Bis dahin (und ohne Netz) liegt alles im Browser zwischengespeichert und wird nachgeschoben.
// - Veröffentlichen legt ein Paket auf dem Server ab. Die Boxen holen es sich selbst.
// - Bildschirme sind echte Boxen. Ihren Zustand holt das Panel alle 5 Sekunden.
const sb = hatServer ? verbinden('showcube-panel') : null;
let konto: { email: string; betrieb: string; admin?: boolean; name?: string } | null = null;
// Admins (ShowCube-Team) können jeden Betrieb öffnen. Welcher gerade offen ist, merkt sich der Browser.
const AKEY = 'showcube-admin-betrieb';
const CKEY = KEY + '-cloud';
const hochgeladen = new Set<string>(), offenePakete = new Set<string>();
let synced = { shows: new Map<string, string>(), screens: new Map<string, string>(), betrieb: '' };
let syncT: any, syncLaeuft = false, syncNochmal = false, syncFehler = '', ladeN = 0;
const scFields = (sc: Screen) => JSON.stringify({ name: sc.name, standort: sc.place, ausrichtung: sc.orient, show_id: sc.show || null, strom: sc.power });
const btFields = () => JSON.stringify({ hinweis: S.notice || null, einstellungen: { alert: S.alert, marke: S.marke || null, partner: S.partner || [], werbung: S.werbung || null } });
function merkeSync() { synced = { shows: new Map(S.shows.map(sh => [sh.id, JSON.stringify(sh)])), screens: new Map(S.screens.map(sc => [sc.id, scFields(sc)])), betrieb: btFields() }; }
function cacheCloud() {
  try { localStorage.setItem(CKEY, JSON.stringify({ betrieb: konto.betrieb, S, offen: [...offenePakete], synced: { shows: [...synced.shows], screens: [...synced.screens], betrieb: synced.betrieb } })); } catch (e) { saveOK = false; }
}
const fehlerText = (e: any) => { const m = (e && e.message) || String(e); return /fetch|network|Failed/i.test(m) ? 'Keine Verbindung zum Server.' : m; };

// Eine Box, wie der Server sie meldet, in einen Bildschirm des Panels übersetzen.
function vomServer(r: any, old?: Screen): Screen {
  const at = r.zuletzt ? Date.now() - (r.her ?? 0) * 1000 : 0;
  if (r.zustand && at) live.set(r.id, { beat: r.zustand, at });
  const sc: Screen = old || { id: r.id, name: r.name, place: r.standort, orient: r.ausrichtung, show: r.show_id || '', power: r.strom, sim: 'offline', lastSeen: 0, revision: 0, version: '', temp: 0, disk: 0, net: '', booted: Date.now(), log: [] };
  sc.sim = 'offline'; sc.lastSeen = at || Date.parse(r.gekoppelt || r.erstellt || '') || Date.now();
  sc.revision = r.stand || 0; sc.version = r.version || ''; sc.kennung = r.kennung || '';
  if (r.zustand && r.zustand.uptime != null && at) sc.booted = at - r.zustand.uptime * 1000;
  // Protokoll: Einträge vom Server (Box meldet sich, Stand übernommen) und eigene aus dem Panel zusammen.
  const seen = new Set<string>(), all = [...(r.protokoll || []), ...sc.log].filter(l => { const k = l.t + l.msg; if (seen.has(k)) return false; seen.add(k); return true; });
  sc.log = all.sort((a, b) => b.t - a.t).slice(0, 30);
  return sc;
}

async function cloudBeimStart() {
  const { data } = await sb.auth.getSession();
  const u = data.session && data.session.user;
  if (!u || u.is_anonymous) return;
  try { await cloudStart(u.email); } catch (e) { toast('Anmeldung: ' + fehlerText(e)); }
}
async function cloudStart(email: string) {
  // Zuerst den zwischengespeicherten Stand zeigen, damit das Panel auch ohne Netz sofort da ist.
  let cache: any = null; try { cache = JSON.parse(localStorage.getItem(CKEY) || 'null'); } catch (e) {}
  const b = await sb.rpc('mein_betrieb');
  if (b.error && !cache) throw b.error;
  const adm = b.error ? null : await sb.rpc('ist_admin');
  const admin = !!(adm && adm.data);
  let gewaehlt = ''; try { gewaehlt = admin ? localStorage.getItem(AKEY) || '' : ''; } catch (e) {}
  const betrieb = gewaehlt || b.data || (cache && cache.betrieb);
  if (!betrieb) throw new Error('Zu diesem Konto gibt es keinen Betrieb.');
  konto = { email, betrieb, admin };
  // Ab hier gelten nur noch die echten Daten. Die Demo wird verworfen.
  demo = false; try { sessionStorage.removeItem(DKEY); } catch (e) {}
  if (cache && cache.betrieb === betrieb) {
    S = cache.S; normalize(S); (cache.offen || []).forEach((id: string) => offenePakete.add(id));
    synced = { shows: new Map(cache.synced.shows), screens: new Map(cache.synced.screens), betrieb: cache.synced.betrieb };
    // Was offline geändert wurde, zuerst hochschieben, dann den Stand vom Server holen.
    await sync();
  } else { S = leer(); normalize(S); merkeSync(); }
  if (b.error) { syncFehler = fehlerText(b.error); return; }
  await cloudLaden();
  holeBildschirmeLoop();
}
async function cloudLaden() {
  const b = konto.betrieb;
  const [bt, shows, dat, scr] = await Promise.all([
    sb.from('betriebe').select('name, hinweis, einstellungen').eq('id', b).single(),
    sb.from('shows').select('daten').eq('betrieb_id', b),
    sb.from('dateien').select('*').eq('betrieb_id', b).order('erstellt', { ascending: false }),
    sb.from('bildschirme_panel').select('id,name,standort,ausrichtung,show_id,strom,zuletzt,her,zustand,stand,version,kennung,protokoll,gekoppelt,erstellt').eq('betrieb_id', b)]);
  const err = [bt, shows, dat, scr].find(r => r.error); if (err) throw err.error;
  const oldScreens = new Map(S.screens.map(sc => [sc.id, sc]));
  S = { shows: shows.data.map((r: any) => r.daten), screens: scr.data.map((r: any) => vomServer(r, oldScreens.get(r.id))), assets: dat.data.filter((d: any) => d.typ !== 'logo').map((d: any) => ({ id: d.id, type: d.typ, name: d.name, size: d.groesse, added: Date.parse(d.erstellt) })),
    notice: bt.data.hinweis, alert: (bt.data.einstellungen || {}).alert, marke: (bt.data.einstellungen || {}).marke || null, partner: (bt.data.einstellungen || {}).partner || [], werbung: (bt.data.einstellungen || {}).werbung || undefined };
  normalize(S); dat.data.forEach((d: any) => hochgeladen.add(d.id)); merkeSync(); konto.name = bt.data.name;
  // Ein neues Konto startet leer. Die Einrichtungshilfe unter „Bildschirme“ führt durch die ersten Schritte.
  cacheCloud();
  // Dateien, die auf diesem Gerät noch fehlen, im Hintergrund holen.
  const fehlt = dat.data.filter((d: any) => !blobs.has(d.id));
  ladeN = fehlt.length; paintKonto();
  for (const d of fehlt) {
    const r = await sb.storage.from(BUCKET).download(b + '/' + d.id);
    if (!r.error) { putBlob(d.id, r.data); imgs.delete(d.id); vids.delete(d.id); }
    ladeN--; paintKonto();
    if (!ladeN) render();
  }
}

function planeSync(ms = 800) { clearTimeout(syncT); syncT = setTimeout(sync, ms); paintKonto(); }
async function dateienHoch() {
  const b = konto.betrieb, todo: { id: string; typ: string; name: string; groesse: number }[] = [];
  S.assets.forEach(a => { if (!hochgeladen.has(a.id) && blobs.has(a.id)) todo.push({ id: a.id, typ: a.type, name: a.name, groesse: a.size }); });
  S.shows.forEach(sh => [sh.cfg, sh.pub, ...sh.history.map(v => v.cfg)].forEach(c => {
    if (c && c.logo && !hochgeladen.has(c.logo) && blobs.has(c.logo) && !todo.some(t => t.id === c.logo)) todo.push({ id: c.logo, typ: 'logo', name: 'Logo', groesse: blobs.get(c.logo).size });
  }));
  for (const t of todo) {
    const blob = blobs.get(t.id);
    const up = await sb.storage.from(BUCKET).upload(b + '/' + t.id, blob, { upsert: true, contentType: blob.type || undefined });
    if (up.error) throw new Error('„' + t.name + '“ ließ sich nicht hochladen: ' + up.error.message);
    const r = await sb.from('dateien').upsert({ betrieb_id: b, id: t.id, typ: t.typ, name: t.name, groesse: t.groesse });
    if (r.error) throw r.error;
    hochgeladen.add(t.id);
  }
}
async function sync() {
  if (!konto) return;
  if (syncLaeuft) { syncNochmal = true; return; }
  syncLaeuft = true; clearTimeout(syncT);
  const b = konto.betrieb;
  try {
    await dateienHoch();
    const neu = S.shows.filter(sh => synced.shows.get(sh.id) !== JSON.stringify(sh)), js = neu.map(sh => JSON.stringify(sh));
    if (neu.length) {
      const r = await sb.from('shows').upsert(neu.map(sh => ({ betrieb_id: b, id: sh.id, daten: sh, revision: sh.revision, geaendert: new Date().toISOString() })));
      if (r.error) throw r.error; neu.forEach((sh, i) => synced.shows.set(sh.id, js[i]));
    }
    const weg = [...synced.shows.keys()].filter(id => !showById(id));
    if (weg.length) { const r = await sb.from('shows').delete().eq('betrieb_id', b).in('id', weg); if (r.error) throw r.error; weg.forEach(id => synced.shows.delete(id)); }
    for (const sc of S.screens) {
      const f = scFields(sc); if (synced.screens.get(sc.id) === f) continue;
      const r = await sb.from('bildschirme').update(JSON.parse(f)).eq('id', sc.id); if (r.error) throw r.error; synced.screens.set(sc.id, f);
    }
    const bf = btFields();
    if (bf !== synced.betrieb) { const r = await sb.from('betriebe').update(JSON.parse(bf)).eq('id', b); if (r.error) throw r.error; synced.betrieb = bf; }
    // Veröffentlichte Stände als Paket ablegen. Dateien sind Verweise in den Speicher, die Box lädt sie selbst.
    for (const id of [...offenePakete]) {
      const sh = showById(id); if (!sh || !sh.pub) { offenePakete.delete(id); continue; }
      const p = paketFor(sh, sh.pub), files: Record<string, string> = {};
      p.config.media.forEach(m => { files[m.id] = SPEICHER + b + '/' + m.id; });
      filmeIn(p.config).forEach(id => { if (hochgeladen.has(id)) files[id] = SPEICHER + b + '/' + id; });
      if (sh.pub.logo && hochgeladen.has(sh.pub.logo)) files.logo = SPEICHER + b + '/' + sh.pub.logo;
      const r = await sb.from('pakete').upsert({ betrieb_id: b, show_id: sh.id, revision: sh.revision, paket: { ...p, files } });
      if (r.error) throw r.error; offenePakete.delete(id);
    }
    syncFehler = '';
  } catch (e) {
    syncFehler = fehlerText(e);
    syncT = setTimeout(sync, 15000);
  } finally {
    syncLaeuft = false; cacheCloud(); paintKonto();
    if (syncNochmal) { syncNochmal = false; planeSync(200); }
  }
}

// Befehle an die Box. An/Aus ist ein Feld am Bildschirm und reist mit dem normalen Speichern.
const fotoSeit = new Map<string, number>();
function cloudSend(m: Msg) {
  if (m.t !== 'cmd' || m.cmd === 'power') return;
  sb.from('befehle').insert({ betrieb_id: konto.betrieb, bildschirm_id: m.screen, befehl: m.cmd, daten: m.label ? { label: m.label } : {} }).select('erstellt').single().then(r => {
    if (r.error) { toast('Befehl kam nicht an: ' + fehlerText(r.error)); shotWait.delete(m.screen); return; }
    if (m.cmd === 'shot') { fotoSeit.set(m.screen, Date.parse(r.data.erstellt)); holeBildschirmeLoop(1500); }
  });
}
let pollT: any;
async function holeBildschirme() {
  const r = await sb.from('bildschirme_panel').select('id,name,standort,ausrichtung,show_id,strom,zuletzt,her,zustand,stand,version,kennung,protokoll,foto_zeit,gekoppelt,erstellt').eq('betrieb_id', konto.betrieb);
  if (r.error) return;
  let neu = false;
  const ids = new Set(r.data.map((x: any) => x.id));
  for (const row of r.data as any[]) {
    const old = S.screens.find(sc => sc.id === row.id);
    if (old) vomServer(row, old); else { const sc = vomServer(row); S.screens.push(sc); synced.screens.set(sc.id, scFields(sc)); neu = true; }
    const since = fotoSeit.get(row.id);
    if (since && row.foto_zeit && Date.parse(row.foto_zeit) >= since) {
      fotoSeit.delete(row.id);
      const f = await sb.from('bildschirme').select('foto').eq('id', row.id).single(), cb = shotWait.get(row.id);
      if (cb && !f.error) { shotWait.delete(row.id); cb(f.data.foto); }
    }
  }
  if (S.screens.some(sc => !ids.has(sc.id))) { S.screens = S.screens.filter(sc => ids.has(sc.id)); neu = true; }
  cacheCloud();
  if (neu) { render(); if (openId) drawScreenDlg(); } else { runTicks(); dticks.forEach(f => f()); }
}
function holeBildschirmeLoop(ms = 5000) {
  clearTimeout(pollT);
  pollT = setTimeout(async () => {
    if (!konto) return;
    if (!document.hidden) await holeBildschirme().catch(() => {});
    holeBildschirmeLoop(fotoSeit.size ? 1500 : 5000);
  }, ms === 5000 && !S.screens.length ? 0 : ms);
}
document.addEventListener('visibilitychange', () => { if (konto && !document.hidden) holeBildschirmeLoop(0); });

async function cloudKoppeln(code: string, name: string, place: string, orient: string, show: string, err: HTMLElement, btn: HTMLButtonElement) {
  btn.disabled = true; err.textContent = '';
  const r = await sb.rpc('bildschirm_koppeln', { p_code: code, p_name: name, p_standort: place || 'Neuer Standort', p_ausrichtung: orient, p_show_id: show || null, p_betrieb: konto.betrieb });
  btn.disabled = false;
  if (r.error) { err.textContent = fehlerText(r.error); $('pCode').focus(); return; }
  if (!S.screens.some(sc => sc.id === r.data.id)) { const sc = vomServer({ ...r.data, her: 0 }); S.screens.push(sc); synced.screens.set(sc.id, scFields(sc)); }
  cacheCloud(); $('dlgPair').close(); go('screens');
  const sh = showById(show);
  toast('„' + name + '“ ist gekoppelt' + (sh ? (sh.pub ? ' und zeigt gleich „' + sh.name + '“.' : '. „' + sh.name + '“ erscheint, sobald du sie veröffentlichst.') : '.'));
  holeBildschirmeLoop(1000);
}
async function cloudEntfernen(sc: Screen) {
  const r = await sb.from('bildschirme').delete().eq('id', sc.id);
  if (r.error) { toast('Entfernen ging nicht: ' + fehlerText(r.error)); return; }
  S.screens = S.screens.filter(z => z.id !== sc.id); synced.screens.delete(sc.id); cacheCloud(); render();
  toast('„' + sc.name + '“ entfernt. Die Box zeigt wieder einen Koppel-Code.');
}

// Anmelden und Konto anlegen
function openLogin(neu = false) {
  const err = h('span', { class: 'small', style: 'color:var(--bad)', role: 'alert' });
  fill($('loginForm'),
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dlTitle' }, neu ? 'Konto anlegen' : 'Anmelden'), h('button', { class: 'btn icon ghost', type: 'button', onclick: (e: any) => e.currentTarget.closest('dialog').close(), 'aria-label': 'Schließen' }, icon('x'))),
    h('p', { class: 'small' }, neu ? 'Mit einem Konto liegen Slideshows und Bildschirme auf dem ShowCube-Server, und echte Boxen lassen sich koppeln.' : 'Mit deinem ShowCube-Konto. Danach siehst du deine echten Bildschirme.'),
    neu ? h('div', null, h('label', { for: 'lBetrieb' }, 'Name des Betriebs'), h('input', { type: 'text', id: 'lBetrieb', autocomplete: 'organization', placeholder: 'z. B. Pizzeria Da Marco' })) : null,
    h('div', null, h('label', { for: 'lMail' }, 'E-Mail'), h('input', { type: 'email', id: 'lMail', autocomplete: 'email', required: true })),
    h('div', null, h('label', { for: 'lPass' }, 'Passwort'), h('input', { type: 'password', id: 'lPass', autocomplete: neu ? 'new-password' : 'current-password', minlength: '8', required: true }), neu ? h('span', { class: 'small' }, 'Mindestens 8 Zeichen.') : null),
    err,
    h('button', { class: 'btn primary lg', value: 'ok' }, neu ? 'Konto anlegen' : 'Anmelden'),
    h('button', { class: 'btn ghost sm', type: 'button', onclick: () => openLogin(!neu) }, neu ? 'Ich habe schon ein Konto' : 'Neu hier? Konto anlegen'),
    demo ? h('span', { class: 'small' }, 'Die Demo endet mit der Anmeldung. Dein Konto startet ohne die Beispiel-Inhalte.') : null);
  $('loginForm').onsubmit = async (e: SubmitEvent) => {
    if ((e.submitter as any)?.value !== 'ok') return;
    e.preventDefault();
    const email = $('lMail').value.trim(), password = $('lPass').value, btn = e.submitter as HTMLButtonElement;
    btn.disabled = true; err.textContent = '';
    const r = neu ? await sb.auth.signUp({ email, password, options: { data: { betrieb: $('lBetrieb').value.trim() } } }) : await sb.auth.signInWithPassword({ email, password });
    btn.disabled = false;
    if (r.error) { err.textContent = /Invalid login/i.test(r.error.message) ? 'E-Mail oder Passwort stimmt nicht.' : /already registered/i.test(r.error.message) ? 'Zu dieser E-Mail gibt es schon ein Konto.' : fehlerText(r.error); return; }
    if (!r.data.session) { err.textContent = 'Fast geschafft: Bitte den Link in der E-Mail bestätigen und dann anmelden.'; return; }
    try { await cloudStart(email); } catch (x) { err.textContent = fehlerText(x); return; }
    $('dlgLogin').close(); cur = null; paintModus(); go('screens'); render();
    toast(neu ? 'Konto angelegt. Die drei Schritte unter „Bildschirme“ zeigen, wie es weitergeht.' : 'Angemeldet.');
  };
  if (!$('dlgLogin').open) $('dlgLogin').showModal(); (neu ? $('lBetrieb') : $('lMail')).focus();
}
async function abmelden() {
  await sync();
  if (syncFehler && !confirm('Einige Änderungen sind noch nicht auf dem Server. Trotzdem abmelden?')) return;
  await sb.auth.signOut().catch(() => {});
  try { localStorage.removeItem(CKEY); localStorage.removeItem(AKEY); } catch (e) {}
  location.reload();
}
// Admin: Liste aller Betriebe, einer davon wird geöffnet.
async function openBetriebe() {
  const list = h('div', { class: 'targets' }, h('span', { class: 'small' }, 'Lade …'));
  fill($('loginForm'),
    h('div', { class: 'dlg-h' }, h('h2', { id: 'dlTitle' }, 'Betrieb öffnen'), h('button', { class: 'btn icon ghost', type: 'button', onclick: (e: any) => e.currentTarget.closest('dialog').close(), 'aria-label': 'Schließen' }, icon('x'))),
    h('p', { class: 'small' }, 'Admin-Ansicht: alle Kunden. Du siehst und änderst, was der Kunde sieht, und kannst Boxen für ihn koppeln.'), list,
    h('div', { class: 'row', style: 'justify-content:space-between' }, h('span', { class: 'small', style: 'min-width:0;flex:1 1 180px;overflow-wrap:anywhere' }, 'Angemeldet als ' + konto.email), h('button', { class: 'btn ghost sm', type: 'button', onclick: abmelden }, 'Abmelden')));
  $('loginForm').onsubmit = null;
  if (!$('dlgLogin').open) $('dlgLogin').showModal();
  const r = await sb.rpc('admin_betriebe');
  if (r.error) { fill(list, h('span', { class: 'small' }, fehlerText(r.error))); return; }
  fill(list, (r.data as any[]).map(x => h('button', { type: 'button', class: 'betrieb', 'aria-current': x.id === konto.betrieb ? 'true' : null, onclick: () => wechsleBetrieb(x.id) },
    h('b', null, x.name || 'Ohne Namen'),
    h('span', { class: 'small' }, x.online + ' / ' + plural(+x.bildschirme, 'Bildschirm', 'Bildschirme') + ' online'),
    h('span', { class: 'small mail' }, (x.email || '–') + ' · seit ' + new Date(x.erstellt).toLocaleDateString('de-DE')))));
}
async function wechsleBetrieb(id: string) {
  await sync();
  try { localStorage.setItem(AKEY, id); localStorage.removeItem(CKEY); } catch (e) {}
  location.reload();
}
// ---------- Start, Demo oder Konto ----------
function demoStart() { demo = true; S = seed(); normalize(S); cur = null; save(); paintModus(); go('screens'); render(); }
function demoEnde() { try { sessionStorage.removeItem(DKEY); } catch (e) {} location.reload(); }
function paintModus() {
  const start = !konto && !demo;
  document.body.classList.toggle('gate', start); $('start').hidden = !start; $('demoBar').hidden = !demo || !!konto;
  if (start) fill($('startBtns'),
    h('button', { class: 'btn primary lg', onclick: () => openLogin() }, 'Anmelden'),
    h('button', { class: 'btn lg', onclick: () => openLogin(true) }, 'Konto anlegen'),
    h('div', { class: 'or' }, 'oder erst mal umsehen'),
    h('button', { class: 'btn ghost lg', onclick: demoStart }, icon('screens'), 'Demo ansehen'),
    h('span', { class: 'small' }, 'Die Demo zeigt drei Beispiel-Betriebe. Nichts davon wird gespeichert.'));
  if (demo && !konto) fill($('demoBar'), icon('alert'),
    h('span', null, h('b', null, 'Demo.'), ' Beispiel-Betriebe zum Ausprobieren. ', h('b', null, 'Nichts wird gespeichert'), ', und es hängen keine echten Bildschirme dran.'),
    sb ? h('button', { class: 'btn sm primary', onclick: () => openLogin(true) }, 'Konto anlegen') : null,
    sb ? h('button', { class: 'btn sm', onclick: demoEnde }, 'Demo beenden') : null);
}
function paintKonto() {
  if (!sb) { fill($('proto'), 'Demo ohne Server. Nichts wird gespeichert. ', h('button', { onclick: resetDemo }, 'Zurücksetzen')); return; }
  $('konto').hidden = false;
  fill($('konto'), icon('user'), h('span', { class: 'lbl' }, konto ? konto.email.split('@')[0] : 'Anmelden'), konto && konto.admin ? h('span', { class: 'badge ok' }, 'Admin') : null);
  $('konto').title = konto ? 'Angemeldet als ' + konto.email : 'Mit ShowCube-Konto anmelden';
  const st = !konto ? '' : syncFehler ? 'Nicht gespeichert: ' + syncFehler + ' Wird wiederholt.' : syncLaeuft || syncT && (offenePakete.size || S.shows.some(sh => synced.shows.get(sh.id) !== JSON.stringify(sh))) ? 'Wird gespeichert …' : ladeN ? 'Lade ' + plural(ladeN, 'Datei', 'Dateien') + ' …' : 'Alles auf dem Server gespeichert.';
  fill($('proto'), konto
    ? [konto.admin ? ['Admin · ', h('b', null, konto.name || 'Betrieb'), ' ', h('button', { onclick: openBetriebe }, 'wechseln'), h('br')] : null, st + ' ', h('button', { onclick: abmelden }, 'Abmelden')]
    : ['Demo. Nichts wird gespeichert. ', h('button', { onclick: resetDemo }, 'Zurücksetzen'), ' · ', h('button', { onclick: demoEnde }, 'Beenden')]);
}
if (sb) { $('konto').onclick = () => !konto ? openLogin() : konto.admin ? openBetriebe() : abmelden(); $('dlgLogin').addEventListener('click', (e: MouseEvent) => { if (e.target === $('dlgLogin')) $('dlgLogin').close(); }); }

// ---------- Start ----------
let liveKey = '';
setInterval(() => {
  if (S.notice && S.notice.until && Date.now() > S.notice.until) { S.notice = null; save(); renderNav(); }
  const k = S.screens.filter(s => isLive(s.id)).map(s => s.id).join();
  if (k !== liveKey) { liveKey = k; render(); if (openId) drawScreenDlg(); } else { runTicks(); dticks.forEach(f => f()); }
}, 4000);
// ---------- Als App installieren (PWA) ----------
// Nur im fertigen Build aktiv: der Build legt Manifest und sw.js neben panel.html. Über file:// gibt es keinen Service Worker.
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvt: any = null;
function paintInstall() { $('install').hidden = standalone() || !(installEvt || (isIOS && pwaOn)); }
const pwaOn = !!document.querySelector('link[rel=manifest]') && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); installEvt = e; paintInstall(); });
addEventListener('appinstalled', () => { installEvt = null; paintInstall(); toast('ShowCube ist jetzt als App installiert.'); });
$('install').prepend(icon('download'));
$('install').onclick = async () => {
  if (installEvt) { const e = installEvt; installEvt = null; e.prompt(); await e.userChoice.catch(() => null); paintInstall(); return; }
  $('dlgInstall').showModal();
};
$('dlgInstall').addEventListener('click', (e: MouseEvent) => { if (e.target === $('dlgInstall')) $('dlgInstall').close(); });
if (pwaOn) {
  let reloading = false;
  // Beim ersten Besuch übernimmt der Worker still. Erst ein Wechsel von einem Worker zum nächsten ist ein Update.
  let ctrl = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const update = !!ctrl; ctrl = navigator.serviceWorker.controller;
    if (!update || reloading) return;
    toast('Neue Version von ShowCube ist da.', () => { reloading = true; location.reload(); }, 'Neu laden', 20000);
  });
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').then(reg => {
    // Bei längerem Offen-Lassen (z.B. Tablet an der Theke) stündlich nach Updates schauen.
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch(() => {}));
}
paintInstall();
const offline = () => document.documentElement.classList.toggle('offline', !navigator.onLine);
addEventListener('online', () => { offline(); toast('Wieder online.'); });
addEventListener('offline', () => { offline(); toast('Offline. Änderungen bleiben auf diesem Gerät, bis du wieder Netz hast.', undefined, undefined, 6000); });
offline();

// Kurzbefehle vom App-Icon (lange drücken): panel.html?do=notice
function shortcut() {
  const q = new URLSearchParams(location.search), d = q.get('do');
  if (!d || (!konto && !demo)) return;
  history.replaceState(null, '', location.pathname + location.hash);
  if (d === 'notice') openNotice();
}

// Von der Startseite: panel.html?demo öffnet gleich die Demo, ohne Umweg über die Anmeldung.
function demoLink() {
  if (!new URLSearchParams(location.search).has('demo') || konto || demo) return;
  history.replaceState(null, '', location.pathname + location.hash);
  demoStart();
}

const start = async () => { await openDB(); await loadAll(); if (sb) await cloudBeimStart(); sweepBlobs(); paintModus(); route(); requestAnimationFrame(frame); demoLink(); markeUebergabe(); shortcut(); paintKonto(); };
fontsReady().then(start, start);
