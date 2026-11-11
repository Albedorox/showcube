import '../shared/fonts.css';
import { fontsReady, BODY, DISP, font, fit, fakeQR, TEMPLATES, SWATCHES } from '../shared/templates';

// ---------- Geometrie: Quadrat auf Viereck (Heckbert) und Netz-Verzerrung ----------
function sq2quad(q) {
  const [x0, y0] = q[0], [x1, y1] = q[1], [x2, y2] = q[2], [x3, y3] = q[3];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let a, b, c, d, e, f, g, h;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x2 - x1; c = x0; d = y1 - y0; e = y2 - y1; f = y0; g = 0; h = 0;
  } else {
    const det = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / det;
    h = (dx1 * dy3 - dx3 * dy1) / det;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
  }
  return (u, v) => { const den = g * u + h * v + 1; return [(a * u + b * v + c) / den, (d * u + e * v + f) / den]; };
}

function drawTri(ctx, img, s0, s1, s2, d0, d1, d2) {
  const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  if (Math.abs(den) < 1e-9) return;
  const A = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / den;
  const C = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / den;
  const E = (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  const B = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / den;
  const D = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / den;
  const F = (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * 0.8, p[1] + dy / l * 0.8]; };
  const g0 = grow(d0), g1 = grow(d1), g2 = grow(d2);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.lineTo(g1[0], g1[1]); ctx.lineTo(g2[0], g2[1]); ctx.closePath(); ctx.clip();
  ctx.transform(A, B, C, D, E, F);
  const minx = Math.max(0, Math.floor(Math.min(s0[0], s1[0], s2[0]) - 2)), miny = Math.max(0, Math.floor(Math.min(s0[1], s1[1], s2[1]) - 2));
  const maxx = Math.min(img.width, Math.ceil(Math.max(s0[0], s1[0], s2[0]) + 2)), maxy = Math.min(img.height, Math.ceil(Math.max(s0[1], s1[1], s2[1]) + 2));
  if (maxx > minx && maxy > miny) ctx.drawImage(img, minx, miny, maxx - minx, maxy - miny, minx, miny, maxx - minx, maxy - miny);
  ctx.restore();
}

function warp(ctx, img, quad, n) {
  const H = sq2quad(quad), W = img.width, Hh = img.height;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n, v0 = j / n, v1 = (j + 1) / n;
    const s00 = [u0 * W, v0 * Hh], s10 = [u1 * W, v0 * Hh], s11 = [u1 * W, v1 * Hh], s01 = [u0 * W, v1 * Hh];
    const d00 = H(u0, v0), d10 = H(u1, v0), d11 = H(u1, v1), d01 = H(u0, v1);
    drawTri(ctx, img, s00, s10, s11, d00, d10, d11);
    drawTri(ctx, img, s00, s11, s01, d00, d11, d01);
  }
}

const quadPath = (ctx, q) => { ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); };

// ---------- Zustand ----------
const S = {
  tpl: 'gastro', name: '', items: '', accent: '', logo: null, night: false, port: false, reflect: .45,
  base: null, example: true, quad: null, compare: false, split: .3
};
const scene = document.getElementById('scene') as HTMLCanvasElement, sctx = scene.getContext('2d');
const stage = document.getElementById('stage');
const slideC = document.createElement('canvas'), slctx = slideC.getContext('2d');
const tmpC = document.createElement('canvas'), tctx = tmpC.getContext('2d');

function data() {
  return {
    name: S.name || ' ', accent: S.accent, logo: S.logo, hours: 'Montag bis Samstag, 9 bis 19 Uhr',
    items: S.items.split('\n').map(l => l.split('|').map(s => s.trim())).filter(r => r[0])
  };
}

// ---------- Beispiel-Fassade ----------
const FW = 1200, FH = 800;
const FAC_QUAD = [[150, 70], [1470, 170], [1470, 860], [150, 950]];
function drawFacade() {
  const c = document.createElement('canvas'); c.width = FW; c.height = FH; const x = c.getContext('2d');
  x.fillStyle = '#d6cdbf'; x.fillRect(0, 0, FW, FH);
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(120,100,80,${.02 + (i % 5) * .006})`; x.fillRect((i * 97) % FW, (i * 53) % 200, 140, 3); }
  x.fillStyle = '#9aa6ad';
  [[120, 40], [470, 40], [820, 40]].forEach(([wx, wy]) => { x.fillStyle = '#efe9df'; x.fillRect(wx - 10, wy - 10, 220, 150); x.fillStyle = '#5d6d78'; x.fillRect(wx, wy, 200, 130); x.fillStyle = '#efe9df'; x.fillRect(wx + 98, wy, 4, 130); });
  x.fillStyle = '#23262a'; x.fillRect(80, 196, 1040, 62);
  x.fillStyle = '#f4efe6'; x.textAlign = 'center'; x.textBaseline = 'middle'; fit(x, S.name || 'Ihr Laden', 900, 38, 700, DISP); x.fillText(S.name || 'Ihr Laden', 600, 228);
  x.fillStyle = '#2b2b2b'; x.fillRect(110, 280, 720, 430);
  const g = x.createLinearGradient(0, 294, 0, 696); g.addColorStop(0, '#46535c'); g.addColorStop(1, '#20292f');
  x.fillStyle = g; x.fillRect(124, 294, 692, 402);
  x.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 5; i++) x.fillRect(150 + i * 130, 420, 100, 260);
  x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(124, 560, 692, 6);
  x.fillStyle = '#2b2b2b'; x.fillRect(870, 280, 210, 500); x.fillStyle = '#34414a'; x.fillRect(884, 294, 182, 486);
  x.fillStyle = '#c9b48a'; x.fillRect(1040, 520, 8, 60);
  x.fillStyle = '#8f877b'; x.fillRect(0, 710, 860, 90); x.fillRect(1080, 710, 120, 90);
  return c;
}
function buildExample() {
  scene.width = 1600; scene.height = 1000;
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1000; const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, 1000); sky.addColorStop(0, '#a9c4d6'); sky.addColorStop(1, '#dfe7ea');
  x.fillStyle = sky; x.fillRect(0, 0, 1600, 1000);
  x.fillStyle = '#b9b2a6'; x.fillRect(0, 0, 150, 1000); x.fillStyle = '#c5bfb3'; x.fillRect(1470, 0, 130, 1000);
  x.fillStyle = '#9c9890'; x.beginPath(); x.moveTo(0, 940); x.lineTo(1600, 850); x.lineTo(1600, 1000); x.lineTo(0, 1000); x.fill();
  x.fillStyle = '#7f7b74'; x.fillRect(0, 985, 1600, 15);
  warp(x, drawFacade(), FAC_QUAD, 14);
  S.base = c;
}
function defaultQuad() {
  if (S.example) {
    const H = sq2quad(FAC_QUAD), r = S.port ? [370, 302, 570, 690] : [190, 334, 750, 649];
    return [H(r[0] / FW, r[1] / FH), H(r[2] / FW, r[1] / FH), H(r[2] / FW, r[3] / FH), H(r[0] / FW, r[3] / FH)];
  }
  const W = scene.width, Hh = scene.height, cx = W / 2, cy = Hh / 2;
  let w, h; if (S.port) { h = Hh * .5; w = h * 9 / 16; } else { w = W * .4; h = w * 9 / 16; }
  return [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
}

// ---------- Folien abspielen ----------
const DUR = 5, FADE = .7;
function renderSlide(t) {
  const w = S.port ? 540 : 960, h = S.port ? 960 : 540;
  if (slideC.width !== w || slideC.height !== h) { slideC.width = w; slideC.height = h; tmpC.width = w; tmpC.height = h; }
  const d = data(), list = TEMPLATES[S.tpl].slides(S.night, d);
  if (!list.length) { slctx.fillStyle = '#111'; slctx.fillRect(0, 0, w, h); return; }
  const k = Math.floor(t / DUR), local = t - k * DUR, i = k % list.length, j = (k + 1) % list.length;
  list[i](slctx, w, h, d, t);
  if (local > DUR - FADE && list.length > 1) {
    tctx.clearRect(0, 0, w, h); list[j](tctx, w, h, d, t);
    slctx.globalAlpha = (local - (DUR - FADE)) / FADE; slctx.drawImage(tmpC, 0, 0); slctx.globalAlpha = 1;
  }
}

// ---------- Szene ----------
function drawBefore(ctx) {
  ctx.drawImage(S.base, 0, 0, scene.width, scene.height);
  if (S.night) { ctx.fillStyle = 'rgba(8,14,32,.66)'; ctx.fillRect(0, 0, scene.width, scene.height); }
}
function drawAfter(ctx) {
  drawBefore(ctx);
  const q = S.quad, H = sq2quad(q), b = .018;
  const bez = [H(-b, -b * 1.6), H(1 + b, -b * 1.6), H(1 + b, 1 + b * 1.6), H(-b, 1 + b * 1.6)];
  if (S.night) {
    const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2, rad = Math.hypot(q[2][0] - q[0][0], q[2][1] - q[0][1]) * .9;
    const g = ctx.createRadialGradient(cx, cy, rad * .2, cx, cy, rad);
    g.addColorStop(0, 'rgba(255,236,214,.28)'); g.addColorStop(1, 'rgba(255,236,214,0)');
    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2); ctx.globalCompositeOperation = 'source-over';
  }
  quadPath(ctx, bez); ctx.fillStyle = '#0d0d0f'; ctx.fill();
  warp(ctx, slideC, q, 10);
  const k = S.reflect * (S.night ? .35 : 1);
  if (k > 0) {
    ctx.save(); quadPath(ctx, q); ctx.clip();
    const g = ctx.createLinearGradient(q[0][0], q[0][1], q[2][0], q[2][1]);
    g.addColorStop(0, `rgba(255,255,255,${.05 * k})`); g.addColorStop(.32, `rgba(255,255,255,${.26 * k})`); g.addColorStop(.42, `rgba(255,255,255,${.04 * k})`);
    g.addColorStop(.7, `rgba(255,255,255,${.12 * k})`); g.addColorStop(1, `rgba(255,255,255,${.02 * k})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, scene.width, scene.height); ctx.restore();
  }
}
function frame(now) {
  const t = now / 1000;
  renderSlide(t);
  drawAfter(sctx);
  if (S.compare) {
    sctx.save(); sctx.beginPath(); sctx.rect(0, 0, scene.width * S.split, scene.height); sctx.clip(); drawBefore(sctx); sctx.restore();
  }
  placeHandles();
  requestAnimationFrame(frame);
}

// ---------- Ecken ziehen ----------
const handles = [0, 1, 2, 3].map(i => {
  const el: any = document.createElement('div'); el.className = 'handle'; el.tabIndex = 0;
  el.setAttribute('role', 'slider'); el.setAttribute('aria-label', ['Ecke oben links', 'Ecke oben rechts', 'Ecke unten rechts', 'Ecke unten links'][i] + ', mit Pfeiltasten verschieben');
  stage.appendChild(el); return el;
});
const split: any = document.createElement('div'); split.className = 'split'; split.hidden = true; split.innerHTML = '<span aria-hidden="true">⇆</span>';
const lblB = document.createElement('div'); lblB.className = 'split-label'; lblB.textContent = 'Heute'; const lblA = document.createElement('div'); lblA.className = 'split-label'; lblA.textContent = 'Mit Bildschirm';
stage.append(split, lblB, lblA);
function scale() { const r = scene.getBoundingClientRect(); return r.width / scene.width; }
function placeHandles() {
  const s = scale();
  handles.forEach((el, i) => { el.style.left = S.quad[i][0] * s + 'px'; el.style.top = S.quad[i][1] * s + 'px'; el.hidden = S.compare; });
  split.hidden = lblA.hidden = lblB.hidden = !S.compare;
  const sx = S.split * scene.width * s; split.style.left = sx + 'px';
  lblB.style.left = '10px'; lblA.style.right = '10px';
}
function toScene(e) { const r = scene.getBoundingClientRect(), s = scene.width / r.width; return [(e.clientX - r.left) * s, (e.clientY - r.top) * s]; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
handles.forEach((el, i) => {
  el.addEventListener('pointerdown', (e: any) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); el.dragging = true; });
  el.addEventListener('pointermove', (e: any) => { if (!el.dragging) return; const [x, y] = toScene(e); S.quad[i] = [clamp(x, 0, scene.width), clamp(y, 0, scene.height)]; });
  el.addEventListener('pointerup', () => { el.dragging = false; });
  el.addEventListener('keydown', (e: any) => {
    const step = e.shiftKey ? 20 : 4, m = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (m) { e.preventDefault(); S.quad[i] = [clamp(S.quad[i][0] + m[0], 0, scene.width), clamp(S.quad[i][1] + m[1], 0, scene.height)]; }
  });
});
function inside(p, q) { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { if ((q[i][1] > p[1]) !== (q[j][1] > p[1]) && p[0] < (q[j][0] - q[i][0]) * (p[1] - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) c = !c; } return c; }
let moving = null;
scene.addEventListener('pointerdown', (e: any) => {
  const p = toScene(e);
  if (S.compare) { moving = 'split'; S.split = clamp(p[0] / scene.width, 0, 1); scene.setPointerCapture(e.pointerId); return; }
  if (inside(p, S.quad)) { moving = { p, q: S.quad.map(v => v.slice()) }; scene.setPointerCapture(e.pointerId); }
});
scene.addEventListener('pointermove', (e: any) => {
  if (!moving) return; const p = toScene(e);
  if (moving === 'split') { S.split = clamp(p[0] / scene.width, 0, 1); return; }
  const dx = p[0] - moving.p[0], dy = p[1] - moving.p[1]; S.quad = moving.q.map(v => [v[0] + dx, v[1] + dy]);
});
scene.addEventListener('pointerup', () => { moving = null; });
split.addEventListener('pointerdown', (e: any) => { e.stopPropagation(); split.setPointerCapture(e.pointerId); split.dragging = true; });
split.addEventListener('pointermove', (e: any) => { if (split.dragging) S.split = clamp(toScene(e)[0] / scene.width, 0, 1); });
split.addEventListener('pointerup', () => { split.dragging = false; });

// ---------- Bedienung ----------
const $ = (id: string) => document.getElementById(id) as any;
const tplSel = $('tpl');
Object.entries(TEMPLATES).forEach(([k, v]) => { const o = document.createElement('option'); o.value = k; o.textContent = v.label; tplSel.appendChild(o); });
const sw = $('swatches');
SWATCHES.forEach(c => { const b = document.createElement('button'); b.style.background = c; b.setAttribute('aria-label', 'Farbe ' + c); b.onclick = () => { S.accent = c; syncSwatches(); }; sw.appendChild(b); });
function syncSwatches() { [...sw.children].forEach((b, i) => b.setAttribute('aria-pressed', SWATCHES[i] === S.accent)); }
function applyTemplate(k) {
  const T = TEMPLATES[k]; S.tpl = k; S.name = T.name; S.items = T.items; S.accent = T.accent;
  $('name').value = S.name; $('items').value = S.items; $('itemsHelp').textContent = T.help; syncSwatches();
  if (S.example) buildExample();
}
tplSel.onchange = () => applyTemplate(tplSel.value);
let facadeTimer;
$('name').oninput = (e: any) => { S.name = e.target.value; if (S.example) { clearTimeout(facadeTimer); facadeTimer = setTimeout(buildExample, 250); } };
$('items').oninput = (e: any) => { S.items = e.target.value; };
const seg = (a, b, on) => { $(a).setAttribute('aria-pressed', on); $(b).setAttribute('aria-pressed', !on); };
$('tDay').onclick = () => { S.night = false; seg('tDay', 'tNight', true); };
$('tNight').onclick = () => { S.night = true; seg('tDay', 'tNight', false); };
function setOrient(p) {
  if (S.port === p) return; S.port = p; seg('oLand', 'oPort', !p);
  if (S.example) { S.quad = defaultQuad(); return; }
  const q = S.quad, cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cy = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4;
  const hgt = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]), wid = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]);
  let w, h; if (p) { h = Math.max(hgt, wid); w = h * 9 / 16; } else { w = Math.max(hgt, wid); h = w * 9 / 16; }
  S.quad = [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
}
$('oLand').onclick = () => setOrient(false);
$('oPort').onclick = () => setOrient(true);
$('reflect').oninput = (e: any) => { S.reflect = e.target.value / 100; };
$('btnCompare').onclick = (e: any) => { S.compare = !S.compare; e.currentTarget.setAttribute('aria-pressed', S.compare); };
$('btnPresent').onclick = (e: any) => { const on = document.body.classList.toggle('present'); e.currentTarget.textContent = on ? 'Bearbeiten' : 'Präsentieren'; };

function loadImage(file, cb) {
  if (!file || !file.type.startsWith('image/')) return;
  const url = URL.createObjectURL(file), img = new Image();
  img.onload = () => { cb(img); URL.revokeObjectURL(url); };
  img.onerror = () => { $('hint').textContent = 'Das Bild ließ sich nicht öffnen. Bitte ein JPG oder PNG versuchen.'; };
  img.src = url;
}
function usePhoto(img) {
  const s = Math.min(1, 1800 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  scene.width = c.width; scene.height = c.height; S.base = c; S.example = false; S.quad = defaultQuad();
  $('hint').textContent = 'Ziehe die vier weißen Punkte auf die Stelle, an der der Bildschirm hängen soll.';
}
$('photoInput').onchange = (e: any) => loadImage(e.target.files[0], usePhoto);
stage.addEventListener('dragover', (e: any) => e.preventDefault());
stage.addEventListener('drop', (e: any) => { e.preventDefault(); loadImage(e.dataTransfer.files[0], usePhoto); });
$('btnExample').onclick = () => { S.example = true; buildExample(); S.quad = defaultQuad(); };
$('logoInput').onchange = (e: any) => loadImage(e.target.files[0], img => { S.logo = img; $('btnLogoOff').hidden = false; });
$('btnLogoOff').onclick = () => { S.logo = null; $('btnLogoOff').hidden = true; $('logoInput').value = ''; };

// ---------- Export ----------
const dlg = $('dlg'); let lastCanvas = null;
function show(title, canvas) {
  lastCanvas = canvas; $('dlgTitle').textContent = title; $('dlgImg').src = canvas.toDataURL('image/jpeg', .92); $('dlgImg').alt = title; $('dlgStatus').textContent = '';
  if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
}
$('dlgClose').onclick = () => dlg.close ? dlg.close() : dlg.removeAttribute('open');
$('dlgCopy').onclick = () => {
  if (!lastCanvas || !navigator.clipboard || !window.ClipboardItem) { $('dlgStatus').textContent = 'Kopieren geht hier nicht, bitte das Bild speichern.'; return; }
  lastCanvas.toBlob(b => navigator.clipboard.write([new ClipboardItem({ 'image/png': b })])
    .then(() => { $('dlgStatus').textContent = 'Kopiert.'; })
    .catch(() => { $('dlgStatus').textContent = 'Kopieren wurde blockiert, bitte das Bild speichern.'; }), 'image/png');
};
function snapshot(before) {
  const c = document.createElement('canvas'); c.width = scene.width; c.height = scene.height;
  const x = c.getContext('2d'); if (before) drawBefore(x); else drawAfter(x); return c;
}
$('btnShot').onclick = () => show('Schaufenster mit Bildschirm', snapshot(false));
function cover(ctx, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height), sw = w / s, sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}
$('btnCard').onclick = () => {
  const W = 1748, H = 1240, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.fillStyle = '#f7f5f0'; x.fillRect(0, 0, W, H);
  const pw = 812, ph = 560, py = 150;
  cover(x, snapshot(true), 50, py, pw, ph); cover(x, snapshot(false), 886, py, pw, ph);
  x.fillStyle = '#1c1a17'; x.textAlign = 'left'; font(x, 600, 30, BODY); x.fillText('Heute', 50, py - 22); x.fillText('Mit Bildschirm', 886, py - 22);
  x.fillStyle = S.accent; x.fillRect(50, 60, 90, 10);
  fit(x, 'So könnte Ihr Schaufenster aussehen, ' + S.name + '.', 1180, 64, 800, DISP); x.fillStyle = '#1c1a17'; x.fillText('So könnte Ihr Schaufenster aussehen, ' + S.name + '.', 50, 830);
  font(x, 500, 34, BODY); x.fillStyle = '#4a463f';
  ['14 Tage kostenlos testen: Wir schließen die Box an Ihren Fernseher an,', 'Ihre Inhalte laufen sofort. Gefällt es nicht, holen wir sie wieder ab.'].forEach((l, i) => x.fillText(l, 50, 900 + i * 48));
  font(x, 700, 36, BODY); x.fillStyle = S.accent; x.fillText('Ab 12 € im Monat, ohne Technikkenntnisse.', 50, 1030);
  font(x, 800, 44, DISP); x.fillStyle = '#1c1a17'; x.fillText('ShowCube', 50, 1170);
  font(x, 500, 26, BODY); x.fillStyle = '#6b665d'; x.fillText('Plug & Show: digitale Schaufenster für Ihr Geschäft', 300, 1166);
  fakeQR(x, 1450, 830, 240, S.name, '#1c1a17', '#ffffff');
  font(x, 500, 22, BODY); x.textAlign = 'center'; x.fillStyle = '#6b665d'; x.fillText('Live-Vorschau (QR-Platzhalter)', 1570, 1120);
  show('Postkarte A6 zum Ausdrucken', c);
};

// ---------- Start ----------
applyTemplate('gastro');
buildExample();
S.quad = defaultQuad();
const go = () => { if (S.example) buildExample(); requestAnimationFrame(frame); };
fontsReady().then(go, go);
addEventListener('resize', placeHandles);
