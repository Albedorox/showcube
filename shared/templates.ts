// Folien-Vorlagen und Zeichenhelfer, gemeinsam genutzt von Player und Konfigurator.
// ---------- Zeichenhelfer für die Folien ----------
export const DISP = '"Bricolage Grotesque", "Segoe UI", sans-serif';
export const BODY = '"Figtree", "Segoe UI", sans-serif';
export function font(ctx, w, size, fam) { ctx.font = `${w} ${size}px ${fam}`; }
export function fit(ctx, text, maxW, size, w, fam) { let s = size; font(ctx, w, s, fam); while (ctx.measureText(text).width > maxW && s > 8) { s -= 1; font(ctx, w, s, fam); } return s; }
export function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/), lines = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = wd; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
export function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
export function hash(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function mix(hex: string, t: number, to?: string) {
  const p = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(hex), b = p(to || '#000000');
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
}
export function drawLogo(ctx, d, x, y, maxW, maxH) {
  if (!d.logo) return false;
  const s = Math.min(maxW / d.logo.width, maxH / d.logo.height);
  ctx.drawImage(d.logo, x - d.logo.width * s, y, d.logo.width * s, d.logo.height * s); return true;
}
export function footer(ctx, w, h, d, u, color) {
  font(ctx, 600, u * 3.4, BODY); ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(d.name, u * 6, h - u * 5);
}
export function fakeQR(ctx, x, y, size, seed, dark, light) {
  const n = 25, m = size / n; let r = hash(seed) || 1;
  ctx.fillStyle = light; ctx.fillRect(x - m, y - m, size + 2 * m, size + 2 * m); ctx.fillStyle = dark;
  const finder = (fx, fy) => { ctx.fillRect(x + fx * m, y + fy * m, 7 * m, 7 * m); ctx.fillStyle = light; ctx.fillRect(x + (fx + 1) * m, y + (fy + 1) * m, 5 * m, 5 * m); ctx.fillStyle = dark; ctx.fillRect(x + (fx + 2) * m, y + (fy + 2) * m, 3 * m, 3 * m); };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const inF = (i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9);
    r ^= r << 13; r ^= r >>> 17; r ^= r << 5;
    if (!inF && (r >>> 0) % 100 < 46) ctx.fillRect(x + i * m, y + j * m, m + .3, m + .3);
  }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
}

// ---------- Branchenvorlagen ----------
export function menuSlide(title, sub) {
  return (ctx, w, h, d) => {
    const u = Math.min(w, h) / 100, port = h > w;
    ctx.fillStyle = '#16120f'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = d.accent; ctx.fillRect(0, 0, w, u * 1.6);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    font(ctx, 600, u * 4, BODY); ctx.fillStyle = d.accent; ctx.fillText(d.name.toUpperCase(), u * 6, u * 11);
    fit(ctx, title, w - u * 30, u * (port ? 13 : 12), 800, DISP); ctx.fillStyle = '#fff6ea'; ctx.fillText(title, u * 6, u * (port ? 26 : 24));
    drawLogo(ctx, d, w - u * 6, u * 5, u * 22, u * 12);
    const rows = d.items.slice(0, port ? 7 : 5), top = u * (port ? 38 : 34), avail = h - top - u * 16, step = Math.min(u * (port ? 14 : 11), avail / Math.max(rows.length, 1));
    rows.forEach((r, i) => {
      const y = top + step * i + step * .6, name = r[0] || '', price = r[1] || '';
      const s = fit(ctx, name, w * (port ? .6 : .62), u * (port ? 6.4 : 5.6), 600, BODY); ctx.fillStyle = '#fff6ea'; ctx.textAlign = 'left'; ctx.fillText(name, u * 6, y);
      const nw = ctx.measureText(name).width;
      font(ctx, 700, s, DISP); ctx.textAlign = 'right'; ctx.fillStyle = d.accent; ctx.fillText(price, w - u * 6, y);
      const pw = ctx.measureText(price).width; ctx.fillStyle = 'rgba(255,246,234,.28)';
      for (let x = u * 6 + nw + u * 2; x < w - u * 6 - pw - u * 2; x += u * 1.6) ctx.fillRect(x, y - u * .6, u * .5, u * .5);
    });
    font(ctx, 500, u * 3.6, BODY); ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,246,234,.7)'; ctx.fillText(sub, u * 6, h - u * 5);
  };
}
export function promoSlide(kicker, line, big) {
  return (ctx, w, h, d, t) => {
    const u = Math.min(w, h) / 100, port = h > w;
    ctx.fillStyle = d.accent; ctx.fillRect(0, 0, w, h);
    const px = port ? w / 2 : w * .74, py = port ? h * .7 : h * .52, pr = port ? w * .36 : h * .36;
    ctx.save(); ctx.translate(px, py); ctx.rotate(t * .25);
    ctx.fillStyle = '#e9b866'; ctx.beginPath(); ctx.arc(0, 0, pr, 0, 7); ctx.fill();
    ctx.fillStyle = '#c8402a'; ctx.beginPath(); ctx.arc(0, 0, pr * .86, 0, 7); ctx.fill();
    ctx.fillStyle = '#f3e3b5'; for (let i = 0; i < 9; i++) { const a = i * 2.4, rr2 = pr * (.25 + (i % 3) * .2); ctx.beginPath(); ctx.arc(Math.cos(a) * rr2, Math.sin(a) * rr2, pr * .12, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#7a1f14'; for (let i = 0; i < 7; i++) { const a = i * 1.7 + 1, rr2 = pr * (.35 + (i % 2) * .25); ctx.beginPath(); ctx.arc(Math.cos(a) * rr2, Math.sin(a) * rr2, pr * .07, 0, 7); ctx.fill(); }
    ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    const tw = port ? w - u * 12 : w * .5;
    font(ctx, 700, u * 4.4, BODY); ctx.fillText(kicker.toUpperCase(), u * 6, u * 14);
    fit(ctx, line, tw, u * 9, 700, DISP); ctx.fillText(line, u * 6, u * 28);
    fit(ctx, big, tw, u * (port ? 20 : 19), 800, DISP); ctx.fillText(big, u * 6, u * (port ? 50 : 50));
    footer(ctx, w, h, d, u, 'rgba(255,255,255,.85)');
  };
}
export function houseArt(ctx, x, y, w, h, seed) {
  const r = hash(seed), hue = r % 360;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, `hsl(${(hue + 190) % 360},45%,72%)`); g.addColorStop(1, `hsl(${(hue + 160) % 360},40%,88%)`);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = `hsl(${hue % 120 + 80},30%,45%)`; ctx.fillRect(x, y + h * .78, w, h * .22);
  const bx = x + w * .2, bw = w * .6, by = y + h * .38, bh = h * .42;
  ctx.fillStyle = `hsl(${hue},25%,92%)`; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = `hsl(${hue},45%,38%)`; ctx.beginPath(); ctx.moveTo(bx - bw * .06, by); ctx.lineTo(bx + bw / 2, y + h * .14); ctx.lineTo(bx + bw * 1.06, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = `hsl(${(hue + 200) % 360},30%,35%)`;
  for (let i = 0; i < 3; i++) ctx.fillRect(bx + bw * (.1 + i * .3), by + bh * .15, bw * .2, bh * .25);
  ctx.fillRect(bx + bw * .42, by + bh * .55, bw * .16, bh * .45);
}
export const CLASSES = ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const CLASS_COL = ['#1a9850', '#4cb14b', '#91cf60', '#c6e46a', '#fee08b', '#fdbf6f', '#fc8d59', '#e65a3c', '#c0262d'];
export function objectSlide(idx) {
  return (ctx, w, h, d) => {
    const u = Math.min(w, h) / 100, port = h > w, r = d.items[idx] || [];
    ctx.fillStyle = '#f5f3ef'; ctx.fillRect(0, 0, w, h);
    if (port) houseArt(ctx, 0, 0, w, h * .44, (r[0] || '') + idx); else houseArt(ctx, 0, 0, w * .46, h, (r[0] || '') + idx);
    const x0 = port ? u * 6 : w * .46 + u * 6, tw = port ? w - u * 12 : w * .54 - u * 12; let y = port ? h * .44 + u * 12 : u * 14;
    ctx.textAlign = 'left'; ctx.fillStyle = d.accent; font(ctx, 700, u * 3.6, BODY); ctx.fillText('NEU IM ANGEBOT', x0, y);
    font(ctx, 800, u * (port ? 8 : 7.2), DISP); ctx.fillStyle = '#1c1a17';
    wrap(ctx, r[0] || 'Objekt', tw).slice(0, 2).forEach((l, i) => ctx.fillText(l, x0, y + u * (port ? 10 : 9) * (i + 1)));
    y += u * (port ? 30 : 27);
    font(ctx, 600, u * 4.6, BODY); ctx.fillStyle = '#4a463f'; ctx.fillText(r[1] || '', x0, y);
    fit(ctx, r[2] || '', tw, u * (port ? 11 : 9.5), 800, DISP); ctx.fillStyle = d.accent; ctx.fillText(r[2] || '', x0, y + u * (port ? 13 : 11.5));
    const cls = Math.max(0, CLASSES.indexOf((r[3] || '').trim().toUpperCase())), cy = y + u * (port ? 22 : 19), cw = Math.min(tw, u * 60) / 9;
    font(ctx, 500, u * 2.8, BODY); ctx.fillStyle = '#4a463f'; ctx.fillText('Energieeffizienzklasse', x0, cy - u * 1.6);
    CLASSES.forEach((c, i) => { ctx.fillStyle = CLASS_COL[i]; ctx.fillRect(x0 + i * cw, cy, cw - u * .4, u * 4.4); ctx.fillStyle = '#1c1a17'; font(ctx, i === cls ? 800 : 500, u * 2.6, BODY); ctx.textAlign = 'center'; ctx.fillText(c, x0 + i * cw + cw / 2 - u * .2, cy + u * 3.2); });
    ctx.strokeStyle = '#1c1a17'; ctx.lineWidth = u * .6; ctx.strokeRect(x0 + cls * cw - u * .3, cy - u * .3, cw + u * .2, u * 5);
    ctx.textAlign = 'left';
    if (!drawLogo(ctx, d, w - u * 5, h - u * 13, u * 20, u * 9)) { font(ctx, 700, u * 3.6, BODY); ctx.fillStyle = '#1c1a17'; ctx.textAlign = 'right'; ctx.fillText(d.name, w - u * 5, h - u * 5); ctx.textAlign = 'left'; }
  };
}
export function textSlide(kicker, line, sub, qr) {
  return (ctx, w, h, d) => {
    const u = Math.min(w, h) / 100, port = h > w;
    ctx.fillStyle = mix(d.accent, .35); ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.75)'; font(ctx, 700, u * 4, BODY); ctx.fillText(kicker.toUpperCase(), u * 6, u * 14);
    const tw = qr && !port ? w * .58 : w - u * 12;
    font(ctx, 800, u * (port ? 10 : 9), DISP); ctx.fillStyle = '#fff';
    const lines = wrap(ctx, line, tw).slice(0, 3); lines.forEach((l, i) => ctx.fillText(l, u * 6, u * 28 + i * u * (port ? 11.5 : 10.5)));
    font(ctx, 500, u * 4.4, BODY); ctx.fillStyle = 'rgba(255,255,255,.85)';
    wrap(ctx, sub, tw).slice(0, 3).forEach((l, i) => ctx.fillText(l, u * 6, u * 32 + lines.length * u * (port ? 11.5 : 10.5) + i * u * 6));
    if (qr) { const s = port ? w * .42 : h * .42; fakeQR(ctx, port ? (w - s) / 2 : w - s - u * 9, port ? h - s - u * 16 : (h - s) / 2, s, d.name, '#111', '#fff'); }
    footer(ctx, w, h, d, u, 'rgba(255,255,255,.9)');
  };
}
export function saleSlide(idx, dark) {
  return (ctx, w, h, d) => {
    const u = Math.min(w, h) / 100, port = h > w, r = d.items[idx] || [];
    ctx.fillStyle = dark ? '#141414' : d.accent; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = dark ? d.accent : 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.arc(port ? w * .9 : w * .92, port ? h * .18 : h * .2, port ? w * .55 : h * .6, 0, 7); ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    font(ctx, 600, u * 5.2, BODY); ctx.fillText(r[0] || '', u * 6, port ? h * .42 : h * .36);
    fit(ctx, r[1] || '', w - u * 12, u * (port ? 18 : 17), 800, DISP); ctx.fillText(r[1] || '', u * 6, port ? h * .42 + u * 20 : h * .36 + u * 18);
    font(ctx, 500, u * 3.6, BODY); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillText(d.hours, u * 6, h - u * 5);
    ctx.textAlign = 'right'; font(ctx, 700, u * 3.6, BODY); ctx.fillStyle = '#fff';
    if (!drawLogo(ctx, d, w - u * 6, u * 5, u * 22, u * 11)) ctx.fillText(d.name, w - u * 6, u * 10);
    ctx.textAlign = 'left';
  };
}

export const TEMPLATES = {
  gastro: {
    label: 'Gastro: Menütafel', name: 'Pizzeria Da Marco', accent: '#d9482b',
    items: 'Margherita | 7,50 €\nSalame | 8,90 €\nFunghi | 8,50 €\nDiavola | 9,50 €\nQuattro Formaggi | 10,50 €',
    help: 'Eine Zeile pro Gericht: Name | Preis',
    slides: n => n ? [menuSlide('Abendkarte', 'Heute bis 23 Uhr geöffnet, auch zum Mitnehmen'), promoSlide('Heute Abend', 'Jede zweite Pizza', 'halber Preis')]
                   : [menuSlide('Mittagstisch', 'Montag bis Freitag, 11:30 bis 14:30 Uhr'), promoSlide('Mittagsdeal', 'Pizza und Getränk', '9,90 €')]
  },
  makler: {
    label: 'Makler: Objekte', name: 'Hausmann Immobilien', accent: '#1f6f8b',
    items: '3-Zimmer-Wohnung in der Altstadt | 78 m², Balkon | 890 € kalt | C\nReihenhaus mit Garten | 124 m², 5 Zimmer | 429.000 € | B\nPenthouse am Stadtpark | 96 m², Dachterrasse | 1.450 € kalt | A',
    help: 'Eine Zeile pro Objekt: Titel | Fläche | Preis | Energieklasse (A+ bis H)',
    slides: (n, d) => [...d.items.slice(0, 4).map((_, i) => objectSlide(i)),
      n ? textSlide('Auch nach Ladenschluss', 'QR-Code scannen, Exposé aufs Handy.', 'Alle Objekte und Besichtigungstermine rund um die Uhr.', true)
        : textSlide('Sie möchten verkaufen?', 'Wir bewerten Ihre Immobilie kostenlos.', 'Kommen Sie herein oder vereinbaren Sie einen Termin.', false)]
  },
  laden: {
    label: 'Laden: Angebote', name: 'Modehaus Linde', accent: '#b8326b',
    items: 'Herbst-Sale | bis -30 %\nNeue Kollektion | jetzt da\nGutscheine | ab 10 €',
    help: 'Eine Zeile pro Angebot: Überschrift | großer Text',
    slides: (n, d) => n ? [textSlide('Gerade geschlossen', 'Morgen ab 9 Uhr wieder für Sie da.', 'Bis dahin: schauen Sie sich in Ruhe um.', false), ...d.items.slice(0, 4).map((_, i) => saleSlide(i, true))]
                        : d.items.slice(0, 4).map((_, i) => saleSlide(i, i % 2 === 1))
  }
};
export const SWATCHES = ['#d9482b', '#1f6f8b', '#b8326b', '#2f7d32', '#e09a1a', '#3b3f9c'];

// Canvas-Text nutzt eine Schrift erst, wenn sie geladen ist. Vor der ersten Folie darauf warten,
// aber nie länger als timeoutMs, damit der Player auch im Fehlerfall startet.
export function fontsReady(timeoutMs = 2500): Promise<unknown> {
  if (!document.fonts) return Promise.resolve();
  const loads = [document.fonts.load(`800 20px ${DISP}`), document.fonts.load(`500 20px ${BODY}`), document.fonts.ready];
  return Promise.race([Promise.allSettled(loads), new Promise<void>(r => setTimeout(r, timeoutMs))]);
}
