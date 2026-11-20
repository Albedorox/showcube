// Beispiel-Fernseher auf der Startseite (index.html).
//
// Zeichnet die echten Folien des Players (shared/templates.ts, shared/bausteine.ts) in den Fernseher,
// mit Infoleiste, Übergängen und einem Handy, auf dem gerade ein Preis geändert wird.
// So sieht der Interessent genau das, was später im Laden läuft, und nicht eine nachgebaute Grafik.
//
// Die Folien laufen in den ShowCube-Farben, über eine Marke (shared/marke.ts), genau so wie ein Kunde
// seine eigenen Farben einstellt. Das Handy fliegt nur für die Preisänderung herein und danach wieder hinaus,
// damit der Fernseher im Vordergrund bleibt.
//
// Bewegung reduzieren (Betriebssystem-Einstellung): Die Folien wechseln trotzdem, aber nur mit einer
// ruhigen Überblendung. Muster, Laufband und Zoom stehen still, das Handy blendet nur ein und aus.
import { TEMPLATES } from '../shared/templates';
import { bausteinSlide, drawLeiste, leisteH, type Baustein, type Leiste } from '../shared/bausteine';

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, d: any, t: number) => void;
interface Folie { draw: Draw; dur: number; menu?: boolean; }

const T = TEMPLATES.gastro;
const ALT = '8,90 €', NEU = '7,90 €';
const items = () => T.items.split('\n').map(l => l.split('|').map(s => s.trim()));
// ShowCube-Farben als Marke: Grün als Hauptfarbe, Gold als Zweitfarbe, das tiefe Grün der Startseite als Hintergrund.
const FARBEN = { primaer: '#2bb596', zweit: '#f2b441', dunkel: '#0f2a25', hell: '#f6f5f1' };
const d: any = { name: T.name, accent: FARBEN.primaer, hours: 'Mo bis Sa, 11:30 bis 23 Uhr', items: items(), logo: null, marke: { farben: FARBEN, vorlagen: [] } };
const salame = d.items.findIndex(r => r[0] === 'Salame');

const bs = (kind: Baustein['kind'], f: Record<string, string>): Draw => bausteinSlide({ id: kind, kind, on: true, when: 'always' as any, f } as Baustein) as Draw;
const inTwoDays = () => { const x = new Date(Date.now() + 2 * 864e5 + 5 * 36e5); return x.toISOString(); };
const [mittag, deal] = (T.slides as any)(0, d) as Draw[];
const FOLIEN: Folie[] = [
  { draw: mittag, dur: 10, menu: true },
  { draw: deal, dur: 7 },
  { draw: bs('reviews', { score: '4,8', count: '214 Bewertungen auf Google', q1: 'Die beste Pizza der Stadt, und super freundlich.', a1: 'Laura M.', q2: 'Schnell, heiß und der Teig ist ein Traum.', a2: 'Tobias K.', url: 'https://g.page/r/showcube-demo/review' }), dur: 9 },
  { draw: bs('countdown', { kicker: 'Nur diese Woche', title: 'Familien-Pizza', big: '−20 %', until: inTwoDays() }), dur: 7 },
  { draw: bs('qr', { title: 'Die ganze Karte aufs Handy', text: 'Einfach mit der Kamera scannen. Auch zum Bestellen und Mitnehmen.', url: 'https://showcube.de/' }), dur: 7 },
];
const LEISTE: Leiste = { on: true, ticker: 'Heute frisch: Kürbis-Pizza mit Salbei   •   Jeden Mittwoch Pasta-Abend   •   Auch zum Mitnehmen', clock: true, weather: true, place: '' };
const WX = { temp: 9, code: 2, at: 0 };
const FADE = .9;

const stage = document.querySelector('.stage') as HTMLElement | null;
const scr = stage && stage.querySelector('.scr') as HTMLElement | null;
if (stage && scr) start(stage, scr);

function start(stage: HTMLElement, scr: HTMLElement) {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const cv = document.createElement('canvas'); cv.className = 'live'; cv.setAttribute('aria-hidden', 'true');
  scr.appendChild(cv); stage.classList.add('js');
  const ctx = cv.getContext('2d');
  // Zwei Puffer für die Überblendung, damit jede Folie für sich mit voller Deckkraft gezeichnet wird.
  const bufA = document.createElement('canvas'), bufB = document.createElement('canvas');
  const phone = buildPhone(stage);

  let idx = 0, since = performance.now(), prev = -1, visible = true, raf = 0;
  const fonts = (document as any).fonts ? Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]) : Promise.resolve();

  function size() {
    const f = Math.min(devicePixelRatio || 1, 2), w = Math.round(scr.clientWidth * f), h = Math.round(scr.clientHeight * f);
    if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = bufA.width = bufB.width = w; cv.height = bufA.height = bufB.height = h; }
  }
  function paintSlide(buf: HTMLCanvasElement, i: number, t: number, sh: number) {
    const c = buf.getContext('2d'); c.save(); c.clearRect(0, 0, buf.width, buf.height);
    c.textBaseline = 'alphabetic';
    FOLIEN[i].draw(c, buf.width, sh, d, still.matches ? 0 : t);
    if (FOLIEN[i].menu) priceFlash(c, buf.width, sh, t);
    c.restore();
  }
  // Leuchtender Rahmen um den Preis, der gerade vom Handy aus geändert wurde.
  function priceFlash(c: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const k = t - PUBLISH; if (k < 0 || k > 2.4 || salame < 0) return;
    const u = Math.min(w, h) / 100, rows = Math.min(d.items.length, 5), top = u * 34, avail = h - top - u * 16, step = Math.min(u * 11, avail / rows);
    const y = top + step * salame + step * .6, a = Math.max(0, 1 - k / 2.4);
    c.save(); c.globalAlpha = a; c.strokeStyle = FARBEN.zweit; c.lineWidth = u * .7;
    const bw = u * 24, bh = u * 9; c.beginPath(); (c as any).roundRect(w - u * 6 - bw + u * 2, y - bh * .78, bw, bh, u * 2); c.stroke(); c.restore();
  }
  function frame(now: number) {
    raf = 0; if (!visible) return;
    size(); const w = cv.width, h = cv.height; if (!w) { raf = requestAnimationFrame(frame); return; }
    let t = (now - since) / 1000;
    if (t >= FOLIEN[idx].dur) { prev = idx; idx = (idx + 1) % FOLIEN.length; since = now; t = 0; if (FOLIEN[idx].menu) resetPrice(); }
    const lh = leisteH(w, h), sh = h - lh;
    phone.update(FOLIEN[idx].menu ? t : -1);
    if (FOLIEN[idx].menu && t >= PUBLISH) d.items[salame][1] = NEU;
    paintSlide(bufA, idx, t, sh);
    ctx.clearRect(0, 0, w, h);
    const p = prev >= 0 ? Math.min(1, t / FADE) : 1, e = 1 - (1 - p) ** 3;
    if (p < 1) {
      paintSlide(bufB, prev, FOLIEN[prev].dur + t, sh);
      ctx.drawImage(bufB, 0, 0, w, sh, 0, 0, w, sh);
    }
    ctx.save(); ctx.globalAlpha = e;
    if (!still.matches && p < 1) { const s = 1.04 - .04 * e; ctx.translate(w / 2, sh / 2); ctx.scale(s, s); ctx.translate(-w / 2, -sh / 2); }
    ctx.beginPath(); ctx.rect(0, 0, w, sh); ctx.clip();
    ctx.drawImage(bufA, 0, 0, w, sh, 0, 0, w, sh); ctx.restore();
    drawLeiste(ctx, sh, w, lh, LEISTE, d, still.matches ? 0 : now / 1000, WX);
    raf = requestAnimationFrame(frame);
  }
  const go = () => { if (!raf && visible) { since = performance.now(); if (FOLIEN[idx].menu) resetPrice(); raf = requestAnimationFrame(frame); } };
  // Nur zeichnen, solange der Fernseher zu sehen ist.
  new IntersectionObserver(es => { const v = es.some(e => e.isIntersecting); if (v && !visible) { visible = true; go(); } else visible = v; }).observe(stage);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; go(); });
  fonts.then(() => { stage.classList.add('ready'); go(); });
}
function resetPrice() { if (salame >= 0) d.items[salame][1] = ALT; }

// ---------- Handy mit dem Panel ----------
// Zeitachse innerhalb der Mittagskarte (Sekunden): hereinfliegen, antippen, tippen, veröffentlichen, live, hinausfliegen.
// Danach steht der Fernseher mit dem neuen Preis wieder allein im Bild.
const IN = .5, TAP = 1.9, TYPE = 2.6, PRESS = 4.2, PUBLISH = 4.7, OUT = 6.9;
function buildPhone(stage: HTMLElement) {
  const el = document.createElement('div'); el.className = 'phone'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<div class="pscr">
    <div class="ptop"><span class="pdot"></span>Theke · läuft</div>
    <div class="ph1">Mittagstisch</div>
    <ul>${d.items.slice(0, 4).map((r, i) => `<li${i === salame ? ' class="hit"' : ''}><span>${r[0]}</span><b>${r[1]}</b></li>`).join('')}</ul>
    <div class="pbtn">Veröffentlichen</div>
    <div class="ptoast">✓ Live auf dem Bildschirm</div>
  </div>`;
  stage.appendChild(el);
  const row = el.querySelector('li.hit') as HTMLElement, price = row && row.querySelector('b') as HTMLElement;
  let last = '';
  return {
    update(t: number) {
      // t < 0: gerade keine Mittagskarte. Außerhalb von IN bis OUT ist das Handy aus dem Bild geflogen.
      const st = t < IN || t >= OUT ? 'off'
        : t < TAP ? 'idle' : t < TYPE ? 'tap' : t < PRESS ? 'type' : t < PUBLISH ? 'press' : t < PUBLISH + 1.8 ? 'live' : 'done';
      if (st === 'type' && price) {
        const n = Math.min(NEU.length, Math.floor((t - TYPE) / ((PRESS - TYPE - .3) / NEU.length)));
        price.textContent = n <= 0 ? '' : NEU.slice(0, n);
      }
      if (st === last) return; last = st;
      el.dataset.st = st;
      if (price && (st === 'idle' || (st === 'off' && t < IN))) price.textContent = ALT;
      if (price && (st === 'press' || st === 'live' || st === 'done')) price.textContent = NEU;
    },
  };
}
