// Eigene Vorlagen aus dem Vorlagen-Designer.
//
// Eine Design-Vorlage ist eine Liste von Elementen (Text, Fläche, Bild, Logo, QR-Code) mit Lage, Farbe,
// Schrift und Animation, einmal für quer und auf Wunsch eigens für hoch. Farben und Schriften sind Rollen
// der Marke ("primaer", "titel"), keine festen Werte: Ändert sich die Marke, ändern sich alle Vorlagen mit.
//
// Wer gestaltet (Kunde oder Agentur), legt fest, welche Elemente der Kunde später im Panel ausfüllen darf
// (`frei` = Beschriftung des Feldes). Alles andere bleibt so, wie gestaltet. So bleibt das CI sauber,
// und der Kunde ändert trotzdem in 30 Sekunden den Preis.
import { font, wrap, rr, pal, DISP, BODY } from './templates';
import { drawQR } from './bausteine';

export type ElTyp = 'text' | 'form' | 'bild' | 'logo' | 'qr';
export type Anim = 'keine' | 'blende' | 'hoch' | 'links' | 'rechts' | 'zoom' | 'pop' | 'schreiben' | 'puls' | 'kenburns';
export type Farbe = string;   // 'primaer' | 'zweit' | 'dunkel' | 'hell' | '#rrggbb'
export interface El {
  id: string; typ: ElTyp;
  x: number; y: number; w: number; h: number;      // Prozent der Folie
  text?: string;                                    // Text oder Link (QR). Platzhalter: {name}, {zeiten}, {datum}, {1.2} = Eintrag 1, Spalte 2
  rolle?: 'titel' | 'text'; gr?: number; gewicht?: number; ausr?: 'left' | 'center' | 'right'; vert?: 'oben' | 'mitte' | 'unten'; gross?: boolean;
  farbe?: Farbe; fuell?: Farbe; form?: 'rechteck' | 'kreis'; ecken?: number; deck?: number;
  bild?: string; passt?: 'cover' | 'contain';
  anim?: Anim; start?: number; dauer?: number;
  frei?: string;                                    // Beschriftung, wenn der Kunde dieses Element im Panel ausfüllen darf
}
export interface DesignVorlage { id: string; name: string; hinter: Farbe; hinter2?: Farbe; quer: El[]; hoch?: El[] | null; }

export const FARBROLLEN: [string, string][] = [['primaer', 'Hauptfarbe'], ['zweit', 'Zweitfarbe'], ['dunkel', 'Dunkel'], ['hell', 'Hell']];
export const ANIMS: [Anim, string][] = [['keine', 'Keine'], ['blende', 'Einblenden'], ['hoch', 'Von unten'], ['links', 'Von links'], ['rechts', 'Von rechts'], ['zoom', 'Heranzoomen'], ['pop', 'Aufploppen'], ['schreiben', 'Schreibmaschine'], ['puls', 'Pulsieren'], ['kenburns', 'Langsamer Zoom (Foto)']];

export function farbe(f: Farbe | undefined, d: any): string {
  const P = pal(d);
  if (!f) return P.tinte;
  if (f === 'primaer') return P.primaer; if (f === 'zweit') return P.zweit; if (f === 'dunkel') return P.dunkel; if (f === 'hell') return P.hell; if (f === 'tinte') return P.tinte; if (f === 'papier') return P.papier;
  return f;
}
export function platzhalter(text: string, d: any) {
  return (text || '').replace(/\{(name|zeiten|datum|(\d+)\.(\d+))\}/g, (_, k, r, c) => {
    if (k === 'name') return d.name || ''; if (k === 'zeiten') return d.hours || '';
    if (k === 'datum') return new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const row = (d.items || [])[+r - 1]; return row ? row[+c - 1] || '' : '';
  });
}

const bilder = new Map<string, HTMLImageElement>();
export function bildVon(src: string) {
  if (!src) return null;
  if (!bilder.has(src)) { const i = new Image(); i.src = src; bilder.set(src, i); }
  const i = bilder.get(src); return i.complete && i.naturalWidth ? i : null;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (p: number) => 1 - (1 - p) ** 3;
const backOut = (p: number) => { const c = 1.7; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };

// Zeichnet die Vorlage. t = Sekunden seit Beginn der Folie, steuert die Animationen.
// werte: was der Kunde in freie Felder eingetragen hat (Schlüssel = Element-id).
export function drawDesign(ctx: CanvasRenderingContext2D, w: number, h: number, d: any, t: number, v: DesignVorlage, werte: Record<string, string> = {}, opt: { platz?: boolean } = {}) {
  const port = h > w, els = (port && v.hoch) || v.quer, u = Math.min(w, h) / 100;
  const b1 = farbe(v.hinter, d);
  if (v.hinter2) { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, b1); g.addColorStop(1, farbe(v.hinter2, d)); ctx.fillStyle = g; } else ctx.fillStyle = b1;
  ctx.fillRect(0, 0, w, h);
  for (const el of els) {
    const x = el.x / 100 * w, y = el.y / 100 * h, bw = el.w / 100 * w, bh = el.h / 100 * h;
    const a = el.anim || 'keine', st = el.start || 0, du = Math.max(.1, el.dauer || .8), p = a === 'keine' ? 1 : clamp((t - st) / du), e = easeOut(p);
    ctx.save(); ctx.globalAlpha = el.deck == null ? 1 : el.deck;
    const cx = x + bw / 2, cy = y + bh / 2, sc = (k: number) => { ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); };
    if (a === 'blende') ctx.globalAlpha *= e;
    else if (a === 'hoch') { ctx.globalAlpha *= e; ctx.translate(0, (1 - e) * u * 10); }
    else if (a === 'links') { ctx.globalAlpha *= e; ctx.translate(-(1 - e) * u * 16, 0); }
    else if (a === 'rechts') { ctx.globalAlpha *= e; ctx.translate((1 - e) * u * 16, 0); }
    else if (a === 'zoom') { ctx.globalAlpha *= e; sc(.7 + .3 * e); }
    else if (a === 'pop') { ctx.globalAlpha *= clamp(p * 3); sc(Math.max(.01, backOut(p))); }
    else if (a === 'puls') { ctx.globalAlpha *= clamp((t - st) * 3); sc(1 + .035 * Math.sin(Math.max(0, t - st) * 3.2)); }
    if (p <= 0 && a !== 'kenburns' && a !== 'puls') { ctx.restore(); continue; }
    const val = el.frei && werte[el.id] != null && werte[el.id] !== '' ? werte[el.id] : null;
    if (el.typ === 'form') {
      ctx.fillStyle = farbe(el.fuell || 'primaer', d);
      if (el.form === 'kreis') { ctx.beginPath(); ctx.ellipse(cx, cy, bw / 2, bh / 2, 0, 0, 7); ctx.fill(); }
      else { rr(ctx, x, y, bw, bh, (el.ecken || 0) / 100 * Math.min(bw, bh)); ctx.fill(); }
    } else if (el.typ === 'bild' || el.typ === 'logo') {
      const img = el.typ === 'logo' ? d.logo : bildVon(val || el.bild);
      ctx.save(); rr(ctx, x, y, bw, bh, (el.ecken || 0) / 100 * Math.min(bw, bh)); ctx.clip();
      if (img) {
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        let s = (el.passt || (el.typ === 'logo' ? 'contain' : 'cover')) === 'contain' ? Math.min(bw / iw, bh / ih) : Math.max(bw / iw, bh / ih);
        if (a === 'kenburns') s *= 1 + .08 * clamp((t - st) / 12);
        const dx = el.typ === 'logo' ? (el.ausr === 'left' ? x : el.ausr === 'right' ? x + bw - iw * s : cx - iw * s / 2) : cx - iw * s / 2;
        ctx.drawImage(img, dx, cy - ih * s / 2, iw * s, ih * s);
      } else if (el.typ === 'logo') {
        font(ctx, 800, Math.min(bh * .5, u * 6), DISP); ctx.fillStyle = farbe(el.farbe || 'tinte', d); ctx.textBaseline = 'middle'; ctx.textAlign = el.ausr || 'center';
        ctx.fillText(d.name || 'Logo', el.ausr === 'left' ? x : el.ausr === 'right' ? x + bw : cx, cy);
      } else if (opt.platz) {
        ctx.fillStyle = 'rgba(127,127,127,.25)'; ctx.fillRect(x, y, bw, bh); ctx.strokeStyle = 'rgba(127,127,127,.5)'; ctx.lineWidth = u * .3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + bw, y + bh); ctx.moveTo(x + bw, y); ctx.lineTo(x, y + bh); ctx.stroke();
      }
      ctx.restore();
    } else if (el.typ === 'qr') {
      const s = Math.min(bw, bh); drawQR(ctx, platzhalter(val || el.text || '', d), cx - s / 2, cy - s / 2, s, farbe(el.farbe || 'dunkel', d), farbe(el.fuell || 'hell', d));
    } else {
      let txt = platzhalter(val ?? el.text ?? '', d); if (el.gross) txt = txt.toUpperCase();
      if (a === 'schreiben') txt = txt.slice(0, Math.round(txt.length * p));
      const fam = el.rolle === 'titel' ? DISP : BODY, wt = el.gewicht || (el.rolle === 'titel' ? 800 : 500);
      let size = (el.gr || 6) * u, lines: string[] = [];
      // Zu langer Text wird kleiner, nie abgeschnitten: das hält auch, wenn der Kunde viel einträgt.
      for (let i = 0; i < 40; i++) { font(ctx, wt, size, fam); lines = txt.split('\n').flatMap(l => wrap(ctx, l, bw)); const widest = Math.max(0, ...lines.map(l => ctx.measureText(l).width)); if ((lines.length * size * 1.12 <= bh && widest <= bw) || size < u * 1.5) break; size *= .93; }
      const lh = size * 1.12, total = lines.length * lh, top = el.vert === 'mitte' ? cy - total / 2 : el.vert === 'unten' ? y + bh - total : y;
      ctx.fillStyle = farbe(el.farbe, d); ctx.textBaseline = 'alphabetic'; ctx.textAlign = el.ausr || 'left';
      const tx = el.ausr === 'center' ? cx : el.ausr === 'right' ? x + bw : x;
      lines.forEach((l, i) => ctx.fillText(l, tx, top + i * lh + size * .9));
    }
    ctx.restore();
  }
}

// Wie lange die Animationen einer Vorlage dauern (für "Abspielen" im Designer).
export const animEnde = (v: DesignVorlage) => Math.max(1, ...[...v.quer, ...(v.hoch || [])].filter(e => e.anim && e.anim !== 'keine' && e.anim !== 'puls' && e.anim !== 'kenburns').map(e => (e.start || 0) + (e.dauer || .8)));
export const freieFelder = (v: DesignVorlage) => { const seen = new Set<string>(); return [...v.quer, ...(v.hoch || [])].filter(e => e.frei && !seen.has(e.id) && seen.add(e.id)); };

// ---------- Startpunkte für den Designer ----------
let n = 0; const id = () => 'e' + (++n).toString(36) + Math.random().toString(36).slice(2, 5);
const T = (o: Partial<El>): El => ({ id: id(), typ: 'text', x: 6, y: 10, w: 50, h: 12, rolle: 'text', gr: 5, farbe: 'hell', ausr: 'left', anim: 'keine', start: 0, dauer: .8, ...o });
function paar(quer: El[], hoch: Partial<El>[]): [El[], El[]] { return [quer, quer.map((e, i) => ({ ...e, ...(hoch[i] || {}) }))]; }
export const STARTER: { key: string; name: string; desc: string; make: () => DesignVorlage }[] = [
  { key: 'angebot', name: 'Angebot groß', desc: 'Große Zeile, Preis im Kreis, Logo oben. Für Aktionen und Tagesangebote.', make: () => {
    const [q, hh] = paar([
      T({ typ: 'form', x: 58, y: 18, w: 36, h: 64, form: 'kreis', fuell: 'primaer', anim: 'pop', start: .5, dauer: .7 }),
      T({ text: 'Nur heute', x: 6, y: 16, w: 48, h: 8, gr: 4.4, gewicht: 700, gross: true, farbe: 'zweit', anim: 'links', start: .1 }),
      T({ text: 'Unser Tagesangebot', frei: 'Angebot', x: 6, y: 27, w: 48, h: 40, rolle: 'titel', gr: 13, farbe: 'hell', anim: 'hoch', start: .25 }),
      T({ text: '9,90 €', frei: 'Preis', x: 60, y: 35, w: 32, h: 30, rolle: 'titel', gr: 14, ausr: 'center', vert: 'mitte', farbe: 'hell', anim: 'zoom', start: .9 }),
      T({ text: '{name}', x: 6, y: 84, w: 50, h: 7, gr: 3.4, gewicht: 600, farbe: 'hell', deck: .75 }),
      T({ typ: 'logo', x: 74, y: 4, w: 22, h: 11, ausr: 'right', anim: 'blende', start: 1.2 }),
    ], [{ x: 20, y: 52, w: 60, h: 34 }, { x: 8, y: 10, w: 84, h: 6 }, { x: 8, y: 17, w: 84, h: 28, gr: 14 }, { x: 22, y: 60, w: 56, h: 18 }, { x: 8, y: 91, w: 70, h: 4 }, { x: 64, y: 3, w: 30, h: 6 }]);
    return { id: id(), name: 'Angebot groß', hinter: 'dunkel', quer: q, hoch: hh };
  } },
  { key: 'foto', name: 'Foto mit Botschaft', desc: 'Bild über die ganze Fläche, darüber eine klare Botschaft. Bild tauscht der Kunde selbst.', make: () => {
    const [q, hh] = paar([
      T({ typ: 'bild', frei: 'Foto', x: 0, y: 0, w: 100, h: 100, anim: 'kenburns' }),
      T({ typ: 'form', x: 0, y: 58, w: 100, h: 42, fuell: 'dunkel', deck: .78, anim: 'hoch', start: .1, dauer: .6 }),
      T({ text: 'Neu bei uns', frei: 'Überschrift', x: 6, y: 64, w: 70, h: 16, rolle: 'titel', gr: 10, farbe: 'hell', anim: 'hoch', start: .4 }),
      T({ text: 'Kommen Sie vorbei und probieren Sie es aus.', frei: 'Text', x: 6, y: 81, w: 66, h: 12, gr: 4.2, farbe: 'hell', anim: 'blende', start: .8 }),
      T({ typ: 'form', x: 0, y: 58, w: 100, h: 1.2, fuell: 'primaer', anim: 'links', start: .3 }),
      T({ typ: 'logo', x: 74, y: 78, w: 20, h: 14, ausr: 'right', anim: 'blende', start: 1 }),
    ], [{}, { y: 60, h: 40 }, { x: 7, y: 64, w: 86, h: 14, gr: 11 }, { x: 7, y: 79, w: 86, h: 10 }, { y: 60 }, { x: 60, y: 90, w: 34, h: 7 }]);
    return { id: id(), name: 'Foto mit Botschaft', hinter: 'dunkel', quer: q, hoch: hh };
  } },
  { key: 'event', name: 'Termin und QR', desc: 'Datum, Titel, kurzer Text und ein QR-Code zur Anmeldung. Für Events, Kurse, Verkostungen.', make: () => {
    const [q, hh] = paar([
      T({ typ: 'form', x: 6, y: 14, w: 24, h: 44, fuell: 'hell', ecken: 12, anim: 'pop', start: .1 }),
      T({ text: '24.', frei: 'Tag', x: 6, y: 17, w: 24, h: 24, rolle: 'titel', gr: 15, ausr: 'center', vert: 'mitte', farbe: 'primaer', anim: 'blende', start: .4 }),
      T({ text: 'NOV', frei: 'Monat', x: 6, y: 42, w: 24, h: 12, gr: 6, gewicht: 800, ausr: 'center', farbe: 'dunkel', anim: 'blende', start: .5 }),
      T({ text: 'Weinabend mit Live-Musik', frei: 'Titel', x: 35, y: 14, w: 38, h: 30, rolle: 'titel', gr: 9, farbe: 'hell', anim: 'hoch', start: .3 }),
      T({ text: 'Ab 19 Uhr. Plätze sind begrenzt, jetzt anmelden.', frei: 'Text', x: 35, y: 47, w: 38, h: 14, gr: 4.2, farbe: 'hell', deck: .9, anim: 'blende', start: .7 }),
      T({ typ: 'qr', text: 'https://showcube.de', frei: 'Link zur Anmeldung', x: 76, y: 22, w: 18, h: 32, farbe: 'dunkel', fuell: 'hell', anim: 'zoom', start: 1 }),
      T({ text: '{name}', x: 6, y: 84, w: 60, h: 7, gr: 3.6, gewicht: 700, farbe: 'hell' }),
    ], [{ x: 8, y: 6, w: 34, h: 20 }, { x: 8, y: 7, w: 34, h: 12 }, { x: 8, y: 19, w: 34, h: 6 }, { x: 8, y: 30, w: 84, h: 20, gr: 10 }, { x: 8, y: 51, w: 84, h: 10 }, { x: 30, y: 63, w: 40, h: 22 }, { x: 8, y: 92, w: 84, h: 4 }]);
    return { id: id(), name: 'Termin und QR', hinter: 'primaer', hinter2: 'dunkel', quer: q, hoch: hh };
  } },
  { key: 'willkommen', name: 'Willkommen', desc: 'Logo in der Mitte, Begrüßung und Öffnungszeiten. Ruhig, für Empfang und Wartebereich.', make: () => {
    const [q, hh] = paar([
      T({ typ: 'logo', x: 30, y: 14, w: 40, h: 28, ausr: 'center', anim: 'zoom', start: .1, dauer: 1.1 }),
      T({ text: 'Schön, dass Sie da sind', frei: 'Begrüßung', x: 10, y: 50, w: 80, h: 16, rolle: 'titel', gr: 9, ausr: 'center', farbe: 'dunkel', anim: 'hoch', start: .6 }),
      T({ typ: 'form', x: 44, y: 70, w: 12, h: 1, fuell: 'primaer', anim: 'blende', start: 1 }),
      T({ text: '{zeiten}', frei: 'Kleiner Text', x: 10, y: 75, w: 80, h: 9, gr: 4, ausr: 'center', farbe: 'dunkel', deck: .8, anim: 'blende', start: 1.1 }),
    ], [{ x: 15, y: 18, w: 70, h: 20 }, { x: 8, y: 46, w: 84, h: 16, gr: 10 }, { x: 40, y: 66, w: 20, h: .6 }, { x: 8, y: 70, w: 84, h: 8 }]);
    return { id: id(), name: 'Willkommen', hinter: 'hell', quer: q, hoch: hh };
  } },
];
export const leereVorlage = (): DesignVorlage => ({ id: id(), name: 'Neue Vorlage', hinter: 'dunkel', quer: [T({ text: 'Ihre Überschrift', frei: 'Überschrift', x: 8, y: 36, w: 84, h: 22, rolle: 'titel', gr: 12, ausr: 'center', vert: 'mitte', anim: 'hoch' })], hoch: null });
export const neueId = id;
