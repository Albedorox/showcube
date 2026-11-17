// Marken-Kit: Logo, Farben, Schriften und Bewegung eines Betriebs.
//
// Eine Marke gilt für alle Folien eines Betriebs: die Branchenvorlagen (Menütafel, Objekte, Angebote),
// die Bausteine und die eigenen Vorlagen aus dem Vorlagen-Designer. Wer die Marke ändert, ändert alles auf einmal.
//
// Die Marke ist bewusst eine einzige JSON-Datei ("Markenpaket", showcube-marke.json), Logo und Schriften
// stecken als data:-URL darin. So kann eine Werbeagentur sie gestalten und als Datei übergeben,
// das Panel speichert sie beim Betrieb (betriebe.einstellungen.marke) und das Paket nimmt sie zur Box mit.
import { setFonts } from './templates';
import type { DesignVorlage } from './design';

export const MARKE_FORMAT = 'showcube-marke';
export const MARKE_VERSION = 1;

export interface Schrift { name: string; data?: string; }   // data: eigene Schrift als data:-URL (woff2, woff, ttf, otf)
export type Uebergang = 'blende' | 'schieben' | 'zoom' | 'hart';
export interface Marke {
  format: typeof MARKE_FORMAT; version: number;
  name: string;                       // Name des Betriebs, wie er auf den Folien steht
  agentur?: string;                   // Wer hat das gestaltet (z. B. Werbeagentur), steht im Panel dabei
  logo?: string;                      // data:-URL
  farben: { primaer: string; zweit: string; dunkel: string; hell: string };
  schrift: { titel: Schrift; text: Schrift };
  bewegung: { uebergang: Uebergang; tempo: number; einflug: boolean };   // tempo: Sekunden fürs Überblenden
  vorlagen: DesignVorlage[];
  geaendert: string;
}

// Schriften, die in jeder ShowCube-Datei stecken und deshalb auch offline auf der Box gehen.
export const SCHRIFTEN = [
  { name: 'Bricolage Grotesque', art: 'Grotesk, kräftig' },
  { name: 'Figtree', art: 'Neutral, gut lesbar' },
  { name: 'Playfair Display', art: 'Serif, edel' },
  { name: 'Oswald', art: 'Schmal, laut' },
  { name: 'Nunito', art: 'Rund, freundlich' },
];
export const UEBERGAENGE: [Uebergang, string][] = [['blende', 'Überblenden'], ['schieben', 'Schieben'], ['zoom', 'Zoomen'], ['hart', 'Harter Schnitt']];

export function neueMarke(name = 'Mein Betrieb'): Marke {
  return {
    format: MARKE_FORMAT, version: MARKE_VERSION, name,
    farben: { primaer: '#0b7a67', zweit: '#f2b441', dunkel: '#14181a', hell: '#fbf8f1' },
    schrift: { titel: { name: 'Bricolage Grotesque' }, text: { name: 'Figtree' } },
    bewegung: { uebergang: 'blende', tempo: .8, einflug: true }, vorlagen: [], geaendert: new Date().toISOString(),
  };
}

export function markeAusDatei(text: string): Marke {
  const m = JSON.parse(text);
  if (!m || m.format !== MARKE_FORMAT) throw new Error('Das ist kein ShowCube-Markenpaket.');
  if (m.version > MARKE_VERSION) throw new Error('Das Markenpaket ist neuer als diese App.');
  const d = neueMarke(m.name);
  return { ...d, ...m, farben: { ...d.farben, ...m.farben }, schrift: { ...d.schrift, ...m.schrift }, bewegung: { ...d.bewegung, ...m.bewegung }, vorlagen: m.vorlagen || [] };
}
export const markeAlsDatei = (m: Marke) => new Blob([JSON.stringify({ ...m, geaendert: new Date().toISOString() }, null, 1)], { type: 'application/json' });

// ---------- Schriften laden ----------
// Eigene Schriften bekommen einen festen Namen, damit die Folien sie über die Marke finden.
const geladen = new Map<string, Promise<void>>();
function familie(s: Schrift, rolle: 'titel' | 'text') { return s.data ? 'Marke ' + rolle + ' ' + hashStr(s.data) : s.name; }
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i += 97) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
function ladeSchrift(fam: string, data: string): Promise<void> {
  if (!geladen.has(fam)) geladen.set(fam, (async () => {
    try { const f = new FontFace(fam, `url(${data})`); await f.load(); (document.fonts as any).add(f); } catch (e) { /* kaputte Datei: Ersatzschrift */ }
  })());
  return geladen.get(fam);
}
// Schriften der Marke für alle Folien setzen. Ohne Marke gelten wieder die ShowCube-Schriften.
// Gibt ein Promise zurück, das erfüllt ist, sobald eigene Schriften geladen sind.
export function useMarke(m: Marke | null | undefined): Promise<unknown> {
  if (!m) { setFonts(); return Promise.resolve(); }
  const t = familie(m.schrift.titel, 'titel'), b = familie(m.schrift.text, 'text');
  setFonts(t, b);
  const w: Promise<unknown>[] = [];
  if (m.schrift.titel.data) w.push(ladeSchrift(t, m.schrift.titel.data));
  if (m.schrift.text.data) w.push(ladeSchrift(b, m.schrift.text.data));
  if (document.fonts) { w.push(document.fonts.load(`800 20px "${t}"`).catch(() => {}), document.fonts.load(`500 20px "${b}"`).catch(() => {})); }
  return Promise.all(w);
}

// ---------- Logo ----------
const logos = new Map<string, HTMLImageElement>();
export function logoBild(m: Marke | null | undefined): HTMLImageElement | null {
  if (!m || !m.logo) return null;
  if (!logos.has(m.logo)) { const i = new Image(); i.src = m.logo; logos.set(m.logo, i); }
  const i = logos.get(m.logo); return i.complete && i.naturalWidth ? i : null;
}

// ---------- Farben aus dem Logo vorschlagen ----------
// Zählt kräftige Farben im verkleinerten Logo und schlägt die zwei häufigsten vor, die sich gut unterscheiden.
export function farbenAusBild(img: HTMLImageElement): { primaer: string; zweit: string } | null {
  const n = 64, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true }); if (!x) return null;
  const s = Math.min(n / img.naturalWidth, n / img.naturalHeight); x.drawImage(img, 0, 0, img.naturalWidth * s, img.naturalHeight * s);
  const d = x.getImageData(0, 0, n, n).data, bins = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3]; if (a < 160) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 40 || mx < 40 || mn > 235) continue;   // grau, schwarz, weiß weglassen
    const k = (r >> 5) << 6 | (g >> 5) << 3 | (b >> 5), e = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += r; e.g += g; e.b += b; bins.set(k, e);
  }
  const top = [...bins.values()].sort((a, b) => b.n - a.n).map(e => [e.r / e.n, e.g / e.n, e.b / e.n]);
  if (!top.length) return null;
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const second = top.find(t => dist(t, top[0]) > 90);
  const hex = (t: number[]) => '#' + t.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  return { primaer: hex(top[0]), zweit: second ? hex(second) : hex(top[0].map(v => Math.min(255, v + 90))) };
}

// Lesbarkeit: Kontrast nach WCAG zwischen zwei Farben (1 bis 21). Ab 4,5 gut lesbar, ab 3 für große Schrift.
export function kontrast(a: string, b: string) {
  const L = (hx: string) => { const v = [1, 3, 5].map(i => parseInt(hx.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; };
  const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
