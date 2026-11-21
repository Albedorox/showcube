// „Vorlage aus Bild“: aus einem fertigen Plakat, Flyer oder einer alten Folie eine bearbeitbare Vorlage machen.
//
// Zwei Wege, beide enden in derselben Zwischenform (Erkennung: Liste von Elementen mit Lage in Prozent):
// - SVG ohne KI: Die Datei hat schon Ebenen. Texte, Rechtecke, Kreise und eingebettete Bilder werden direkt gelesen
//   (im Browser gemessen, auch mit Verschiebungen und Skalierung). Was sich nicht abbilden lässt (Pfade, Verläufe),
//   kommt als ein freigestelltes Bild „Grafik aus der Datei“ ganz nach hinten.
// - Bild mit KI (Pro): PNG, JPEG oder WebP geht an die Edge Function `vorlage-aus-bild` (supabase/functions/),
//   die Claude fragt. Der Schlüssel dafür liegt nur auf dem Server. Angemeldet wird mit dem Konto aus dem Panel
//   (gleiche Sitzung im selben Browser).
//
// vorlageAusErkennung() macht daraus eine DesignVorlage: Farben werden zu Rollen der Marke, wenn sie nah dran sind,
// Fotos und Grafiken werden aus dem Original ausgeschnitten (Text, der darauf lag, wird dabei grob übermalt, weil er
// ja als eigene Ebene wiederkommt), Preise und Überschriften werden auf Wunsch zu Feldern für den Kunden, und jedes
// Element bekommt eine ruhige Einflug-Animation, nacheinander.
import { neueId, type DesignVorlage, type El, type Farbe } from '../shared/design';
import { hatTransparenz } from '../shared/bild';
import type { Marke } from '../shared/marke';
import { hatServer, verbinden, type SupabaseClient } from '../shared/cloud';

// ---------- Zwischenform (so liefert sie auch die KI, siehe SCHEMA in der Edge Function) ----------
export type Art = 'text' | 'flaeche' | 'kreis' | 'bild' | 'logo' | 'qr';
export interface RohEl {
  art: Art; x: number; y: number; w: number; h: number;
  text?: string | null; zeilenhoehe?: number | null; gewicht?: number | null; schrift?: 'titel' | 'text' | null;
  ausrichtung?: 'left' | 'center' | 'right' | null; vertikal?: 'oben' | 'mitte' | 'unten' | null; grossbuchstaben?: boolean;
  farbe?: string | null; fuellung?: string | null; hinterlegt?: string | null; ecken?: number | null; deckkraft?: number | null;
  feld?: string | null; beschreibung?: string | null;
  bild?: string;   // nur SVG-Weg: schon fertig gerendertes Bild (data:-URL), sonst wird aus dem Original ausgeschnitten
}
export interface Erkennung { name: string; hintergrund: string; verlauf?: string | null; farben?: Record<string, string>; elemente: RohEl[]; }

/** Ein geladenes Bild: Original als Leinwand (für Ausschnitte) und Maße. */
export interface Quelle { name: string; art: 'svg' | 'bild'; cv: HTMLCanvasElement; breite: number; hoehe: number; svg?: string; }

export interface Optionen {
  farben: 'bild' | 'marke';   // bild = Farben wie im Bild (nahe Markenfarben werden Rollen), marke = alles in Markenfarben
  felder: boolean;            // Preise, Überschriften, Fotos als Felder für den Kunden freigeben
  animieren: boolean;         // Einflug-Animationen nacheinander
  textWeg: boolean;           // Text und Formen, die als eigene Ebene wiederkommen, aus ausgeschnittenen Fotos grob entfernen
}
export const STANDARD: Optionen = { farben: 'bild', felder: true, animieren: true, textWeg: true };

// ---------- Farben ----------
const hexRgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec((h || '').trim()); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const rgbHex = (r: number, g: number, b: number) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function abstand(a: number[], b: number[]) {   // grob wahrnehmungsgerecht ("redmean")
  const r = (a[0] + b[0]) / 2, d = [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  return Math.sqrt((2 + r / 256) * d[0] ** 2 + 4 * d[1] ** 2 + (2 + (255 - r) / 256) * d[2] ** 2);
}
const ROLLEN = ['primaer', 'zweit', 'dunkel', 'hell'] as const;
/** Farbe aus dem Bild → Rolle der Marke (wenn nah dran oder immer) oder eigene Farbe. */
export function farbeFuer(hex: string | null | undefined, m: Marke, immerRolle: boolean): Farbe | undefined {
  const c = hexRgb(hex || ''); if (!c) return undefined;
  let best: string = 'hell', d = Infinity;
  for (const r of ROLLEN) { const z = hexRgb(m.farben[r]); if (!z) continue; const x = abstand(c, z); if (x < d) { d = x; best = r; } }
  return immerRolle || d < 70 ? best : rgbHex(c[0], c[1], c[2]);
}

// ---------- Bilder laden und ausschneiden ----------
const MAX_KANTE = 2400;
function leinwandVon(img: CanvasImageSource, w: number, h: number, max = MAX_KANTE) {
  const s = Math.min(1, max / Math.max(w, h)), cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w * s)); cv.height = Math.max(1, Math.round(h * s));
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); return cv;
}
function ladeBild(src: string) { return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Das Bild konnte nicht gelesen werden.')); i.src = src; }); }
export const istSvg = (f: File) => f.type === 'image/svg+xml' || /\.svg$/i.test(f.name);

export async function quelleLaden(f: File): Promise<Quelle> {
  const roh = f.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim(), name = roh ? roh[0].toUpperCase() + roh.slice(1) : 'Vorlage aus Bild';
  if (istSvg(f)) {
    const svg = svgSaeubern(await f.text());
    const { w, h } = svgMasse(svg), img = await ladeBild(svgUrl(svg, w, h));
    return { name, art: 'svg', cv: leinwandVon(img, w, h, 1600), breite: w, hoehe: h, svg };
  }
  const url = URL.createObjectURL(f);
  try { const img = await ladeBild(url); return { name, art: 'bild', cv: leinwandVon(img, img.naturalWidth, img.naturalHeight), breite: img.naturalWidth, hoehe: img.naturalHeight }; }
  finally { URL.revokeObjectURL(url); }
}

const alsDataUrl = (cv: HTMLCanvasElement) => hatTransparenz(cv) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', .86);

/** Für die KI: höchstens 1568 px lange Kante (mehr wertet das Modell nicht aus), als JPEG, mit Transparenz als PNG. */
export function fuerKi(q: Quelle) {
  const cv = leinwandVon(q.cv, q.cv.width, q.cv.height, 1568), png = hatTransparenz(cv);
  const url = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', .88);
  return { bild: url.slice(url.indexOf(',') + 1), medientyp: png ? 'image/png' : 'image/jpeg', breite: cv.width, hoehe: cv.height };
}

// Bereich (in Prozent) aus dem Original ausschneiden. Was davor lag (Texte, Kreise, Flächen), grob übermalen:
// mit dem mittleren Farbton drumherum und weichgezeichnet. Es kommt ja als eigene Ebene wieder.
function ausschneiden(q: Quelle, e: RohEl, davor: RohEl[]): string {
  const W = q.cv.width, H = q.cv.height, px = (v: number, g: number) => Math.round(v / 100 * g);
  const x = Math.max(0, px(e.x, W)), y = Math.max(0, px(e.y, H)), w = Math.max(1, Math.min(W - x, px(e.w, W))), h = Math.max(1, Math.min(H - y, px(e.h, H)));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(q.cv, x, y, w, h, 0, 0, w, h);
  const enthalten = (a: RohEl, b: RohEl) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
  const deckend = davor.filter(t => t.art !== 'text' && (t.deckkraft == null || t.deckkraft >= .98));
  for (const t of davor) {
    const text = t.art === 'text';
    // Text, der ganz auf einer deckenden Form liegt (Preis im Kreis), ist im Ergebnis ohnehin verdeckt.
    if (text && deckend.some(f => enthalten(t, f))) continue;
    // Formen kommen deckend wieder, darum nur knapp übermalen und nicht weichzeichnen (sonst bleibt ein Hof).
    const rand = text ? Math.max(2, Math.round(Math.min(W, H) * .006)) : Math.max(1, Math.round(Math.min(W, H) * .0015));
    const tx = px(t.x, W) - x - rand, ty = px(t.y, H) - y - rand, tw = px(t.w, W) + 2 * rand, th = px(t.h, H) + 2 * rand;
    const x0 = Math.max(0, tx), y0 = Math.max(0, ty), x1 = Math.min(w, tx + tw), y1 = Math.min(h, ty + th);
    if (x1 - x0 < 2 || y1 - y0 < 2 || (x1 - x0) * (y1 - y0) > w * h * .85) continue;   // nicht drauf, oder deckt fast alles ab
    // Form des Übermalens: Kreise als Ellipse, sonst Rechteck (im ganzen Kasten, auch wenn er über den Rand ragt)
    const form = () => { c.beginPath(); if (t.art === 'kreis') c.ellipse(tx + tw / 2, ty + th / 2, tw / 2, th / 2, 0, 0, Math.PI * 2); else c.rect(tx, ty, tw, th); };
    // Mittlere Farbe in einem Ring um den Kasten
    const r = rand * 2, sx = Math.max(0, x0 - r), sy = Math.max(0, y0 - r), sw = Math.min(w, x1 + r) - sx, sh = Math.min(h, y1 + r) - sy;
    const d = c.getImageData(sx, sy, sw, sh).data; let n = 0; const s = [0, 0, 0];
    for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) {
      const ax = sx + xx, ay = sy + yy; if (ax >= x0 && ax < x1 && ay >= y0 && ay < y1) continue;
      const i = (yy * sw + xx) * 4; if (d[i + 3] < 128) continue; s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; n++;
    }
    if (!n) continue;
    c.save(); c.fillStyle = rgbHex(s[0] / n, s[1] / n, s[2] / n); form(); c.fill(); c.restore();
    if (text && 'filter' in c) { c.save(); c.beginPath(); c.rect(x0 - r, y0 - r, x1 - x0 + 2 * r, y1 - y0 + 2 * r); c.clip(); c.filter = `blur(${r}px)`; c.drawImage(cv, 0, 0); c.restore(); }
  }
  // Nicht größer speichern als nötig: das Markenpaket reist mit allen Bildern zur Box.
  return alsDataUrl(w > 1600 || h > 1600 ? leinwandVon(cv, w, h, 1600) : cv);
}

// ---------- Erkennung → Vorlage ----------
const z = (n: any, d = 0) => (typeof n === 'number' && isFinite(n) ? n : d);
const r1 = (n: number) => Math.round(n * 10) / 10;
const ueberlappt = (a: RohEl, b: RohEl) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function vorlageAusErkennung(erk: Erkennung, q: Quelle, m: Marke, opt: Optionen = STANDARD): { vorlage: DesignVorlage; hoch: boolean } {
  const immer = opt.farben === 'marke', roh = (erk.elemente || []).filter(e => e && z(e.w) > .2 && z(e.h) > .2);
  const hochkant = q.breite < q.hoehe;
  const els: El[] = []; let k = 0;
  const start = () => r1(.1 + (k++) * .15);
  for (const [i, e] of roh.entries()) {
    const x = r1(Math.max(0, Math.min(100, z(e.x)))), y = r1(Math.max(0, Math.min(100, z(e.y))));
    const w = r1(Math.max(.5, Math.min(100 - x, z(e.w)))), h = r1(Math.max(.5, Math.min(100 - y, z(e.h))));
    const deck = e.deckkraft != null && e.deckkraft < .98 ? Math.max(.05, r1(e.deckkraft * 100) / 100) : undefined;
    const grund: El = { id: neueId(), typ: 'text', x, y, w, h, deck, anim: 'keine', start: 0, dauer: .8 };
    const ganz = w >= 95 && h >= 95;
    const anim = (a: El['anim'], dauer = .8): Partial<El> => opt.animieren ? { anim: a, start: a === 'kenburns' ? 0 : start(), dauer } : {};
    if (e.art === 'text') {
      const txt = (e.text || '').trim(); if (!txt) continue;
      const zeilen = Math.max(1, txt.split('\n').length), zh = z(e.zeilenhoehe) > 0 ? z(e.zeilenhoehe) : h / zeilen;
      const titel = e.schrift ? e.schrift === 'titel' : zh > 7 || z(e.gewicht, 400) >= 700;
      const ausr = e.ausrichtung || 'left';
      // Etwas Luft in der Breite: die Schrift der Marke läuft meist etwas anders als die im Bild.
      const extra = Math.min(100 - w, w * .06), xx = ausr === 'center' ? Math.max(0, x - extra / 2) : ausr === 'right' ? Math.max(0, x - extra) : x;
      els.push({ ...grund, typ: 'text', text: e.grossbuchstaben ? txt.toUpperCase() : txt, x: r1(xx), w: r1(Math.min(100 - xx, w + extra)), h: r1(Math.min(100 - y, Math.max(h, zeilen * zh * 1.02))),
        rolle: titel ? 'titel' : 'text', gr: r1(zh / 1.12), gewicht: e.gewicht ? Math.round(Math.max(300, Math.min(900, e.gewicht)) / 100) * 100 : undefined,
        ausr, vert: e.vertikal && e.vertikal !== 'oben' ? e.vertikal : undefined, gross: e.grossbuchstaben || undefined,
        farbe: farbeFuer(e.farbe, m, immer) || 'hell', hinterlegt: e.hinterlegt ? farbeFuer(e.hinterlegt, m, true) : undefined,
        frei: opt.felder && e.feld ? e.feld : undefined, ...anim(titel ? 'hoch' : 'blende') });
    } else if (e.art === 'flaeche' || e.art === 'kreis') {
      els.push({ ...grund, typ: 'form', form: e.art === 'kreis' ? 'kreis' : undefined, fuell: farbeFuer(e.fuellung || e.farbe, m, immer) || 'primaer',
        ecken: e.art === 'flaeche' && z(e.ecken) > 0 ? r1(Math.min(50, z(e.ecken))) : undefined, ...anim(e.art === 'kreis' ? 'pop' : 'blende', e.art === 'kreis' ? .7 : .6) });
    } else if (e.art === 'logo' && m.logo) {
      els.push({ ...grund, typ: 'logo', ausr: x + w / 2 < 40 ? 'left' : x + w / 2 > 60 ? 'right' : 'center', ...anim('blende') });
    } else if (e.art === 'bild' || e.art === 'logo') {
      // Was vor dem Bild liegt und eine eigene Ebene wird, aus dem Ausschnitt nehmen (Texte immer, Formen nur davor).
      const davor = opt.textWeg ? roh.filter((t, j) => t !== e && ueberlappt(t, e) && (t.art === 'text' || (j > i && (t.art === 'kreis' || t.art === 'flaeche')))) : [];
      const bild = e.bild || ausschneiden(q, e, davor);
      els.push({ ...grund, typ: 'bild', bild, passt: ganz ? 'cover' : 'contain', ecken: z(e.ecken) > 0 ? r1(Math.min(50, z(e.ecken))) : undefined,
        frei: opt.felder && e.feld ? e.feld : undefined, ...anim(ganz ? 'kenburns' : 'zoom') });
    } else if (e.art === 'qr') {
      const s = Math.max(w, h);
      els.push({ ...grund, typ: 'qr', text: /^https?:\/\//.test(e.text || '') ? e.text : 'https://showcube.de', w: s, h: s, farbe: farbeFuer(e.farbe, m, immer) || 'dunkel', fuell: farbeFuer(e.fuellung, m, immer) || 'hell',
        frei: opt.felder ? (e.feld || 'Link') : undefined, ...anim('zoom') });
    }
  }
  // Schriftgröße: gr ist Prozent der kürzeren Folienseite. Quer ist das die Höhe, hochkant die Breite (16:9).
  const hoch = hochkant ? els.map(e => e.typ === 'text' ? { ...e, gr: r1(e.gr * 16 / 9) } : { ...e }) : null;
  const vorlage: DesignVorlage = {
    id: neueId(), name: (erk.name || q.name || 'Vorlage aus Bild').slice(0, 60),
    hinter: farbeFuer(erk.hintergrund, m, immer) || 'dunkel', hinter2: erk.verlauf ? farbeFuer(erk.verlauf, m, immer) : undefined,
    quer: els, hoch,
  };
  return { vorlage, hoch: hochkant };
}

/** Kurze Zusammenfassung für die Anzeige: „7 Ebenen: 3 Texte, 2 Flächen, 1 Bild, 1 Logo“. */
export function zusammenfassung(v: DesignVorlage) {
  const n: Record<string, number> = {};
  for (const e of v.quer) { const k = e.typ === 'form' ? (e.form === 'kreis' ? 'kreis' : 'flaeche') : e.typ; n[k] = (n[k] || 0) + 1; }
  const W: Record<string, [string, string]> = { text: ['Text', 'Texte'], flaeche: ['Fläche', 'Flächen'], kreis: ['Kreis', 'Kreise'], bild: ['Bild', 'Bilder'], logo: ['Logo', 'Logos'], qr: ['QR-Code', 'QR-Codes'], video: ['Video', 'Videos'] };
  const teile = Object.entries(n).map(([k, c]) => c + ' ' + W[k][c === 1 ? 0 : 1]);
  return `${v.quer.length} ${v.quer.length === 1 ? 'Ebene' : 'Ebenen'}: ${teile.join(', ')}`;
}

// ---------- SVG ohne KI ----------
// Unbekannte Dateien sicher machen: kein Skript, keine Ereignisse, keine fremden Inhalte.
export function svgSaeubern(text: string): string {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml'), svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw new Error('Die SVG-Datei ist nicht lesbar.');
  doc.querySelectorAll('script, foreignObject, iframe, object, embed, audio, video').forEach(n => n.remove());
  for (const el of [svg, ...Array.from(svg.querySelectorAll('*'))]) for (const a of Array.from(el.attributes)) {
    const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
    if (n.startsWith('on')) el.removeAttribute(a.name);
    else if ((n === 'href' || n === 'xlink:href') && !(v.startsWith('#') || v.startsWith('data:image/'))) el.removeAttribute(a.name);
  }
  return new XMLSerializer().serializeToString(svg);
}
export function svgMasse(svg: string) {
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const vb = (el.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  let w = parseFloat(el.getAttribute('width') || ''), h = parseFloat(el.getAttribute('height') || '');
  if (!(w > 0 && h > 0) && vb.length === 4 && vb[2] > 0 && vb[3] > 0) { w = vb[2]; h = vb[3]; }
  if (!(w > 0 && h > 0)) { w = 1920; h = 1080; }
  const s = 1600 / Math.max(w, h); return { w: Math.round(w * s), h: Math.round(h * s) };
}
function svgUrl(svg: string, w: number, h: number) {
  const el = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  if (!el.getAttribute('viewBox')) { const ow = parseFloat(el.getAttribute('width') || '') || w, oh = parseFloat(el.getAttribute('height') || '') || h; el.setAttribute('viewBox', `0 0 ${ow} ${oh}`); }
  el.setAttribute('width', String(w)); el.setAttribute('height', String(h));
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(el));
}
const farbeAus = (css: string): { hex: string; a: number } | null => {
  const m = /rgba?\(([^)]+)\)/.exec(css || ''); if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); const a = p.length > 3 ? p[3] : 1;
  return a <= 0 ? null : { hex: rgbHex(p[0], p[1], p[2]), a };
};
const LEER = 'defs, clipPath, mask, pattern, symbol, marker, linearGradient, radialGradient, filter, title, desc, metadata, style';

/** Liest die Ebenen einer SVG-Datei. Gemessen wird in einem unsichtbaren Rahmen ohne Skripte. */
export async function erkennungAusSvg(q: Quelle): Promise<Erkennung> {
  const W = q.cv.width, H = q.cv.height;
  const fr = document.createElement('iframe');
  fr.setAttribute('sandbox', 'allow-same-origin'); fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
  fr.style.cssText = `position:fixed;left:-${W + 100}px;top:0;width:${W}px;height:${H}px;border:0;visibility:hidden;pointer-events:none`;
  document.body.append(fr);
  try {
    const doc = fr.contentDocument; doc.open(); doc.write('<!doctype html><html><body style="margin:0"></body></html>'); doc.close();
    const svgDoc = new DOMParser().parseFromString(q.svg, 'image/svg+xml');
    const svg = doc.importNode(svgDoc.documentElement, true) as unknown as SVGSVGElement;
    if (!svg.getAttribute('viewBox')) { const ow = parseFloat(svg.getAttribute('width') || '') || W, oh = parseFloat(svg.getAttribute('height') || '') || H; svg.setAttribute('viewBox', `0 0 ${ow} ${oh}`); }
    svg.setAttribute('width', String(W)); svg.setAttribute('height', String(H)); svg.style.display = 'block';
    doc.body.append(svg);
    const win = fr.contentWindow, wurzel = svg.getBoundingClientRect();
    const lage = (el: Element) => { const r = el.getBoundingClientRect(); return { x: (r.left - wurzel.left) / W * 100, y: (r.top - wurzel.top) / H * 100, w: r.width / W * 100, h: r.height / H * 100 }; };
    const sichtbar = (el: Element) => { const s = win.getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity || '1') > 0 && !el.closest(LEER); };
    const deck = (el: Element, fill: number) => { let o = fill; for (let n: Element | null = el; n && n !== svg.parentElement; n = n.parentElement) o *= parseFloat(win.getComputedStyle(n).opacity || '1'); return o < .98 ? o : null; };
    const gedreht = (el: SVGGraphicsElement) => { const m = el.getCTM?.(); return m && (Math.abs(m.b) > 1e-3 || Math.abs(m.c) > 1e-3); };

    let hintergrund = '#ffffff', verlauf: string | null = null; const elemente: RohEl[] = [], uebernommen = new Set<Element>();
    const blaetter = Array.from(svg.querySelectorAll('rect, circle, ellipse, text, image, path, polygon, polyline, line, use')).filter(sichtbar);
    for (const el of blaetter) {
      const tag = el.tagName.toLowerCase(), s = win.getComputedStyle(el), L = lage(el);
      if (L.w <= 0 || L.h <= 0) continue;
      // Beschnitten, maskiert oder gefiltert: sieht anders aus als das nackte Element, also als Bild übernehmen.
      if (el.closest('[clip-path], [mask], [filter]') || /url\(/.test(s.clipPath + s.mask + s.filter)) continue;
      if (tag === 'text') {
        const t = Array.from(el.querySelectorAll('tspan')).filter(sp => sp.getAttribute('y') || sp.getAttribute('dy')).map(sp => sp.textContent.trim());
        const text = (t.length > 1 ? t.join('\n') : el.textContent.replace(/\s+/g, ' ')).trim(); if (!text) continue;
        // Zeilenhöhe aus dem gemessenen Kasten: das hält auch bei skalierten Gruppen und viewBox.
        const f = farbeAus(s.fill), zh = L.h / Math.max(1, text.split('\n').length);
        const anker = s.textAnchor === 'middle' ? 'center' : s.textAnchor === 'end' ? 'right' : 'left', gw = parseInt(s.fontWeight) || (s.fontWeight === 'bold' ? 700 : 400);
        elemente.push({ art: 'text', ...L, text, zeilenhoehe: zh, gewicht: gw, schrift: gw >= 700 || zh > 7 ? 'titel' : 'text', ausrichtung: anker,
          grossbuchstaben: s.textTransform === 'uppercase', farbe: f?.hex || '#000000', deckkraft: deck(el, f ? f.a * parseFloat(s.fillOpacity || '1') : 1) });
        uebernommen.add(el); continue;
      }
      const flaeche = farbeAus(s.fill), einfach = flaeche && !/url\(/.test(s.fill) && (!s.stroke || s.stroke === 'none') && !gedreht(el as SVGGraphicsElement);
      if ((tag === 'rect' || tag === 'circle' || tag === 'ellipse') && einfach) {
        const o = deck(el, flaeche.a * parseFloat(s.fillOpacity || '1'));
        if (tag === 'rect' && L.x <= 1 && L.y <= 1 && L.w >= 98 && L.h >= 98 && !elemente.length && o == null) { hintergrund = flaeche.hex; uebernommen.add(el); continue; }
        const rx = tag === 'rect' ? parseFloat(el.getAttribute('rx') || el.getAttribute('ry') || '0') : 0;
        const kurz = Math.min(parseFloat(el.getAttribute('width') || '0'), parseFloat(el.getAttribute('height') || '0'));
        elemente.push({ art: tag === 'rect' ? 'flaeche' : 'kreis', ...L, fuellung: flaeche.hex, ecken: rx > 0 && kurz > 0 ? Math.min(50, rx / kurz * 100) : null, deckkraft: o });
        uebernommen.add(el); continue;
      }
      if (tag === 'image') { elemente.push({ art: 'bild', ...L, feld: 'Foto' }); uebernommen.add(el); continue; }
    }
    // Hintergrund als Verlauf? Erste Farbe eines Verlaufs auf einer Fläche über alles.
    const g = svg.querySelector('linearGradient'); if (g && hintergrund === '#ffffff') {
      const stops = Array.from(g.querySelectorAll('stop')).map(st => farbeAus(win.getComputedStyle(st).stopColor)).filter(Boolean);
      const voll = blaetter.find(el => el.tagName.toLowerCase() === 'rect' && /url\(/.test(win.getComputedStyle(el).fill) && lage(el).w >= 98 && lage(el).h >= 98);
      if (voll && stops.length >= 2) { hintergrund = stops[0].hex; verlauf = stops[stops.length - 1].hex; uebernommen.add(voll); }
    }

    // Bilder (<image>) und den Rest (Pfade, Verläufe, Gedrehtes) als Bild rendern.
    const rendern = async (nur: Element | null) => {
      const kopie = svg.cloneNode(true) as SVGSVGElement, alle = Array.from(svg.querySelectorAll('*')), k = Array.from(kopie.querySelectorAll('*'));
      if (nur) { kopie.setAttribute('visibility', 'hidden'); const i = alle.indexOf(nur); if (i >= 0) k[i].setAttribute('visibility', 'visible'); }
      else alle.forEach((el, i) => { if (uebernommen.has(el)) k[i].setAttribute('visibility', 'hidden'); });
      const img = await ladeBild('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(kopie)));
      const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(img, 0, 0, W, H); return cv;
    };
    const ausCv = (cv: HTMLCanvasElement, e: RohEl) => {
      const x = Math.round(e.x / 100 * W), y = Math.round(e.y / 100 * H), w = Math.max(1, Math.round(e.w / 100 * W)), h = Math.max(1, Math.round(e.h / 100 * H));
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h); return alsDataUrl(c);
    };
    const bilder = blaetter.filter(el => el.tagName.toLowerCase() === 'image' && uebernommen.has(el));
    let bi = 0;
    for (const e of elemente) if (e.art === 'bild') { const cv = await rendern(bilder[bi++]); e.bild = ausCv(cv, e); }
    const rest = blaetter.filter(el => !uebernommen.has(el));
    if (rest.length) {
      const cv = await rendern(null), d = cv.getContext('2d').getImageData(0, 0, W, H).data;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 >= 0) {
        const e: RohEl = { art: 'bild', x: x0 / W * 100, y: y0 / H * 100, w: (x1 - x0 + 2) / W * 100, h: (y1 - y0 + 2) / H * 100, beschreibung: 'Grafik aus der Datei' };
        e.bild = ausCv(cv, e); elemente.unshift(e);
      }
    }
    // Felder vorschlagen wie die KI: Preise, die größte Überschrift und Fotos darf der Kunde später ändern.
    const texte = elemente.filter(e => e.art === 'text');
    texte.filter(e => /\d\s*[,.]\s*\d{2}\s*€|€\s*\d|\d\s*(€|EUR)\b/.test(e.text || '')).forEach(e => e.feld = 'Preis');
    const groesste = texte.filter(e => !e.feld).sort((a, b) => z(b.zeilenhoehe) - z(a.zeilenhoehe))[0];
    if (groesste) groesste.feld = 'Überschrift';
    return { name: q.name, hintergrund, verlauf, elemente };
  } finally { fr.remove(); }
}

// ---------- KI (Pro) ----------
let sb: SupabaseClient | null = null;
const client = () => (sb ||= verbinden('showcube-panel'));   // gleiche Sitzung wie das Panel im selben Browser
export const kiMoeglich = hatServer;

export interface KiStand { angemeldet: boolean; email?: string; pro?: boolean; grenze?: number | null; genutzt?: number; fehler?: string; }
export async function kiStand(): Promise<KiStand> {
  if (!hatServer) return { angemeldet: false, fehler: 'Kein Server eingerichtet.' };
  const { data } = await client().auth.getSession();
  const s = data?.session; if (!s || s.user?.is_anonymous) return { angemeldet: false };
  const r = await client().rpc('ki_kontingent');
  if (r.error) return { angemeldet: true, email: s.user?.email, fehler: r.error.message };
  return { angemeldet: true, email: s.user?.email, ...(r.data as any) };
}

const MELDUNGEN: Record<string, string> = {
  KI_NICHT_ANGEMELDET: 'Bitte melde dich zuerst im Panel mit deinem ShowCube-Konto an.',
  KI_KEIN_BETRIEB: 'Zu deinem Konto gehört noch kein Betrieb.',
  KI_NUR_PRO: '„Vorlage aus Bild“ mit KI gehört zum Pro-Plan. SVG-Dateien gehen auch ohne Pro.',
  KI_KONTINGENT: 'Das Kontingent für diesen Monat ist aufgebraucht. Am 1. geht es weiter.',
  KI_NICHT_EINGERICHTET: 'Die KI ist auf dem Server noch nicht eingerichtet.',
  KI_ZU_GROSS: 'Das Bild ist zu groß.',
  KI_ABGELEHNT: 'Die KI hat dieses Bild nicht bearbeitet. Probier ein anderes.',
  KI_ZU_VIEL: 'Das Bild hat zu viele Elemente. Schneide es zu oder nimm einen Ausschnitt.',
};
export class KiFehler extends Error { constructor(public code: string, text: string) { super(text); } }

export async function kiErkennen(q: Quelle): Promise<{ erkennung: Erkennung; rest: number | null }> {
  if (!hatServer) throw new KiFehler('KI_NICHT_EINGERICHTET', MELDUNGEN.KI_NICHT_EINGERICHTET);
  const { data, error } = await client().functions.invoke('vorlage-aus-bild', { body: fuerKi(q) });
  if (error) {
    let code = 'KI_FEHLER', text = 'Die KI ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.';
    try { const j = await (error as any).context?.json?.(); if (j?.fehler) { code = j.fehler; text = MELDUNGEN[code] || j.text || text; } } catch (e) { /* keine Antwort */ }
    throw new KiFehler(code, text);
  }
  if (!data?.erkennung?.elemente) throw new KiFehler('KI_FEHLER', 'Die Antwort der KI war unvollständig.');
  return { erkennung: data.erkennung, rest: data.rest ?? null };
}
