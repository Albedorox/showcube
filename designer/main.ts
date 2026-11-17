import '../shared/fonts.css';
import '../shared/fonts-marke.css';
import { fontsReady, TEMPLATES } from '../shared/templates';
import { BAUSTEINE, bausteinSlide, type Baustein } from '../shared/bausteine';
import { neueMarke, markeAusDatei, markeAlsDatei, useMarke, logoBild, farbenAusBild, kontrast, SCHRIFTEN, UEBERGAENGE, type Marke } from '../shared/marke';
import { drawDesign, STARTER, ANIMS, FARBROLLEN, leereVorlage, neueId, animEnde, farbe, type DesignVorlage, type El, type ElTyp } from '../shared/design';

// Vorlagen-Designer: hier entsteht die Marke eines Betriebs (Logo, Farben, Schriften, Übergänge)
// und seine eigenen Vorlagen mit Animationen. Für Kunden selbst und für Werbeagenturen.
//
// - Marke: alles, was hier eingestellt wird, gilt sofort für alle Branchenvorlagen und Bausteine.
// - Vorlagen: Elemente frei anordnen, Farben und Schriften als Rollen der Marke, Animation pro Element.
//   "Für Kunden änderbar" macht ein Element zum Feld, das der Kunde im Panel ausfüllt. Der Rest bleibt fest.
// - Partner-Modus: eine Agentur verwaltet hier mehrere Kunden. Übergabe ans Panel über localStorage
//   (gleicher Browser) oder als Datei showcube-marke.json.
//
// Prototyp: Alles liegt nur in diesem Browser. Echte Partner-Zugänge brauchen das Backend (docs/vorlagen-designer.md).

// ---------- Helfer ----------
const $ = (id: string) => document.getElementById(id) as any;
type Kid = Node | string | number | null | undefined | false | Kid[];
function h(tag: string, props: Record<string, any> | null = null, ...kids: Kid[]): any {
  const e: any = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (['value', 'checked', 'disabled', 'hidden', 'selected'].includes(k)) e[k] = v; else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v === true ? '' : v);
  }
  const add = (c: Kid) => { if (Array.isArray(c)) c.forEach(add); else if (c != null && c !== false) e.append(c as any); };
  kids.forEach(add); return e;
}
function fill(e: Element, ...kids: Kid[]) { const f = h('div', null, ...kids); e.replaceChildren(...f.childNodes); }
const ICONS: Record<string, string> = {
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', rect: '<rect x="4" y="6" width="16" height="12" rx="2"/>', circle: '<circle cx="12" cy="12" r="8"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
  logo: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM17 17h4v4h-4"/>',
  play: '<path d="M7 5l12 7-12 7z"/>', plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', send: '<path d="M4 12l16-8-6 16-3-7z"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M10 10v10"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
  wand: '<path d="M4 20L16 8M14 4v2M18 4l-1 1M20 8h-2M19 12l-1-1"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const icon = (n: string) => { const t = document.createElement('template'); t.innerHTML = `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`; return t.content.firstChild as SVGElement; };
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
let toastT: any;
function toast(t: string) { const el = $('toast'); el.textContent = t; el.classList.remove('gone'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.add('gone'), 4200); }
const fileToDataURL = (f: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(f); });
function bildKlein(f: File, max: number, png = false): Promise<string> {
  return new Promise((res, rej) => {
    const i = new Image(); i.onerror = rej;
    i.onload = () => { const s = Math.min(1, max / Math.max(i.naturalWidth, i.naturalHeight)), cv = h('canvas'); cv.width = Math.round(i.naturalWidth * s); cv.height = Math.round(i.naturalHeight * s); cv.getContext('2d').drawImage(i, 0, 0, cv.width, cv.height); URL.revokeObjectURL(i.src); res(cv.toDataURL(png ? 'image/png' : 'image/jpeg', .86)); };
    i.src = URL.createObjectURL(f);
  });
}
const REL = /\.html$/.test(location.pathname);
const PANEL_URL = REL ? 'panel.html' : '../panel/';
const UEBERGABE = 'showcube-marke-uebergabe', BEARBEITEN = 'showcube-marke-bearbeiten', KEY = 'showcube-designer-v1';

// ---------- Beispiel-Kunden ----------
function svgLogo(text: string, a: string, b: string, serif = false) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="200" viewBox="0 0 520 200"><circle cx="100" cy="100" r="78" fill="${a}"/><circle cx="100" cy="100" r="44" fill="${b}"/><text x="200" y="122" font-family="${serif ? 'Georgia, serif' : 'Arial, sans-serif'}" font-weight="700" font-size="62" fill="${a}">${text}</text></svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}
// Beispielfoto für die Demo-Vorlagen: warmes Licht mit Unschärfe, gezeichnet statt geladen.
function beispielFoto(seed: number, hue: number) {
  const c = h('canvas'); c.width = 960; c.height = 540; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 960, 540); g.addColorStop(0, `hsl(${hue},45%,30%)`); g.addColorStop(1, `hsl(${hue + 25},55%,12%)`); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
  let r = seed; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  x.filter = 'blur(18px)';
  for (let i = 0; i < 26; i++) { x.globalAlpha = .18 + rnd() * .35; x.fillStyle = `hsl(${hue + rnd() * 40 - 10},${60 + rnd() * 30}%,${55 + rnd() * 30}%)`; x.beginPath(); x.arc(rnd() * 960, rnd() * 360, 20 + rnd() * 70, 0, 7); x.fill(); }
  x.filter = 'none'; x.globalAlpha = 1;
  x.fillStyle = `hsl(${hue + 10},30%,88%)`; x.beginPath(); x.ellipse(560, 420, 230, 70, 0, 0, 7); x.fill();
  x.fillStyle = `hsl(${hue},45%,22%)`; x.beginPath(); x.ellipse(560, 405, 150, 42, 0, 0, 7); x.fill();
  return c.toDataURL('image/jpeg', .82);
}
function beispiele(): Marke[] {
  const a = neueMarke('Café Morgenrot');
  Object.assign(a, { agentur: 'Werbeagentur Nord (Beispiel)', logo: svgLogo('Morgenrot', '#c2410c', '#fbbf24'), farben: { primaer: '#c2410c', zweit: '#fbbf24', dunkel: '#2a1a12', hell: '#fff7ed' }, schrift: { titel: { name: 'Playfair Display' }, text: { name: 'Nunito' } }, bewegung: { uebergang: 'schieben', tempo: .9, einflug: true } });
  a.vorlagen = [STARTER[0].make(), STARTER[1].make(), STARTER[2].make()];
  [a.vorlagen[1].quer[0], a.vorlagen[1].hoch[0]].forEach(e => { e.bild = beispielFoto(7, 22); });
  a.vorlagen[1].quer[2].text = a.vorlagen[1].hoch[2].text = 'Jetzt neu: Kürbis-Latte';
  a.vorlagen[0].quer[2].text = 'Hausgemachter Apfelkuchen'; a.vorlagen[0].hoch[2].text = 'Hausgemachter Apfelkuchen'; a.vorlagen[0].quer[3].text = '3,80 €'; a.vorlagen[0].hoch[3].text = '3,80 €';
  const b = neueMarke('Hausmann Immobilien');
  Object.assign(b, { agentur: 'Werbeagentur Nord (Beispiel)', logo: svgLogo('Hausmann', '#1f4e79', '#9cc3e6', true), farben: { primaer: '#1f4e79', zweit: '#d4a24c', dunkel: '#101c2a', hell: '#f4f6f9' }, schrift: { titel: { name: 'Oswald' }, text: { name: 'Figtree' } }, bewegung: { uebergang: 'zoom', tempo: 1.1, einflug: true } });
  b.vorlagen = [STARTER[3].make(), STARTER[1].make()];
  [b.vorlagen[1].quer[0], b.vorlagen[1].hoch[0]].forEach(e => { e.bild = beispielFoto(3, 205); });
  b.vorlagen[1].quer[2].text = b.vorlagen[1].hoch[2].text = 'Ihr Zuhause am Stadtpark';
  return [a, b];
}

// ---------- Zustand ----------
interface Store { kunden: Marke[]; aktiv: number; }
let S: Store = { kunden: [], aktiv: 0 };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.kunden && s.kunden.length) S = { kunden: s.kunden.map((m: any) => markeAusDatei(JSON.stringify(m))), aktiv: Math.min(s.aktiv || 0, s.kunden.length - 1) }; } catch (e) {}
if (!S.kunden.length) S = { kunden: beispiele(), aktiv: 0 };
let vonPanel = false;
// Aus dem Panel geöffnet: die Marke des Betriebs kommt mit und wird der aktive Kunde.
if (new URLSearchParams(location.search).get('von') === 'panel') {
  vonPanel = true; history.replaceState(null, '', location.pathname);
  try {
    const raw = localStorage.getItem(BEARBEITEN); localStorage.removeItem(BEARBEITEN);
    if (raw) { const m = markeAusDatei(raw), i = S.kunden.findIndex(k => k.name === m.name); if (i >= 0) S.kunden[i] = m; else S.kunden.unshift(m); S.aktiv = i >= 0 ? i : 0; }
    else { S.kunden.unshift(neueMarke('Mein Betrieb')); S.aktiv = 0; }
  } catch (e) {}
}
let saveT: any;
function save() { M().geaendert = new Date().toISOString(); clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Speicher im Browser ist voll. Große Bilder oder Schriften entfernen.'); } }, 300); }
const M = () => S.kunden[S.aktiv];
let tab: 'marke' | 'vorlagen' | 'partner' = 'marke';
let vi = 0;                   // gewählte Vorlage
let orient: 'quer' | 'hoch' = 'quer';
let galOrient: 'quer' | 'hoch' = 'quer';
let sel: string | null = null;
let playAt = 0;               // Zeitpunkt "Abspielen" (0 = Endzustand zeigen)
const undo: string[] = [];
function merke() { undo.push(JSON.stringify(M())); if (undo.length > 60) undo.shift(); }
function zurueck() { const s = undo.pop(); if (!s) return toast('Nichts mehr rückgängig zu machen.'); S.kunden[S.aktiv] = JSON.parse(s); save(); useMarke(M()); render(); }

// Daten wie auf der Box, mit Beispieleinträgen.
const ITEMS: Record<string, string[][]> = Object.fromEntries(Object.entries(TEMPLATES).map(([k, T]: any) => [k, T.items.split('\n').map((l: string) => l.split('|').map(s => s.trim()))]));
function daten(m: Marke, items = ITEMS.gastro) { return { name: m.name, accent: m.farben.primaer, logo: logoBild(m), marke: m, hours: 'Montag bis Samstag, 9 bis 19 Uhr', items }; }

// ---------- Kopf ----------
function renderKopf() {
  const ks = $('kunde'); ks.replaceChildren(...S.kunden.map((k, i) => h('option', { value: i, selected: i === S.aktiv }, k.name || 'Ohne Namen')));
  ks.onchange = () => { S.aktiv = +ks.value; vi = 0; sel = null; undo.length = 0; save(); useMarke(M()).then(render); render(); };
  $('neuKunde').replaceChildren(icon('plus'), 'Kunde');
  $('neuKunde').onclick = () => { S.kunden.push(neueMarke('Neuer Kunde')); S.aktiv = S.kunden.length - 1; vi = 0; sel = null; tab = 'marke'; save(); useMarke(M()); render(); setTimeout(() => { const n = $('mName'); if (n) { n.focus(); n.select(); } }, 50); };
  $('partnerBadge').hidden = S.kunden.length < 2;
  $('partnerBadge').textContent = 'Partner · ' + S.kunden.length + ' Kunden';
  const T: [typeof tab, string, string][] = [['marke', 'Marke', 'palette'], ['vorlagen', 'Vorlagen', 'layout'], ['partner', 'Für Agenturen', 'users']];
  $('tabs').replaceChildren(...T.map(([k, l, ic]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { tab = k; render(); } }, icon(ic), l)));
  $('ladenBtn').replaceChildren(icon('upload'), 'Datei laden', $('laden')); $('ladenBtn').title = 'Markenpaket aus Datei laden'; $('speichern').title = 'Markenpaket als Datei speichern';
  $('speichern').replaceChildren(icon('download'), 'Als Datei');
  $('uebergabe').replaceChildren(icon('send'), 'Ins Panel übernehmen');
  const n = $('note');
  n.hidden = !vonPanel;
  if (vonPanel) n.replaceChildren(h('span', null, 'Aus dem Panel geöffnet: Du bearbeitest die Marke deines Betriebs. Fertig? Dann „Ins Panel übernehmen“.'), h('button', { class: 'btn sm ghost', onclick: () => { vonPanel = false; renderKopf(); } }, 'Ausblenden'));
}
$('laden').onchange = async (e: any) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const m = markeAusDatei(await f.text()); S.kunden.push(m); S.aktiv = S.kunden.length - 1; vi = 0; sel = null; save(); await useMarke(m); render(); toast('Markenpaket „' + m.name + '“ geladen.'); }
  catch (err) { toast('Konnte die Datei nicht lesen: ' + (err as Error).message); }
};
$('speichern').onclick = () => {
  const a = h('a', { href: URL.createObjectURL(markeAlsDatei(M())), download: 'showcube-marke-' + (M().name || 'kunde').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-') + '.json' });
  document.body.append(a); a.click(); a.remove(); toast('Markenpaket gespeichert. Diese Datei kann der Kunde im Panel unter „Vorlagen“ laden.');
};
$('uebergabe').onclick = () => {
  try { localStorage.setItem(UEBERGABE, JSON.stringify(M())); } catch (e) { toast('Zu groß für die direkte Übergabe. Bitte „Als Datei“ nehmen.'); return; }
  window.open(PANEL_URL + '?marke', '_blank'); toast('Panel geöffnet. Dort ist die Marke jetzt übernommen.');
};

// ---------- Vorschau-Leinwände: ein Takt für alle ----------
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;
const canv = new Set<{ c: HTMLCanvasElement; draw: Draw; t0: number; loop: number }>();
function leinwand(draw: Draw, loop = 6) { const c = h('canvas'); canv.add({ c, draw, t0: performance.now(), loop }); return c; }
let last = 0;
function takt(now: number) {
  requestAnimationFrame(takt);
  if (now - last < 40 || document.hidden) return; last = now;
  for (const L of canv) {
    if (!L.c.isConnected) { canv.delete(L); continue; }
    const r = L.c.getBoundingClientRect(); if (!r.width || r.bottom < 0 || r.top > innerHeight) continue;
    const f = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * f), hh = Math.round(r.height * f);
    if (L.c.width !== w || L.c.height !== hh) { L.c.width = w; L.c.height = hh; }
    const x = L.c.getContext('2d'); x.save(); L.draw(x, w, hh, Math.max(0, (now - L.t0) / 1000) % L.loop); x.restore();
  }
  if (tab === 'vorlagen') malBuehne(now);
}

// ---------- Reiter: Marke ----------
function galerie(m: Marke) {
  const T: any = TEMPLATES, fs: { label: string; fn: any; items: string[][] }[] = [];
  const g = T.gastro.slides(false, daten(m, ITEMS.gastro)); fs.push({ label: 'Gastro: Menütafel', fn: g[0], items: ITEMS.gastro }, { label: 'Gastro: Angebot', fn: g[1], items: ITEMS.gastro });
  const mk = T.makler.slides(true, daten(m, ITEMS.makler)); fs.push({ label: 'Makler: Objekt', fn: mk[0], items: ITEMS.makler }, { label: 'Makler: QR zum Exposé', fn: mk[mk.length - 1], items: ITEMS.makler });
  const l = T.laden.slides(false, daten(m, ITEMS.laden)); fs.push({ label: 'Laden: Angebot', fn: l[0], items: ITEMS.laden }, { label: 'Laden: Angebot dunkel', fn: l[1], items: ITEMS.laden });
  (['qr', 'reviews', 'countdown'] as const).forEach(k => { const b: Baustein = { id: k, kind: k, on: true, when: 'always', f: { ...BAUSTEINE[k].f, ...(k === 'countdown' ? { until: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 16) } : {}) } }; fs.push({ label: 'Baustein: ' + BAUSTEINE[k].label, fn: bausteinSlide(b), items: ITEMS.gastro }); });
  m.vorlagen.forEach(v => fs.push({ label: 'Eigene Vorlage: ' + v.name, fn: (ctx: any, w: number, hh: number, d: any, t: number) => drawDesign(ctx, w, hh, d, t, v), items: ITEMS.gastro }));
  return fs;
}
// Zeigt den Übergang der Marke: Folien wechseln alle 3,5 Sekunden, so wie auf der Box.
function showreel(m: Marke) {
  const fs = galerie(m), step = 3.5;
  return leinwand((x, w, hh, t) => {
    useMarke(m);
    const i = Math.floor(t / step) % fs.length, j = (i + fs.length - 1) % fs.length, tin = t - Math.floor(t / step) * step;
    const b = m.bewegung, dur = b.uebergang === 'hart' ? 0 : Math.max(.05, b.tempo), p = dur ? Math.min(1, tin / dur) : 1, e = 1 - (1 - p) ** 3;
    const draw = (k: number, tt: number) => fs[k].fn(x, w, hh, daten(m, fs[k].items), tt);
    if (p < 1) { x.save(); if (b.uebergang === 'schieben') x.translate(-w * .08 * e, 0); if (b.uebergang === 'zoom') { x.translate(w / 2, hh / 2); x.scale(1 - .03 * e, 1 - .03 * e); x.translate(-w / 2, -hh / 2); } draw(j, 99); x.restore(); }
    x.save(); x.globalAlpha = p;
    if (b.uebergang === 'schieben') x.translate(w * .08 * (1 - e), 0);
    if (b.uebergang === 'zoom') { const s = 1.06 - .06 * e; x.translate(w / 2, hh / 2); x.scale(s, s); x.translate(-w / 2, -hh / 2); }
    draw(i, tin); x.restore();
  }, fs.length * step);
}
// Vordefinierte Farbsets. Jede Farbe lässt sich danach mit dem Farbwähler oder als Hex-Wert frei ändern.
const PALETTEN: [string, Marke['farben']][] = [
  ['Trattoria', { primaer: '#d9482b', zweit: '#e9b866', dunkel: '#16120f', hell: '#fff6ea' }],
  ['Petrol', { primaer: '#0b7a67', zweit: '#f2b441', dunkel: '#14181a', hell: '#fbf8f1' }],
  ['Immobilie', { primaer: '#1f4e79', zweit: '#d4a24c', dunkel: '#101c2a', hell: '#f4f6f9' }],
  ['Boutique', { primaer: '#b8326b', zweit: '#f4c7d6', dunkel: '#1d1418', hell: '#fff5f8' }],
  ['Natur', { primaer: '#2f7d32', zweit: '#c5d86d', dunkel: '#13200f', hell: '#f6f8ef' }],
  ['Praxis', { primaer: '#2a7fb8', zweit: '#7cc6c0', dunkel: '#0f1d26', hell: '#f3f8fb' }],
];
function farbFeld(k: keyof Marke['farben'], label: string) {
  const m = M(), set = (v: string) => { if (!/^#[0-9a-f]{6}$/i.test(v)) return; m.farben[k] = v.toLowerCase(); save(); renderMarke(); };
  return h('div', { class: 'farbe' }, h('input', { type: 'color', value: m.farben[k], 'aria-label': label, onchange: (e: any) => set(e.target.value) }),
    h('div', null, h('label', null, label), h('input', { type: 'text', value: m.farben[k], 'aria-label': label + ' als Hex', onchange: (e: any) => set(e.target.value.trim()) })));
}
function kontrastZeile(a: string, b: string, text: string) {
  const k = kontrast(a, b), gut = k >= 4.5;
  return h('div', { class: 'kontrast' }, h('i', { class: gut ? 'gut' : 'mau' }, k.toFixed(1).replace('.', ',') + ' : 1'), h('span', { class: 'small' }, text + (gut ? ', gut lesbar' : k >= 3 ? ', nur für große Schrift' : ', schwer lesbar')));
}
function schriftWahl(rolle: 'titel' | 'text', label: string) {
  const m = M(), s = m.schrift[rolle], id = 'f' + rolle;
  const sel = h('select', { id, onchange: (e: any) => { m.schrift[rolle] = { name: e.target.value }; save(); useMarke(m).then(renderMarke); } },
    SCHRIFTEN.map(f => h('option', { value: f.name, selected: !s.data && s.name === f.name }, f.name + ' · ' + f.art)), s.data ? h('option', { value: s.name, selected: true, disabled: true }, 'Eigene: ' + s.name) : null);
  const up = h('span', { class: 'btn sm', title: 'Eigene Schrift hochladen (WOFF2, WOFF, TTF oder OTF). Bitte nur Schriften mit Lizenz für Bildschirme.' }, icon('upload'), 'Eigene',
    h('input', { type: 'file', accept: '.woff2,.woff,.ttf,.otf', 'aria-label': label + ': eigene Schrift', onchange: async (e: any) => {
      const f = e.target.files[0]; if (!f) return; if (f.size > 1.5e6) return toast('Die Schrift ist größer als 1,5 MB. Bitte eine WOFF2-Datei nehmen.');
      m.schrift[rolle] = { name: f.name.replace(/\.[^.]+$/, ''), data: await fileToDataURL(f) }; save(); await useMarke(m); renderMarke(); toast('Schrift „' + m.schrift[rolle].name + '“ übernommen. Sie reist im Markenpaket mit bis auf die Box.');
    } }));
  return h('div', null, h('label', { for: id }, label), h('div', { class: 'fontsel' }, sel, up));
}
function renderMarke() {
  const m = M(), main = $('main');
  useMarke(m);
  const logoIn = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Logo hochladen', onchange: async (e: any) => {
    const f = e.target.files[0]; if (!f) return; merke();
    m.logo = f.type === 'image/svg+xml' ? await fileToDataURL(f) : await bildKlein(f, 800, true); save();
    const i = new Image(); i.onload = () => { const c = farbenAusBild(i); if (c) { m.farben.primaer = c.primaer; m.farben.zweit = c.zweit; save(); toast('Farben aus dem Logo übernommen. Rückgängig mit Strg + Z.'); } renderMarke(); }; i.src = m.logo;
  } });
  const fromLogo = () => { if (!m.logo) return; const i = new Image(); i.onload = () => { const c = farbenAusBild(i); if (!c) return toast('Im Logo sind keine kräftigen Farben.'); merke(); m.farben.primaer = c.primaer; m.farben.zweit = c.zweit; save(); renderMarke(); }; i.src = m.logo; };
  const gal = galerie(m);
  main.replaceChildren(h('div', { class: 'marke' },
    h('div', { class: 'form' },
      h('div', { class: 'box' }, h('h3', null, 'Betrieb'),
        h('div', null, h('label', { for: 'mName' }, 'Name auf den Folien'), h('input', { type: 'text', id: 'mName', value: m.name, oninput: (e: any) => { m.name = e.target.value; save(); renderKopf(); } })),
        h('div', null, h('label', { for: 'mAg' }, 'Gestaltet von (Agentur, freiwillig)'), h('input', { type: 'text', id: 'mAg', value: m.agentur || '', placeholder: 'z. B. Werbeagentur Nord', oninput: (e: any) => { m.agentur = e.target.value || undefined; save(); } })),
        h('div', { class: 'logobox' }, h('div', { class: 'pv' }, m.logo ? h('img', { src: m.logo, alt: 'Logo' }) : h('span', { class: 'small' }, 'Logo')),
          h('div', { class: 'row' }, h('span', { class: 'btn sm' }, icon('upload'), m.logo ? 'Logo ersetzen' : 'Logo hochladen', logoIn),
            m.logo ? h('button', { class: 'btn sm ghost', onclick: () => { merke(); m.logo = undefined; save(); renderMarke(); } }, 'Entfernen') : null))),
      h('div', { class: 'box' }, h('div', { class: 'row' }, h('h3', null, 'Farben'), h('span', { class: 'grow' }), m.logo ? h('button', { class: 'btn sm ghost', onclick: fromLogo, title: 'Haupt- und Zweitfarbe aus dem Logo lesen' }, icon('wand'), 'Aus dem Logo') : null),
        h('div', { class: 'farben' }, farbFeld('primaer', 'Hauptfarbe'), farbFeld('zweit', 'Zweitfarbe'), farbFeld('dunkel', 'Dunkel (Hintergrund)'), farbFeld('hell', 'Hell (Schrift)')),
        h('div', null, h('span', { class: 'label' }, 'Vorschläge (ein Klick setzt alle vier Farben)'), h('div', { class: 'paletten' }, PALETTEN.map(([n, f]) => h('button', { title: n, 'aria-label': 'Farbset ' + n, onclick: () => { merke(); m.farben = { ...f }; save(); renderMarke(); } }, [f.primaer, f.zweit, f.dunkel, f.hell].map(c => h('i', { style: 'background:' + c })))))),
        kontrastZeile(m.farben.hell, m.farben.dunkel, 'Hell auf Dunkel'), kontrastZeile('#ffffff', m.farben.primaer, 'Weiß auf Hauptfarbe'),
        h('span', { class: 'small' }, 'Die Vorlagen nehmen diese Farben als Rollen. Speisekarten bleiben dunkel mit heller Schrift, Angebote in der Hauptfarbe.')),
      h('div', { class: 'box' }, h('h3', null, 'Schriften'), schriftWahl('titel', 'Überschriften'), schriftWahl('text', 'Fließtext und Preise'),
        h('span', { class: 'small' }, 'Alle mitgelieferten Schriften gehen auch offline auf der Box.')),
      h('div', { class: 'box' }, h('h3', null, 'Bewegung'),
        h('div', null, h('label', { for: 'mUeb' }, 'Übergang zwischen den Folien'), h('select', { id: 'mUeb', onchange: (e: any) => { m.bewegung.uebergang = e.target.value; save(); renderMarke(); } }, UEBERGAENGE.map(([k, l]) => h('option', { value: k, selected: m.bewegung.uebergang === k }, l)))),
        m.bewegung.uebergang !== 'hart' ? h('div', null, h('label', { for: 'mTempo' }, 'Dauer: ' + m.bewegung.tempo.toFixed(1).replace('.', ',') + ' s'), h('input', { type: 'range', id: 'mTempo', min: .3, max: 2, step: .1, value: m.bewegung.tempo, oninput: (e: any) => { m.bewegung.tempo = +e.target.value; e.target.previousSibling.textContent = 'Dauer: ' + m.bewegung.tempo.toFixed(1).replace('.', ',') + ' s'; save(); }, onchange: () => renderMarke() })) : null,
        h('span', { class: 'small' }, 'Animationen einzelner Texte und Bilder stellst du in den eigenen Vorlagen ein.'))),
    h('div', null,
      h('div', { class: 'vorschau-h' }, h('h2', null, 'So sieht ' + (m.name || 'dein Betrieb') + ' auf dem Bildschirm aus'), h('span', { class: 'grow' }),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Ausrichtung der Vorschau' }, (['quer', 'hoch'] as const).map(o => h('button', { 'aria-pressed': String(galOrient === o), onclick: () => { galOrient = o; renderMarke(); } }, o === 'quer' ? 'Quer' : 'Hochkant')))),
      h('div', { class: 'slide', style: 'margin-bottom:18px' }, (() => { const c = showreel(m); c.style.cssText = 'width:100%;aspect-ratio:16/9;max-width:820px;border-radius:12px;box-shadow:var(--shadow-2);display:block'; return c; })(), h('span', null, 'Ablauf mit Übergang „' + UEBERGAENGE.find(u => u[0] === m.bewegung.uebergang)[1] + '“, alle Vorlagen in deiner Marke')),
      h('div', { class: 'gal' + (galOrient === 'hoch' ? ' hoch' : '') }, gal.map(s => h('div', { class: 'slide' }, leinwand((x, w, hh, t) => { useMarke(m); s.fn(x, w, hh, daten(m, s.items), t); }), h('span', null, s.label)))))));
}

// ---------- Reiter: Vorlagen ----------
const V = () => M().vorlagen[vi];
const GEO = ['x', 'y', 'w', 'h', 'gr'];
// Bearbeitet wird die Fassung für die gewählte Ausrichtung. Hochkant ohne eigene Fassung zeigt die Querfassung.
function els(v = V()): El[] { return orient === 'hoch' && v.hoch ? v.hoch : v.quer; }
function elById(id: string, list = els()) { return list.find(e => e.id === id); }
function beideListen(v = V()) { return [v.quer, ...(v.hoch ? [v.hoch] : [])]; }
function hochAnlegen() { const v = V(); if (orient === 'hoch' && !v.hoch) { v.hoch = clone(v.quer); toast('Eigene Hochkant-Fassung angelegt. Lage und Größe gelten jetzt nur hochkant.'); } }
function setze(key: keyof El, val: any) {
  const v = V(); if (!v || !sel) return; merke();
  if (GEO.includes(key as string)) { hochAnlegen(); const e = elById(sel); if (e) (e as any)[key] = val; }
  else beideListen(v).forEach(l => { const e = l.find(x => x.id === sel); if (e) { if (val === undefined) delete (e as any)[key]; else (e as any)[key] = val; } });
  save(); renderEig(); renderListe(); renderZeit();
}
function neuesEl(typ: ElTyp, extra: Partial<El> = {}) {
  const v = V(); if (!v) return; merke();
  const base: El = { id: neueId(), typ, x: 30, y: 30, w: 40, h: 22, anim: 'blende', start: 0, dauer: .8, ...(typ === 'text' ? { text: 'Neuer Text', rolle: 'text', gr: 6, farbe: v.hinter === 'hell' ? 'dunkel' : 'hell', ausr: 'left' } : {}),
    ...(typ === 'form' ? { fuell: 'primaer', ecken: 8 } : {}), ...(typ === 'logo' ? { x: 70, y: 6, w: 24, h: 14, ausr: 'right' } : {}), ...(typ === 'qr' ? { text: 'https://', frei: 'Link', x: 70, y: 30, w: 22, h: 40, farbe: 'dunkel', fuell: 'hell' } : {}), ...(typ === 'bild' ? { frei: 'Bild', anim: 'kenburns' } : {}), ...extra } as El;
  beideListen(v).forEach(l => l.push(clone(base))); sel = base.id; save(); renderVorlagen();
}
function loeschen() { const v = V(); if (!v || !sel) return; merke(); beideListen(v).forEach(l => { const i = l.findIndex(e => e.id === sel); if (i >= 0) l.splice(i, 1); }); sel = null; save(); renderVorlagen(); }
function verdoppeln() { const v = V(); if (!v || !sel) return; merke(); const nid = neueId(); beideListen(v).forEach(l => { const e = l.find(x => x.id === sel); if (e) l.push({ ...clone(e), id: nid, x: Math.min(95, e.x + 3), y: Math.min(95, e.y + 3) }); }); sel = nid; save(); renderVorlagen(); }
function ebene(d: number) { const v = V(); if (!v || !sel) return; merke(); beideListen(v).forEach(l => { const i = l.findIndex(e => e.id === sel), j = i + d; if (i >= 0 && j >= 0 && j < l.length) l.splice(j, 0, l.splice(i, 1)[0]); }); save(); renderVorlagen(); }

let buehne: HTMLCanvasElement = null, rahmen: HTMLElement = null, overlay: HTMLElement = null, kopfEl: HTMLElement = null;
function malBuehne(now: number) {
  if (!buehne || !buehne.isConnected || !V()) return;
  const r = buehne.getBoundingClientRect(), f = Math.min(devicePixelRatio || 1, 2), w = Math.round(r.width * f), hh = Math.round(r.height * f);
  if (!w || !hh) return; if (buehne.width !== w || buehne.height !== hh) { buehne.width = w; buehne.height = hh; }
  const v = V(), ende = skala(v), t = playAt ? Math.max(0, now - playAt) / 1000 : 99;
  if (playAt && t > ende) { playAt = 0; renderWerkzeuge(); }
  const x = buehne.getContext('2d'); x.save(); useMarke(M());
  const vv = orient === 'hoch' && !v.hoch ? { ...v, hoch: null } : v;
  drawDesign(x, w, hh, daten(M()), t, vv, {}, { platz: true }); x.restore();
  if (kopfEl) { kopfEl.hidden = !playAt; kopfEl.style.left = Math.min(100, t / ende * 100) + '%'; }
}
function renderSel() {
  if (!overlay) return; overlay.replaceChildren();
  const e = sel && elById(sel); if (!e) return;
  const b = h('div', { class: 'sel' + (e.frei ? ' frei' : ''), style: `left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%`, 'data-frei': e.frei ? 'Kunde füllt aus: ' + e.frei : null },
    ['nw', 'ne', 'sw', 'se'].map(k => h('i', { 'data-h': k })));
  overlay.append(b);
}
// Ziehen und Größe ändern. Rastet auf 0,5 % ein und an der Mitte der Folie.
function ziehen(ev: PointerEvent) {
  const r = rahmen.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * 100, py = (ev.clientY - r.top) / r.height * 100;
  const handle = (ev.target as HTMLElement).dataset && (ev.target as HTMLElement).dataset.h;
  let e = sel && elById(sel);
  if (!handle) {
    const hit = [...els()].reverse().find(x => px >= x.x && px <= x.x + x.w && py >= x.y && py <= x.y + x.h);
    sel = hit ? hit.id : null; e = hit; renderSel(); renderEig(); renderZeit();
    if (!hit) return;
  }
  ev.preventDefault(); merke(); hochAnlegen(); e = elById(sel);
  const st = { ...e }, sx = px, sy = py; let moved = false;
  const snap = (v: number) => Math.round(v * 2) / 2;
  const guides = () => overlay.querySelectorAll('.hilfs').forEach(g => g.remove());
  const mv = (m: PointerEvent) => {
    const dx = (m.clientX - r.left) / r.width * 100 - sx, dy = (m.clientY - r.top) / r.height * 100 - sy; moved = true;
    if (!handle) {
      e.x = snap(st.x + dx); e.y = snap(st.y + dy); guides();
      if (Math.abs(e.x + e.w / 2 - 50) < 1.2) { e.x = 50 - e.w / 2; overlay.append(h('div', { class: 'hilfs', style: 'left:50%;top:0;bottom:0;width:1px' })); }
      if (Math.abs(e.y + e.h / 2 - 50) < 1.2) { e.y = 50 - e.h / 2; overlay.append(h('div', { class: 'hilfs', style: 'top:50%;left:0;right:0;height:1px' })); }
    } else {
      if (handle.includes('e')) e.w = Math.max(2, snap(st.w + dx)); if (handle.includes('s')) e.h = Math.max(2, snap(st.h + dy));
      if (handle.includes('w')) { e.x = snap(st.x + dx); e.w = Math.max(2, snap(st.w - dx)); } if (handle.includes('n')) { e.y = snap(st.y + dy); e.h = Math.max(2, snap(st.h - dy)); }
    }
    const sb = overlay.querySelector('.sel') as HTMLElement; if (sb) sb.style.cssText = `left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%`;
  };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); guides(); if (!moved) undo.pop(); else { save(); renderEig(); renderListe(); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
function farbWahl(label: string, wert: string | undefined, set: (v: string) => void) {
  const m = M(), istRolle = !wert || FARBROLLEN.some(r => r[0] === wert);
  return h('div', null, h('span', { class: 'label' }, label), h('div', { class: 'rollen' },
    FARBROLLEN.map(([k, l]) => h('button', { style: 'background:' + farbe(k, daten(m)), title: l, 'aria-label': l, 'aria-pressed': String(wert === k), onclick: () => set(k) })),
    h('input', { type: 'color', value: istRolle ? '#888888' : wert, title: 'Eigene Farbe (nicht aus der Marke)', 'aria-label': 'Eigene Farbe', onchange: (e: any) => set(e.target.value) }),
    !istRolle ? h('span', { class: 'small' }, 'eigene Farbe') : null));
}
let eigEl: HTMLElement = null, listeEl: HTMLElement = null, zeitEl: HTMLElement = null, werkEl: HTMLElement = null;
function renderEig() {
  if (!eigEl) return; const v = V(); if (!v) { eigEl.replaceChildren(); return; }
  const e = sel && elById(sel);
  if (!e) {
    eigEl.replaceChildren(h('div', { class: 'box' }, h('h3', null, 'Vorlage'),
      h('div', null, h('label', { for: 'vName' }, 'Name'), h('input', { type: 'text', id: 'vName', value: v.name, oninput: (ev: any) => { v.name = ev.target.value; save(); renderListeSoon(); } })),
      farbWahl('Hintergrund', v.hinter, k => { merke(); v.hinter = k; save(); renderEig(); }),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!v.hinter2, onchange: (ev: any) => { merke(); v.hinter2 = ev.target.checked ? (v.hinter === 'dunkel' ? 'primaer' : 'dunkel') : undefined; save(); renderEig(); } }), 'Verlauf'),
      v.hinter2 ? farbWahl('Verlauf nach', v.hinter2, k => { merke(); v.hinter2 = k; save(); renderEig(); }) : null,
      h('div', null, h('span', { class: 'label' }, 'Hochkant'), v.hoch ? h('div', { class: 'row' }, h('span', { class: 'small' }, 'Eigene Fassung für hochkant.'), h('button', { class: 'btn sm ghost', onclick: () => { merke(); v.hoch = null; save(); renderVorlagen(); } }, 'Zurücksetzen'))
        : h('span', { class: 'small' }, 'Hochkant nutzt die Querfassung. Oben auf „Hochkant“ stellen und verschieben, dann entsteht eine eigene Fassung.')),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { merke(); const c = { ...clone(v), id: neueId(), name: v.name + ' (Kopie)' }; M().vorlagen.splice(vi + 1, 0, c); vi++; save(); renderVorlagen(); } }, icon('copy'), 'Duplizieren'),
        h('button', { class: 'btn sm ghost danger', onclick: () => { merke(); M().vorlagen.splice(vi, 1); vi = Math.max(0, vi - 1); sel = null; save(); renderVorlagen(); toast('Vorlage gelöscht. Strg + Z holt sie zurück.'); } }, icon('trash'), 'Löschen'))),
      h('div', { class: 'box' }, h('h3', null, 'So geht’s'), h('span', { class: 'small' }, 'Element anklicken, ziehen, an den Ecken die Größe ändern. Pfeiltasten schieben, Entf löscht, Strg + D verdoppelt, Strg + Z macht rückgängig. Farben und Schriften sind Rollen der Marke: ändert sich die Marke, ändert sich die Vorlage mit.')));
    return;
  }
  const num = (k: keyof El, label: string, step = .5) => h('div', null, h('label', null, label), h('input', { type: 'number', step, value: Math.round(((e as any)[k] ?? 0) * 10) / 10, onchange: (ev: any) => setze(k, +ev.target.value) }));
  const typName = { text: 'Text', form: 'Fläche', bild: 'Bild', logo: 'Logo', qr: 'QR-Code' }[e.typ];
  const teile: Kid[] = [];
  if (e.typ === 'text' || e.typ === 'qr') teile.push(h('div', null, h('label', { for: 'eText' }, e.typ === 'qr' ? 'Link' : 'Text'), h('textarea', { id: 'eText', rows: e.typ === 'qr' ? 1 : 3, oninput: (ev: any) => { beideListen().forEach(l => { const x = l.find(y => y.id === e.id); if (x) x.text = ev.target.value; }); save(); } , onfocus: () => merke() }, e.text || '')),
    e.typ === 'text' ? h('span', { class: 'small' }, 'Platzhalter: {name}, {zeiten}, {datum}, {1.2} = Eintrag 1, Spalte 2 aus der Preisliste.') : null);
  if (e.typ === 'text') teile.push(
    h('div', { class: 'grid2' }, h('div', null, h('span', { class: 'label' }, 'Schrift'), h('div', { class: 'seg' }, (['titel', 'text'] as const).map(r => h('button', { 'aria-pressed': String((e.rolle || 'text') === r), onclick: () => setze('rolle', r) }, r === 'titel' ? 'Titel' : 'Text')))),
      num('gr', 'Größe', .5)),
    h('div', { class: 'grid2' }, h('div', null, h('label', null, 'Stärke'), h('select', { onchange: (ev: any) => setze('gewicht', +ev.target.value) }, [[400, 'Normal'], [500, 'Mittel'], [600, 'Halbfett'], [700, 'Fett'], [800, 'Extrafett']].map(([w, l]) => h('option', { value: w, selected: (e.gewicht || (e.rolle === 'titel' ? 800 : 500)) === w }, l)))),
      h('div', null, h('span', { class: 'label' }, 'Ausrichtung'), h('div', { class: 'seg' }, (['left', 'center', 'right'] as const).map(a => h('button', { 'aria-pressed': String((e.ausr || 'left') === a), onclick: () => setze('ausr', a) }, a === 'left' ? 'links' : a === 'center' ? 'Mitte' : 'rechts'))))),
    h('div', { class: 'grid2' }, h('div', null, h('span', { class: 'label' }, 'Senkrecht'), h('div', { class: 'seg' }, (['oben', 'mitte', 'unten'] as const).map(a => h('button', { 'aria-pressed': String((e.vert || 'oben') === a), onclick: () => setze('vert', a) }, a)))),
      h('label', { class: 'check', style: 'align-self:end;height:30px' }, h('input', { type: 'checkbox', checked: !!e.gross, onchange: (ev: any) => setze('gross', ev.target.checked || undefined) }), 'Versalien')),
    farbWahl('Farbe', e.farbe, k => setze('farbe', k)));
  if (e.typ === 'form') teile.push(farbWahl('Füllung', e.fuell, k => setze('fuell', k)),
    h('div', { class: 'grid2' }, h('div', null, h('span', { class: 'label' }, 'Form'), h('div', { class: 'seg' }, (['rechteck', 'kreis'] as const).map(f => h('button', { 'aria-pressed': String((e.form || 'rechteck') === f), onclick: () => setze('form', f) }, f === 'kreis' ? 'Kreis' : 'Rechteck')))), num('ecken', 'Ecken (%)', 1)));
  if (e.typ === 'qr') teile.push(farbWahl('Punkte', e.farbe, k => setze('farbe', k)), farbWahl('Grund', e.fuell, k => setze('fuell', k)));
  if (e.typ === 'bild') teile.push(h('div', { class: 'row' }, h('span', { class: 'btn sm' }, icon('upload'), e.bild ? 'Bild ersetzen' : 'Bild wählen', h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Bild wählen', onchange: async (ev: any) => { const f = ev.target.files[0]; if (!f) return; setze('bild', await bildKlein(f, 1600)); } })),
    h('div', { class: 'seg' }, (['cover', 'contain'] as const).map(p => h('button', { 'aria-pressed': String((e.passt || 'cover') === p), onclick: () => setze('passt', p) }, p === 'cover' ? 'Füllen' : 'Ganz zeigen')))), num('ecken', 'Ecken (%)', 1));
  if (e.typ === 'logo') teile.push(h('span', { class: 'small' }, 'Zeigt das Logo der Marke. Ohne Logo steht dort der Name.'), h('div', null, h('span', { class: 'label' }, 'Ausrichtung'), h('div', { class: 'seg' }, (['left', 'center', 'right'] as const).map(a => h('button', { 'aria-pressed': String((e.ausr || 'center') === a), onclick: () => setze('ausr', a) }, a === 'left' ? 'links' : a === 'center' ? 'Mitte' : 'rechts')))));
  fill(eigEl,
    h('div', { class: 'box' }, h('div', { class: 'row' }, h('h3', null, typName), h('span', { class: 'grow' }),
      h('button', { class: 'btn sm ghost', title: 'Nach vorn', 'aria-label': 'Nach vorn', onclick: () => ebene(1) }, icon('up')), h('button', { class: 'btn sm ghost', title: 'Nach hinten', 'aria-label': 'Nach hinten', onclick: () => ebene(-1) }, icon('down')),
      h('button', { class: 'btn sm ghost', title: 'Verdoppeln (Strg + D)', 'aria-label': 'Verdoppeln', onclick: verdoppeln }, icon('copy')), h('button', { class: 'btn sm ghost danger', title: 'Löschen (Entf)', 'aria-label': 'Löschen', onclick: loeschen }, icon('trash'))),
      teile,
      h('div', null, h('span', { class: 'label' }, 'Lage und Größe in %' + (orient === 'hoch' ? ' (hochkant)' : '')), h('div', { class: 'grid4' }, (['x', 'y', 'w', 'h'] as const).map(k => h('input', { type: 'number', step: .5, value: Math.round(e[k] * 10) / 10, 'aria-label': { x: 'Links', y: 'Oben', w: 'Breite', h: 'Höhe' }[k], title: { x: 'Links', y: 'Oben', w: 'Breite', h: 'Höhe' }[k], onchange: (ev: any) => { setze(k, +ev.target.value); renderSel(); } })))),
      h('div', null, h('label', null, 'Deckkraft'), h('input', { type: 'range', min: .05, max: 1, step: .05, value: e.deck ?? 1, onchange: (ev: any) => setze('deck', +ev.target.value === 1 ? undefined : +ev.target.value) }))),
    h('div', { class: 'box' }, h('h3', null, 'Animation'),
      h('select', { 'aria-label': 'Animation', onchange: (ev: any) => { setze('anim', ev.target.value); playAt = performance.now(); renderWerkzeuge(); } }, ANIMS.filter(([a]) => a !== 'kenburns' || e.typ === 'bild').map(([a, l]) => h('option', { value: a, selected: (e.anim || 'keine') === a }, l))),
      (e.anim || 'keine') !== 'keine' ? h('div', { class: 'grid2 zeitfelder' }, num('start', 'Start nach (s)', .1), e.anim !== 'puls' && e.anim !== 'kenburns' ? num('dauer', 'Dauer (s)', .1) : null) : null),
    e.typ !== 'form' ? h('div', { class: 'frei-box' },
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!e.frei, onchange: (ev: any) => setze('frei', ev.target.checked ? (e.typ === 'bild' ? 'Bild' : e.typ === 'qr' ? 'Link' : 'Text') : undefined) }), 'Kunde darf das im Panel ausfüllen'),
      e.frei ? h('div', null, h('label', { for: 'eFrei' }, 'Name des Feldes im Panel'), h('input', { type: 'text', id: 'eFrei', value: e.frei, oninput: (ev: any) => { beideListen().forEach(l => { const x = l.find(y => y.id === e.id); if (x) x.frei = ev.target.value || 'Feld'; }); save(); renderSel(); } }))
        : h('span', { class: 'small' }, icon('lock'), ' Gesperrt: bleibt genau so, wie gestaltet.')) : null);
}
let listeT: any; const renderListeSoon = () => { clearTimeout(listeT); listeT = setTimeout(renderListe, 300); };
function renderListe() {
  if (!listeEl) return; const m = M();
  fill(listeEl, h('h3', null, 'Vorlagen von ' + (m.name || 'Kunde')),
    m.vorlagen.map((v, i) => h('button', { class: 'vitem', 'aria-current': String(i === vi), onclick: () => { vi = i; sel = null; renderVorlagen(); } }, leinwand((x, w, hh) => { useMarke(m); drawDesign(x, w, hh, daten(m), 99, v); }), h('b', null, v.name))),
    h('h3', { style: 'margin-top:6px' }, 'Neu anfangen'),
    h('div', { class: 'starter' }, STARTER.map(s => h('button', { onclick: () => { merke(); m.vorlagen.push(s.make()); vi = m.vorlagen.length - 1; sel = null; playAt = performance.now(); save(); renderVorlagen(); } }, h('b', null, s.name), h('span', null, s.desc))),
      h('button', { onclick: () => { merke(); m.vorlagen.push(leereVorlage()); vi = m.vorlagen.length - 1; sel = null; save(); renderVorlagen(); } }, h('b', null, 'Leere Vorlage'), h('span', null, 'Nur eine Überschrift, alles andere baust du selbst.'))));
}
// Länge der Zeitleiste in Sekunden: etwas Luft hinter der letzten Animation, damit man Balken weiter nach rechts ziehen kann.
const skala = (v: DesignVorlage) => Math.max(4, Math.ceil(animEnde(v) + 1.5));
const sek = (n: number) => n.toFixed(1).replace('.', ',') + ' s';
const endlos = (e: El) => e.anim === 'puls' || e.anim === 'kenburns';
const balkenStil = (e: El, ende: number) => { const l = (e.start || 0) / ende * 100; return `left:${l}%;width:${endlos(e) ? 100 - l : Math.max(1.5, (e.dauer || .8) / ende * 100)}%`; };
const balkenTitel = (e: El) => endlos(e) ? 'Ab ' + sek(e.start || 0) + ', läuft bis zum Folienende' : sek(e.start || 0) + ' bis ' + sek((e.start || 0) + (e.dauer || .8));
// Start und Dauer gelten in Quer- und Hochkant-Fassung gleich, wie im Feld rechts.
function setzeZeit(id: string, start: number, dauer?: number) {
  beideListen().forEach(l => { const x = l.find(y => y.id === id); if (x) { x.start = start; if (dauer !== undefined) x.dauer = dauer; } });
}
// Balken ziehen: Mitte verschiebt den Start, die Kanten ändern Start oder Dauer. Rastet auf 0,1 s ein.
function balkenZiehen(ev: PointerEvent, e: El, b: HTMLElement, ende: number) {
  if (ev.button) return; ev.preventDefault(); ev.stopPropagation();
  const bahn = b.parentElement, br = bahn.getBoundingClientRect(), r = b.getBoundingClientRect(), pps = br.width / ende;
  const modus = endlos(e) ? 'mitte' : ev.clientX - r.left < 8 ? 'links' : r.right - ev.clientX < 8 ? 'rechts' : 'mitte';
  if (sel !== e.id) { sel = e.id; renderSel(); renderEig(); zeitEl.querySelectorAll('.zr').forEach(z => z.setAttribute('aria-current', String(z === b.closest('.zr')))); }
  merke(); const s0 = e.start || 0, d0 = e.dauer || .8, x0 = ev.clientX; let moved = false;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  b.classList.add('zieht'); b.setPointerCapture?.(ev.pointerId);
  const mv = (m: PointerEvent) => {
    const dt = (m.clientX - x0) / pps; if (!moved && Math.abs(m.clientX - x0) < 3) return; moved = true;
    let s = s0, d = d0;
    if (modus === 'mitte') s = Math.min(Math.max(0, r1(s0 + dt)), r1(ende - (endlos(e) ? .1 : d0)));
    else if (modus === 'rechts') d = Math.min(Math.max(.1, r1(d0 + dt)), r1(ende - s0));
    else { s = Math.min(Math.max(0, r1(s0 + dt)), r1(s0 + d0 - .1)); d = r1(s0 + d0 - s); }
    setzeZeit(e.id, s, endlos(e) ? undefined : d);
    b.style.cssText = balkenStil(e, ende); b.dataset.zeit = balkenTitel(e);
    const felder = eigEl.querySelectorAll<HTMLInputElement>('.zeitfelder input'); if (felder[0]) felder[0].value = String(e.start); if (felder[1]) felder[1].value = String(e.dauer);
  };
  const up = () => {
    b.removeEventListener('pointermove', mv); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); b.classList.remove('zieht');
    if (!moved) { undo.pop(); return; }
    save(); renderEig(); renderZeit(); playAt = performance.now(); renderWerkzeuge();
  };
  b.addEventListener('pointermove', mv); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
}
// Tastatur: Pfeile verschieben, mit Umschalt ändern sie die Dauer.
function balkenTaste(ev: KeyboardEvent, e: El) {
  const d = ev.key === 'ArrowRight' ? .1 : ev.key === 'ArrowLeft' ? -.1 : 0; if (!d) return; ev.preventDefault(); ev.stopPropagation();
  merke(); sel = e.id;
  if (ev.shiftKey && !endlos(e)) setzeZeit(e.id, e.start || 0, Math.max(.1, Math.round(((e.dauer || .8) + d) * 10) / 10));
  else setzeZeit(e.id, Math.max(0, Math.round(((e.start || 0) + d) * 10) / 10));
  save(); renderSel(); renderEig(); renderZeit();
  (zeitEl.querySelector(`[data-id="${e.id}"]`) as HTMLElement)?.focus();
}
function renderZeit() {
  if (!zeitEl) return; const v = V(); if (!v) return;
  const an = els().filter(e => e.anim && e.anim !== 'keine'), ende = skala(v), schritt = ende > 12 ? 2 : 1;
  kopfEl = h('div', { class: 'kopf', hidden: true });
  fill(zeitEl, h('div', { class: 'row' }, h('h3', null, 'Zeitleiste'), h('span', { class: 'small' }, an.length ? 'Balken ziehen verschiebt den Start, an den Kanten ziehen ändert die Dauer. Anklicken wählt das Element aus.' : 'Noch keine Animation. Element wählen, rechts unter „Animation“ einstellen.')),
    an.length ? h('div', { class: 'zr lineal', 'aria-hidden': 'true' }, h('span'), h('div', { class: 'skala' }, Array.from({ length: Math.ceil(ende / schritt) }, (_, i) => h('i', { style: `left:${i * schritt / ende * 100}%` }, i * schritt + ' s')))) : null,
    an.map(e => h('div', { class: 'zr', 'aria-current': String(e.id === sel), onclick: () => { sel = e.id; renderSel(); renderEig(); renderZeit(); } },
      h('span', null, ({ text: 'Text', form: 'Fläche', bild: 'Bild', logo: 'Logo', qr: 'QR' } as any)[e.typ] + (e.typ === 'text' || e.typ === 'qr' ? ': ' + (e.text || '').slice(0, 18) : '') + ' · ' + ANIMS.find(a => a[0] === e.anim)[1]),
      h('div', { class: 'bahn' }, (() => {
        const b: HTMLElement = h('b', { class: endlos(e) ? 'endlos' : null, style: balkenStil(e, ende), tabindex: 0, role: 'slider', 'data-id': e.id, 'data-zeit': balkenTitel(e), title: balkenTitel(e),
          'aria-label': 'Start der Animation', 'aria-valuemin': 0, 'aria-valuemax': ende, 'aria-valuenow': e.start || 0, 'aria-valuetext': balkenTitel(e),
          onclick: (ev: Event) => ev.stopPropagation(), onkeydown: (ev: KeyboardEvent) => balkenTaste(ev, e) });
        b.onpointerdown = (ev: PointerEvent) => balkenZiehen(ev, e, b, ende);
        b.onpointermove = (ev: PointerEvent) => { if (ev.buttons || endlos(e)) return; const r = b.getBoundingClientRect(); b.style.cursor = ev.clientX - r.left < 8 || r.right - ev.clientX < 8 ? 'ew-resize' : 'grab'; };
        return b;
      })()))),
    an.length ? h('div', { class: 'bahn', style: 'margin:0 4px 0 144px;background:transparent;height:6px' }, kopfEl) : null);
}
function renderWerkzeuge() {
  if (!werkEl) return;
  const add = (typ: ElTyp, ic: string, l: string, extra: Partial<El> = {}) => h('button', { class: 'btn sm', onclick: () => neuesEl(typ, extra) }, icon(ic), l);
  werkEl.replaceChildren(add('text', 'text', 'Text'), add('form', 'rect', 'Fläche'), add('form', 'circle', 'Kreis', { form: 'kreis', w: 20, h: 35.5 }), add('bild', 'image', 'Bild'), add('logo', 'logo', 'Logo'), add('qr', 'qr', 'QR'),
    h('span', { class: 'sep' }),
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Ausrichtung' }, (['quer', 'hoch'] as const).map(o => h('button', { 'aria-pressed': String(orient === o), onclick: () => { orient = o; renderVorlagen(); } }, o === 'quer' ? 'Quer' : 'Hochkant' + (V() && !V().hoch && o === 'hoch' ? ' (aus Quer)' : '')))),
    h('span', { class: 'grow' }),
    h('button', { class: 'btn sm ghost', title: 'Rückgängig (Strg + Z)', 'aria-label': 'Rückgängig', onclick: zurueck }, icon('undo')),
    h('button', { class: 'btn sm primary', onclick: () => { playAt = performance.now(); renderWerkzeuge(); } }, icon('play'), playAt ? 'Läuft …' : 'Abspielen'));
}
function renderVorlagen() {
  const m = M(), main = $('main');
  useMarke(m);
  if (vi >= m.vorlagen.length) vi = Math.max(0, m.vorlagen.length - 1);
  listeEl = h('div', { class: 'liste' }); eigEl = h('div', { class: 'eig' }); zeitEl = h('div', { class: 'zeit' }); werkEl = h('div', { class: 'werkzeuge' });
  if (!m.vorlagen.length) {
    buehne = null; overlay = null;
    main.replaceChildren(h('div', { class: 'editor' }, listeEl, h('div', { class: 'mitte' }, h('div', { class: 'box', style: 'align-items:flex-start' }, h('h2', null, 'Noch keine eigene Vorlage'), h('p', { class: 'small' }, 'Links einen Startpunkt wählen. Er erscheint sofort in den Farben und Schriften von „' + m.name + '“. Danach Texte, Bilder und Animationen anpassen.'))), h('div')));
    renderListe(); return;
  }
  buehne = h('canvas'); overlay = h('div', { style: 'position:absolute;inset:0' });
  rahmen = h('div', { class: 'rahmen' + (orient === 'hoch' ? ' hoch' : ''), onpointerdown: ziehen, onpointermove: (ev: PointerEvent) => {
    if (ev.buttons) return; const r = rahmen.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width * 100, py = (ev.clientY - r.top) / r.height * 100;
    const hit = [...els()].reverse().find(x => px >= x.x && px <= x.x + x.w && py >= x.y && py <= x.y + x.h); rahmen.style.cursor = hit ? 'move' : 'default';
  } }, buehne, overlay);
  main.replaceChildren(h('div', { class: 'editor' }, listeEl, h('div', { class: 'mitte' }, werkEl, h('div', { class: 'buehne' }, rahmen), zeitEl), eigEl));
  renderListe(); renderWerkzeuge(); renderEig(); renderSel(); renderZeit();
}
addEventListener('keydown', (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName, typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); zurueck(); return; }
  if (tab !== 'vorlagen' || typing || !sel) return;
  const el = elById(sel); if (!el) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); loeschen(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); verdoppeln(); return; }
  if (e.key === 'Escape') { sel = null; renderSel(); renderEig(); return; }
  const d = e.shiftKey ? 5 : .5, mv: any = { ArrowLeft: ['x', -d], ArrowRight: ['x', d], ArrowUp: ['y', -d], ArrowDown: ['y', d] }[e.key];
  if (mv) { e.preventDefault(); merke(); hochAnlegen(); const x = elById(sel); x[mv[0]] = Math.round((x[mv[0]] + mv[1]) * 2) / 2; save(); renderSel(); }
});

// ---------- Reiter: Für Agenturen ----------
function renderPartner() {
  const ja = '✓', nein = '–';
  $('main').replaceChildren(h('div', { class: 'info' },
    h('h2', { style: 'font-size:24px' }, 'So arbeiten Werbeagenturen mit ShowCube'),
    h('p', { class: 'small', style: 'font-size:14px' }, 'Die Agentur gestaltet Marke und Vorlagen, der Kunde füllt im Alltag nur Texte, Preise und Bilder aus. Das CI bleibt sauber, und niemand muss für eine Preisänderung die Agentur anrufen.'),
    h('div', { class: 'schritte' },
      [['Kunde lädt die Agentur ein', 'Im Panel unter „Vorlagen“ auf „Agentur einladen“. Die Agentur bekommt einen Partner-Zugang nur für Gestaltung.'],
       ['Agentur gestaltet hier', 'Logo, Farben, Schriften, Übergänge, dazu eigene Vorlagen mit Animationen. Für jeden Kunden getrennt, oben umschalten.'],
       ['Felder freigeben', 'Pro Element festlegen, ob der Kunde es ausfüllen darf (Preis, Überschrift, Foto) oder ob es fest bleibt (Logo, Formen, Farben).'],
       ['Übergeben', '„Ins Panel übernehmen“ oder das Markenpaket als Datei schicken. Ab dann laufen alle Folien des Kunden in seinem CI.']].map(([t, p], i) =>
        h('div', { class: 'box' }, h('div', { class: 'nr' }, String(i + 1)), h('b', null, t), h('span', { class: 'small' }, p)))),
    h('div', { class: 'box' }, h('h3', null, 'Wer darf was'),
      h('table', { class: 'rechte' }, h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Kunde'), h('th', null, 'Agentur'))),
        h('tbody', null, [['Marke: Logo, Farben, Schriften, Übergänge', ja, ja], ['Eigene Vorlagen gestalten und Felder freigeben', 'auf Wunsch', ja], ['Freigegebene Felder ausfüllen (Preis, Text, Foto)', ja, ja],
          ['Slideshows veröffentlichen', ja, nein], ['Bildschirme steuern, Fernwartung', ja, nein], ['Abo und Rechnungen', ja, nein], ['Mehrere Kunden in einer Ansicht', nein, ja]].map(r => h('tr', null, r.map((c, i) => h(i ? 'td' : 'td', null, c))))))),
    h('div', { class: 'box' }, h('h3', null, 'Stand im Prototyp'),
      h('span', { class: 'small' }, 'Der Designer läuft ohne Konto, alles liegt in diesem Browser. Übergabe ans Panel geht im selben Browser direkt, sonst als Datei. Echte Partner-Zugänge mit Einladung per E-Mail kommen mit dem nächsten Backend-Schritt. Idee fürs Geschäft: Agenturen als Vertriebspartner, sie richten Kunden ein und bekommen eine Provision aufs Abo.'))));
}

function render() { renderKopf(); if (tab === 'marke') renderMarke(); else if (tab === 'vorlagen') renderVorlagen(); else renderPartner(); }
Promise.all([fontsReady(), useMarke(M())]).then(() => { render(); requestAnimationFrame(takt); }, () => { render(); requestAnimationFrame(takt); });
