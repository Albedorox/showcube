// Bausteine: Zusatzfolien und die Infoleiste, gemeinsam für Player und Panel.
//
// - Bausteine sind fertige Folienarten, die zu jeder Slideshow passen: QR-Code, Bewertungen, Countdown-Aktion.
// - Jeder Baustein und jedes eigene Medium kann einen Zeitraum haben (von, bis, Wochentage).
//   Danach verschwindet die Folie von selbst. Niemand muss am Montag das Wochenangebot löschen.
// - Die Infoleiste ist eine Zone am unteren Rand: Laufband, Uhr und Wetter. Die Folien werden dafür kleiner, nicht verdeckt.
import qrcode from 'qrcode-generator';
import { font, fit, wrap, rr, mix, drawLogo, DISP, BODY, pal, alpha } from './templates';
import type { When } from './paket';
import { drawDesign, videosVon } from './design';

// ---------- Zeitraum ----------
export interface Zeitraum { from?: string; to?: string; days?: number[]; }   // from/to: JJJJ-MM-TT, beide inklusive
const ymd = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export function activeOn(z: Zeitraum | undefined, d = new Date()): boolean {
  if (!z) return true; const t = ymd(d);
  if (z.from && t < z.from) return false;
  if (z.to && t > z.to) return false;
  if (z.days && z.days.length && !z.days.includes(d.getDay())) return false;
  return true;
}
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const dm = (s: string) => { const [, m, d] = s.split('-'); return +d + '.' + +m + '.'; };
// Kurz in Worten, z. B. "bis 24.11.", "ab 1.12., Mo–Fr". Leer = immer.
export function zeitraumText(z: Zeitraum | undefined): string {
  if (!z) return ''; const out: string[] = [];
  if (z.from && z.to) out.push(dm(z.from) + ' bis ' + dm(z.to)); else if (z.from) out.push('ab ' + dm(z.from)); else if (z.to) out.push('bis ' + dm(z.to));
  const ds = (z.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  if (ds.length && ds.length < 7) {
    const key = ds.join(',');
    out.push(key === '1,2,3,4,5' ? 'Mo–Fr' : key === '6,0' ? 'am Wochenende' : ds.map(x => DAYS[x]).join(', '));
  }
  return out.join(', ');
}
// Ist der Zeitraum endgültig vorbei? Dann zeigt das Panel "abgelaufen".
export const expired = (z: Zeitraum | undefined, d = new Date()) => !!(z && z.to && ymd(d) > z.to);

// ---------- Echter QR-Code ----------
(qrcode as any).stringToBytes = (qrcode as any).stringToBytesFuncs['UTF-8'];
const qrCache = new Map<string, any>();
function qrOf(text: string) {
  if (!qrCache.has(text)) { let q = null; try { q = qrcode(0, 'M'); q.addData(text); q.make(); } catch (e) { q = null; } qrCache.set(text, q); }
  return qrCache.get(text);
}
// Zeichnet einen scannbaren QR-Code mit hellem Rand (Ruhezone) in das Quadrat x, y, size.
export function drawQR(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, dark = '#111', light = '#fff') {
  const q = text && qrOf(text); ctx.save();
  ctx.fillStyle = light; rr(ctx, x, y, size, size, size * .06); ctx.fill();
  if (!q) { ctx.restore(); return; }
  const n = q.getModuleCount(), pad = size * .08, m = (size - 2 * pad) / n;
  ctx.fillStyle = dark;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x + pad + c * m, y + pad + r * m, m + .4, m + .4);
  ctx.restore();
}
const short = (url: string) => (url || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');

// ---------- Folienarten ----------
export type BausteinKind = 'qr' | 'reviews' | 'countdown' | 'design' | 'anzeige' | 'werbeplatz';
export interface Baustein extends Zeitraum { id: string; kind: BausteinKind; on: boolean; when: When; f: Record<string, string>; }
interface Field { k: string; label: string; ph?: string; type?: string; wide?: boolean; }
export const BAUSTEINE: Record<BausteinKind, { label: string; desc: string; fields: Field[]; f: Record<string, string> }> = {
  qr: {
    label: 'QR-Code', desc: 'Speisekarte, Exposé, Instagram oder WLAN aufs Handy. Echter Code, sofort scannbar.',
    fields: [{ k: 'title', label: 'Überschrift', ph: 'Die ganze Karte aufs Handy' }, { k: 'text', label: 'Kleiner Text', ph: 'Einfach mit der Kamera scannen.', wide: true }, { k: 'url', label: 'Link', ph: 'https://…', type: 'url', wide: true }],
    f: { title: 'Die ganze Karte aufs Handy', text: 'Einfach mit der Kamera scannen. Auch zum Bestellen und Mitnehmen.', url: 'https://showcube.de' },
  },
  reviews: {
    label: 'Bewertungen', desc: 'Sterne und echte Kundenstimmen. Mit QR-Code, der direkt zum Bewerten führt.',
    fields: [{ k: 'score', label: 'Sterne', ph: '4,8' }, { k: 'count', label: 'Anzahl', ph: '214 Bewertungen' }, { k: 'q1', label: 'Stimme 1', wide: true }, { k: 'a1', label: 'Von' }, { k: 'q2', label: 'Stimme 2', wide: true }, { k: 'a2', label: 'Von' }, { k: 'url', label: 'Link zum Bewerten', ph: 'https://g.page/r/…', type: 'url', wide: true }],
    f: { score: '4,8', count: '214 Bewertungen auf Google', q1: 'Die beste Pizza der Stadt, und super freundlich.', a1: 'Laura M.', q2: 'Schnell, heiß und der Teig ist ein Traum.', a2: 'Tobias K.', url: 'https://g.page/r/showcube-demo/review' },
  },
  countdown: {
    label: 'Countdown-Aktion', desc: 'Angebot mit Ablaufzeit. Zählt live herunter und verschwindet danach von selbst.',
    fields: [{ k: 'kicker', label: 'Kleine Zeile', ph: 'Nur diese Woche' }, { k: 'title', label: 'Angebot', ph: 'Schnitzel-Tage' }, { k: 'big', label: 'Großer Text', ph: '−20 %' }, { k: 'until', label: 'Endet am', type: 'datetime-local' }],
    f: { kicker: 'Nur diese Woche', title: 'Familien-Pizza', big: '−20 %', until: '' },
  },
  // Eigene Vorlage aus dem Vorlagen-Designer. f.vorlage = id der Vorlage in der Marke, f.titel = Name,
  // alle weiteren Schlüssel sind die freien Felder der Vorlage (Element-id → Text, Link oder Bild als data:-URL).
  design: {
    label: 'Eigene Vorlage', desc: 'Im Design deiner Marke, gestaltet im Vorlagen-Designer.',
    fields: [], f: {},
  },
  // Partner-Slots (shared/werbung.ts): Anzeige eines Werbepartners. Eigene Farbe und eigenes Bild, nicht die Marke des Ladens.
  // Mit Bild und ohne Überschrift zeigt die Folie nur das Bild (fertige Anzeige vom Partner).
  anzeige: {
    label: 'Anzeige', desc: 'Werbung eines Partners: Bild, Text und QR-Code in seiner Farbe.',
    fields: [{ k: 'firma', label: 'Firma', ph: 'Blumen Berger' }, { k: 'title', label: 'Überschrift', ph: 'Frische Tulpen' }, { k: 'text', label: 'Text', ph: 'Zwei Minuten von hier, Marktstraße 12.', wide: true }, { k: 'url', label: 'Link für den QR-Code (leer = kein Code)', ph: 'https://…', type: 'url', wide: true }],
    f: { firma: 'Blumen Berger', title: 'Frische Tulpen für dein Zuhause', text: 'Nur zwei Minuten von hier, Marktstraße 12.', url: '', farbe: '#c2185b' },
  },
  // Wirbt um neue Partner, solange Plätze frei sind. `reichweite` füllt das Panel aus dem Zeitplan aus.
  werbeplatz: {
    label: 'Werbeplatz frei', desc: 'Der Bildschirm wirbt selbst um neue Werbepartner.',
    fields: [{ k: 'title', label: 'Überschrift', ph: 'Dein Geschäft auf diesem Bildschirm' }, { k: 'text', label: 'Text', ph: 'Wir vermieten Sendezeit an Nachbarn aus der Region.', wide: true }, { k: 'kontakt', label: 'Kontakt', ph: 'Frag einfach an der Kasse', wide: true }, { k: 'url', label: 'Link für den QR-Code', ph: 'mailto:… oder https://…', type: 'url', wide: true }],
    f: { title: 'Dein Geschäft auf diesem Bildschirm', text: 'Wir vermieten Sendezeit an Geschäfte aus der Nachbarschaft.', kontakt: 'Frag einfach an der Kasse.', url: 'mailto:hallo@example.de?subject=Werbeplatz', reichweite: '' },
  },
};
export const bausteinTitle = (b: Baustein) => b.kind === 'design' ? b.f.titel || 'Eigene Vorlage' : b.kind === 'anzeige' ? (b.f.firma || b.f.title || 'Anzeige') : (b.kind === 'reviews' ? (b.f.score ? b.f.score + ' Sterne' : '') : b.f.title || '').trim() || BAUSTEINE[b.kind].label;
// Ein Countdown nach seinem Ende ist auch abgelaufen.
// Filme, die eine eigene Vorlage (Art 'design') zeigt. Sie müssen als Datei mit ins Paket.
export const bausteinVideos = (b: Baustein, marke: any): string[] => b.kind !== 'design' || !marke ? [] : videosVon((marke.vorlagen || []).find((x: any) => x.id === b.f.vorlage), b.f);
export const bausteinActive = (b: Baustein, d = new Date()) => b.on && activeOn(b, d) && !(b.kind === 'countdown' && b.f.until && Date.parse(b.f.until) <= d.getTime());

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, fillPart: number, on: string, off: string) {
  const path = () => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r; ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } ctx.closePath(); };
  ctx.save(); path(); ctx.fillStyle = off; ctx.fill();
  if (fillPart > 0) { ctx.clip(); ctx.fillStyle = on; ctx.fillRect(cx - r, cy - r, 2 * r * Math.min(1, fillPart), 2 * r); }
  ctx.restore();
}
function brand(ctx, d, w, u, color) {
  if (!drawLogo(ctx, d, w - u * 6, u * 5, u * 20, u * 10)) { font(ctx, 700, u * 3.4, BODY); ctx.fillStyle = color; ctx.textAlign = 'right'; ctx.fillText(d.name, w - u * 6, u * 10); ctx.textAlign = 'left'; }
}

export function bausteinSlide(b: Baustein) {
  const f = b.f;
  if (b.kind === 'design') return (ctx: CanvasRenderingContext2D, w: number, h: number, d: any, t = 0) => {
    const v = d.marke && (d.marke.vorlagen || []).find((x: any) => x.id === f.vorlage);
    if (v) { drawDesign(ctx, w, h, d, t, v, f); return; }
    const u = Math.min(w, h) / 100; ctx.fillStyle = '#222'; ctx.fillRect(0, 0, w, h);
    font(ctx, 600, u * 4, BODY); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('Vorlage „' + (f.titel || '') + '“ fehlt in der Marke', w / 2, h / 2);
  };
  if (b.kind === 'anzeige') return anzeigeSlide(f);
  if (b.kind === 'werbeplatz') return werbeplatzSlide(f);
  if (b.kind === 'qr') return (ctx: CanvasRenderingContext2D, w: number, h: number, d: any) => {
    const u = Math.min(w, h) / 100, port = h > w, P = pal(d);
    ctx.fillStyle = P.marke ? P.papier : '#f4f1ea'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = d.accent; ctx.fillRect(0, 0, port ? w : w * .42, port ? h * .5 : h);
    const s = port ? w * .58 : Math.min(h * .62, w * .32), qx = port ? (w - s) / 2 : w * .42 - s * .5, qy = port ? h * .5 - s * .5 : (h - s) / 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = u * 4; ctx.shadowOffsetY = u; ctx.fillStyle = '#fff'; rr(ctx, qx, qy, s, s, s * .06); ctx.fill(); ctx.restore();
    drawQR(ctx, f.url, qx, qy, s);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const x0 = port ? u * 7 : w * .62, tw = port ? w - u * 14 : w * .38 - u * 7; let y = port ? h * .5 + s * .5 + u * 13 : h * .3;
    font(ctx, 700, u * 3.6, BODY); ctx.fillStyle = d.accent; ctx.fillText('SCANNEN', x0, y);
    font(ctx, 800, u * (port ? 8 : 7), DISP); ctx.fillStyle = P.marke ? P.tinte : '#18140f';
    const lines = wrap(ctx, f.title || '', tw).slice(0, 3); lines.forEach((l, i) => ctx.fillText(l, x0, y + u * 9 * (i + 1))); y += u * 9 * lines.length + u * 7;
    font(ctx, 500, u * 3.8, BODY); ctx.fillStyle = P.marke ? alpha(P.tinte, .75) : '#4a4339'; wrap(ctx, f.text || '', tw).slice(0, 3).forEach((l, i) => ctx.fillText(l, x0, y + u * 5.2 * i));
    font(ctx, 700, u * 3.2, BODY); ctx.fillStyle = P.marke ? P.tinte : '#18140f'; fit(ctx, short(f.url), tw, u * 3.2, 700, BODY); ctx.fillText(short(f.url), x0, h - u * 6);
    if (!port) { font(ctx, 700, u * 3.4, BODY); ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fillText(d.name, u * 6, u * 10); }
    else brand(ctx, d, w, u, '#fff');
  };
  if (b.kind === 'reviews') return (ctx: CanvasRenderingContext2D, w: number, h: number, d: any, t = 0) => {
    const u = Math.min(w, h) / 100, port = h > w, score = parseFloat((f.score || '0').replace(',', '.')) || 0, P = pal(d);
    ctx.fillStyle = P.marke ? P.dunkel : '#121212'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = mix(d.accent, .55); ctx.beginPath(); ctx.arc(port ? w * .5 : w * .2, port ? h * .2 : h * .5, port ? w * .55 : h * .62, 0, 7); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const cx = port ? w / 2 : w * .2, cy = port ? h * .2 : h * .5;
    font(ctx, 800, u * (port ? 24 : 22), DISP); ctx.fillStyle = '#fff'; ctx.fillText((f.score || '').trim() || '5,0', cx, cy + u * 3);
    for (let i = 0; i < 5; i++) star(ctx, cx + (i - 2) * u * 7.2, cy + u * 11, u * 3.2, score - i, '#f6c445', 'rgba(255,255,255,.22)');
    font(ctx, 600, u * 3.2, BODY); ctx.fillStyle = 'rgba(255,255,255,.85)'; fit(ctx, f.count || '', port ? w * .8 : w * .34, u * 3.2, 600, BODY); ctx.fillText(f.count || '', cx, cy + u * 21);
    // Kundenstimmen wechseln weich alle paar Sekunden.
    const qs = [[f.q1, f.a1], [f.q2, f.a2]].filter(q => (q[0] || '').trim()); ctx.textAlign = 'left';
    const x0 = port ? u * 8 : w * .46, tw = port ? w - u * 16 : w * .54 - u * 8 - (f.url ? h * .22 : 0), y0 = port ? h * .48 : h * .34;
    if (qs.length) {
      const per = 4.5, k = Math.floor(t / per) % qs.length, ph = (t % per) / per, a = Math.min(1, ph * 6, (1 - ph) * 6);
      ctx.globalAlpha = qs.length > 1 ? Math.max(0, a) : 1;
      font(ctx, 800, u * 16, DISP); ctx.fillStyle = d.accent; ctx.fillText('“', x0 - u, y0 + u * 4);
      font(ctx, 700, u * (port ? 6.4 : 5.4), DISP); ctx.fillStyle = '#fff';
      const ls = wrap(ctx, qs[k][0], tw).slice(0, 4); ls.forEach((l, i) => ctx.fillText(l, x0, y0 + u * 12 + i * u * (port ? 8 : 7)));
      font(ctx, 500, u * 3.6, BODY); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('— ' + (qs[k][1] || 'Gast'), x0, y0 + u * 16 + ls.length * u * (port ? 8 : 7));
      ctx.globalAlpha = 1;
    }
    if (f.url) {
      const s = port ? w * .26 : h * .22, qx = w - s - u * 6, qy = h - s - u * 10;
      drawQR(ctx, f.url, qx, qy, s);
      font(ctx, 600, u * 2.8, BODY); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.textAlign = 'center'; ctx.fillText('Danke! Hier bewerten', qx + s / 2, qy + s + u * 4.4); ctx.textAlign = 'left';
    }
    if (port) { font(ctx, 700, u * 3.4, BODY); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText(d.name, u * 8, h - u * 6); } else brand(ctx, d, w, u, 'rgba(255,255,255,.85)');
  };
  return (ctx: CanvasRenderingContext2D, w: number, h: number, d: any) => {
    const u = Math.min(w, h) / 100, port = h > w, end = f.until ? Date.parse(f.until) : NaN, left = Math.max(0, (end || 0) - Date.now());
    ctx.fillStyle = mix(d.accent, .5); ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = d.accent; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * (port ? 1 : .72), 0); ctx.lineTo(w * (port ? 1 : .58), h * (port ? .55 : 1)); ctx.lineTo(0, h * (port ? .62 : 1)); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
    const tw = port ? w - u * 12 : w * .52;
    font(ctx, 700, u * 4.2, BODY); ctx.fillText((f.kicker || '').toUpperCase(), u * 6, u * 14);
    fit(ctx, f.title || '', tw, u * 9, 800, DISP); ctx.fillText(f.title || '', u * 6, u * 27);
    fit(ctx, f.big || '', tw, u * (port ? 22 : 21), 800, DISP); ctx.fillText(f.big || '', u * 6, u * (port ? 52 : 52));
    // Restzeit als Kacheln: Tage, Stunden, Minuten, Sekunden.
    const parts = isNaN(end) ? [] : [[Math.floor(left / 864e5), 'Tage'], [Math.floor(left / 36e5) % 24, 'Std'], [Math.floor(left / 6e4) % 60, 'Min'], [Math.floor(left / 1e3) % 60, 'Sek']] as [number, string][];
    const bw = port ? (w - u * 12 - u * 9) / 4 : Math.min(u * 17, (w * .4 - u * 9) / 4), bh = bw * 1.05, bx = port ? u * 6 : w - u * 6 - (bw * 4 + u * 9), by = port ? h * .66 : h * .5 - bh / 2;
    if (parts.length) {
      font(ctx, 700, u * 3.4, BODY); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(left < 864e5 ? 'NUR NOCH HEUTE' : 'ENDET IN', bx, by - u * 3);
      parts.forEach(([n, l], i) => {
        const x = bx + i * (bw + u * 3); ctx.fillStyle = 'rgba(0,0,0,.28)'; rr(ctx, x, by, bw, bh, u * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; font(ctx, 800, bw * .5, DISP); ctx.fillText(String(n).padStart(2, '0'), x + bw / 2, by + bh * .6);
        font(ctx, 600, bw * .15, BODY); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(l, x + bw / 2, by + bh * .86); ctx.textAlign = 'left';
      });
    } else { font(ctx, 600, u * 3.4, BODY); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('Enddatum eintragen, dann zählt die Folie herunter.', bx, by + bh / 2); }
    if (port) { font(ctx, 600, u * 3.4, BODY); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(d.name, u * 6, h - u * 5); } else brand(ctx, d, w, u, 'rgba(255,255,255,.9)');
  };
}

// ---------- Partner-Slots: Anzeige und „Werbeplatz frei“ ----------
const bilder = new Map<string, HTMLImageElement>();
function bildVon(src: string) { if (!src) return null; let i = bilder.get(src); if (!i) { i = new Image(); i.src = src; bilder.set(src, i); } return i.complete && i.naturalWidth ? i : null; }
const hexOk = (c: string) => /^#[0-9a-f]{6}$/i.test(c || '');
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight), iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); ctx.restore();
}
// Kleines Schild „Anzeige“: Werbung von Partnern ist auf dem Bildschirm als solche erkennbar.
function anzeigeSchild(ctx: CanvasRenderingContext2D, w: number, u: number) {
  ctx.save(); font(ctx, 700, u * 2.3, BODY); const t = 'ANZEIGE', tw = ctx.measureText(t).width;
  ctx.fillStyle = 'rgba(0,0,0,.45)'; rr(ctx, w - tw - u * 6.4, u * 3, tw + u * 3.4, u * 4.4, u * 2.2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, w - tw - u * 4.7, u * 5.25); ctx.restore();
}
function anzeigeSlide(f: Record<string, string>) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number, d: any, t = 0) => {
    const u = Math.min(w, h) / 100, port = h > w, col = hexOk(f.farbe) ? f.farbe : '#c2185b', img = bildVon(f.bild);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    // Fertige Anzeige: nur das Bild.
    if (img && !(f.title || '').trim()) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); drawCover(ctx, img, 0, 0, w, h); anzeigeSchild(ctx, w, u); return; }
    ctx.fillStyle = mix(col, .55); ctx.fillRect(0, 0, w, h);
    const iw = img ? (port ? w : w * .46) : 0, ih = img ? (port ? h * .42 : h) : 0;
    if (img) { drawCover(ctx, img, port ? 0 : w - iw, 0, iw, ih); }
    else { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(port ? w * .8 : w * .86, port ? h * .18 : h * .5, (port ? w * .5 : h * .55) * (1 + Math.sin(t * .8) * .02), 0, 7); ctx.fill(); }
    const x0 = u * 7, tw = port ? w - u * 14 : (img ? w - iw : w * .72) - u * 12, qr = (f.url || '').trim();
    let y = port ? (img ? ih + u * 12 : h * .4) : h * .24;
    font(ctx, 700, u * 4.2, BODY); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText((f.firma || '').toUpperCase(), x0, y);
    font(ctx, 800, u * (port ? 10 : 10.5), DISP); ctx.fillStyle = '#fff';
    const ls = wrap(ctx, f.title || '', tw).slice(0, 3); ls.forEach((l, i) => ctx.fillText(l, x0, y + u * 12.5 * (i + 1))); y += u * 12.5 * ls.length + u * 8;
    font(ctx, 500, u * 4.8, BODY); ctx.fillStyle = 'rgba(255,255,255,.88)'; wrap(ctx, f.text || '', tw - (qr && !img && !port ? u * 4 : 0)).slice(0, 3).forEach((l, i) => ctx.fillText(l, x0, y + u * 6.6 * i));
    if (qr) {
      const s = port ? w * .26 : h * .24, qx = port ? w - s - u * 7 : (img ? w - iw - s - u * 6 : w - s - u * 8), qy = h - s - u * 7;
      drawQR(ctx, qr, qx, qy, s);
    }
    anzeigeSchild(ctx, w, u);
  };
}
function werbeplatzSlide(f: Record<string, string>) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number, d: any, t = 0) => {
    const u = Math.min(w, h) / 100, port = h > w, P = pal(d);
    ctx.fillStyle = P.marke ? P.dunkel : '#14181a'; ctx.fillRect(0, 0, w, h);
    // Ein leerer Rahmen, der sanft pulsiert: hier ist Platz.
    const fx = port ? u * 8 : w * .58, fy = port ? h * .1 : h * .16, fw = port ? w - u * 16 : w * .34, fh = port ? h * .3 : h * .68;
    ctx.save(); ctx.setLineDash([u * 3, u * 2.2]); ctx.lineDashOffset = -t * u * 4; ctx.lineWidth = u * .8; ctx.strokeStyle = d.accent; rr(ctx, fx, fy, fw, fh, u * 3); ctx.stroke(); ctx.restore();
    const qr = (f.url || '').trim(), s = Math.min(fw, fh) * .62;
    if (qr) drawQR(ctx, qr, fx + (fw - s) / 2, fy + (fh - s) / 2 - u * 2, s);
    font(ctx, 600, u * 2.8, BODY); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    if (qr) ctx.fillText('Scannen und anfragen', fx + fw / 2, fy + fh - u * 3.5);
    ctx.textAlign = 'left';
    const x0 = u * 7, tw = port ? w - u * 14 : w * .5 - u * 7; let y = port ? fy + fh + u * 12 : h * .26;
    font(ctx, 700, u * 3.6, BODY); ctx.fillStyle = d.accent; ctx.fillText('WERBEPLATZ FREI', x0, y);
    font(ctx, 800, u * (port ? 8 : 7.4), DISP); ctx.fillStyle = '#fff';
    const ls = wrap(ctx, f.title || '', tw).slice(0, 3); ls.forEach((l, i) => ctx.fillText(l, x0, y + u * 9 * (i + 1))); y += u * 9 * ls.length + u * 7;
    font(ctx, 500, u * 3.8, BODY); ctx.fillStyle = 'rgba(255,255,255,.8)';
    const body = [f.text, f.reichweite].filter(x => (x || '').trim()).join(' ');
    const bl = wrap(ctx, body, tw).slice(0, 4); bl.forEach((l, i) => ctx.fillText(l, x0, y + u * 5.4 * i)); y += u * 5.4 * bl.length + u * 4;
    font(ctx, 700, u * 3.8, BODY); ctx.fillStyle = '#fff'; fit(ctx, f.kontakt || '', tw, u * 3.8, 700, BODY); ctx.fillText(f.kontakt || '', x0, y);
    if (!port) brand(ctx, d, w, u, 'rgba(255,255,255,.85)');
  };
}

// ---------- Infoleiste: Laufband, Uhr, Wetter ----------
export interface Leiste { on: boolean; ticker: string; clock: boolean; weather: boolean; place: string; lat?: number; lon?: number; }
export const LEISTE: Leiste = { on: false, ticker: '', clock: true, weather: true, place: '', lat: undefined, lon: undefined };
export const leisteH = (w: number, h: number) => Math.round(Math.min(w, h) * .085);
export interface Wetter { temp: number; code: number; at: number; }

function wxIcon(ctx: CanvasRenderingContext2D, code: number, x: number, y: number, s: number) {
  const sun = (cx, cy, r) => { ctx.fillStyle = '#f6c445'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#f6c445'; ctx.lineWidth = r * .25; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4); ctx.lineTo(cx + Math.cos(a) * r * 1.85, cy + Math.sin(a) * r * 1.85); ctx.stroke(); } };
  const cloud = (cx, cy, r, col = '#e6ebee') => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx - r * .6, cy + r * .2, r * .55, 0, 7); ctx.arc(cx, cy - r * .1, r * .75, 0, 7); ctx.arc(cx + r * .65, cy + r * .25, r * .5, 0, 7); ctx.fill(); ctx.fillRect(cx - r * .6, cy + r * .1, r * 1.25, r * .65); };
  const c = s / 2, cx = x + c, cy = y + c; ctx.save(); ctx.lineCap = 'round';
  if (code === 0) sun(cx, cy, s * .22);
  else if (code <= 2) { sun(cx - s * .12, cy - s * .1, s * .16); cloud(cx + s * .08, cy + s * .08, s * .26); }
  else if (code === 3 || code === 45 || code === 48) cloud(cx, cy, s * .3, code === 3 ? '#c9d1d6' : '#b8c0c4');
  else {
    cloud(cx, cy - s * .1, s * .28, '#c9d1d6');
    const snow = (code >= 71 && code <= 77) || code === 85 || code === 86, storm = code >= 95;
    ctx.strokeStyle = snow ? '#fff' : '#6cb6ff'; ctx.fillStyle = '#fff'; ctx.lineWidth = s * .06;
    for (let i = 0; i < 3; i++) { const px = cx - s * .2 + i * s * .2, py = cy + s * .28; if (snow) { ctx.beginPath(); ctx.arc(px, py, s * .045, 0, 7); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(px, py - s * .06); ctx.lineTo(px - s * .05, py + s * .1); ctx.stroke(); } }
    if (storm) { ctx.fillStyle = '#f6c445'; ctx.beginPath(); ctx.moveTo(cx + s * .02, cy); ctx.lineTo(cx - s * .1, cy + s * .22); ctx.lineTo(cx, cy + s * .2); ctx.lineTo(cx - s * .06, cy + s * .4); ctx.lineTo(cx + s * .12, cy + s * .14); ctx.lineTo(cx + s * .02, cy + s * .16); ctx.closePath(); ctx.fill(); }
  }
  ctx.restore();
}
// Zeichnet die Leiste in das Rechteck 0, y, w, bh. `t` in Sekunden treibt das Laufband.
export function drawLeiste(ctx: CanvasRenderingContext2D, y: number, w: number, bh: number, L: Leiste, d: { name: string; accent: string }, t: number, wx: Wetter | null, now = new Date()) {
  const u = bh / 10; ctx.save();
  ctx.fillStyle = '#0f1312'; ctx.fillRect(0, y, w, bh);
  ctx.fillStyle = d.accent; ctx.fillRect(0, y, w, u * .5);
  ctx.textBaseline = 'middle'; const my = y + bh / 2 + u * .3;
  // Rechts: Uhr und Wetter, so breit wie nötig.
  let right = w - u * 4;
  ctx.textAlign = 'right';
  if (L.clock) {
    font(ctx, 800, u * 5.2, DISP); ctx.fillStyle = '#fff'; const tx = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); ctx.fillText(tx, right, my);
    right -= ctx.measureText(tx).width + u * 2.5;
    font(ctx, 500, u * 3, BODY); ctx.fillStyle = 'rgba(255,255,255,.65)'; const dx = now.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' }); ctx.fillText(dx, right, my);
    right -= ctx.measureText(dx).width + u * 4;
  }
  if (L.weather && wx) {
    font(ctx, 700, u * 5, DISP); ctx.fillStyle = '#fff'; const tt = Math.round(wx.temp) + '°'; ctx.fillText(tt, right, my);
    right -= ctx.measureText(tt).width + u * 1.2; wxIcon(ctx, wx.code, right - u * 7, y + u * 1.5, u * 7.5); right -= u * 8.5;
    if (L.place) { font(ctx, 500, u * 3, BODY); ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillText(L.place.split(',')[0], right, my); right -= ctx.measureText(L.place.split(',')[0]).width + u * 3; }
  }
  if (right < w - u * 4) { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(right, y + u * 2.5, u * .25, bh - u * 5); }
  // Links: Laufband. Ohne Text steht dort der Name des Betriebs.
  const zone = right - u * 3; ctx.beginPath(); ctx.rect(0, y, zone, bh); ctx.clip();
  ctx.textAlign = 'left'; font(ctx, 600, u * 4.6, BODY); ctx.fillStyle = '#fff';
  const text = (L.ticker || '').trim();
  if (!text) { font(ctx, 700, u * 4.4, BODY); ctx.fillText(d.name, u * 4, my); }
  else {
    const gap = u * 14, piece = text + '   •   ', pw = ctx.measureText(piece).width;
    if (pw - u * 8 < zone - u * 8) { ctx.fillText(text, u * 4, my); }
    else { const off = (t * u * 9) % pw; for (let x = u * 4 - off; x < zone + gap; x += pw) ctx.fillText(piece, x, my); }
  }
  ctx.restore();
}

// Wetter von Open-Meteo: kostenlos, ohne Schlüssel, Daten aus der EU. Ohne Internet bleibt die letzte Messung stehen
// oder das Wetter fehlt einfach, die Leiste läuft trotzdem.
export async function fetchWetter(lat: number, lon: number): Promise<Wetter> {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
  if (!r.ok) throw new Error('Wetter nicht erreichbar');
  const j = await r.json(); return { temp: j.current.temperature_2m, code: j.current.weather_code, at: Date.now() };
}
export async function findPlace(q: string): Promise<{ name: string; lat: number; lon: number } | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error('Ortssuche nicht erreichbar');
  const j = await r.json(), p = j.results && j.results[0];
  return p ? { name: p.name + (p.admin1 ? ', ' + p.admin1 : ''), lat: +p.latitude.toFixed(3), lon: +p.longitude.toFixed(3) } : null;
}
// Ersatzwerte, falls kein Internet da ist (nur für Vorschauen im Panel, nie auf der Box).
export const WETTER_DEMO: Wetter = { temp: 9, code: 2, at: 0 };
