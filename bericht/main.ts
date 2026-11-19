// Bericht für einen Werbepartner: öffentlich lesbar, ohne Anmeldung.
// Alle Zahlen stecken im Link selbst (nach dem #), das Panel erzeugt ihn unter „Partner“ → „Bericht-Link“.
// Der Teil nach # geht nie an einen Server, auch nicht an GitHub Pages.
import '../shared/fonts.css';
import { berichtLesen, type Bericht } from '../shared/werbung';

const app = document.getElementById('app')!;
const STARTSEITE = '../'; // release/bericht.html und /bericht/ liegen beide eine Ebene unter der Startseite
const esc = (s: string) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const zahl = (n: number) => Math.round(n).toLocaleString('de-DE');
const datum = (s: string) => { const [y, m, d] = s.split('-'); return +d + '.' + +m + '.' + y; };
const kurz = (s: string) => { const [, m, d] = s.split('-'); return +d + '.' + +m + '.'; };
function dauer(sek: number) { const h = Math.floor(sek / 3600), m = Math.round(sek % 3600 / 60); return h ? h + ' h ' + m + ' min' : m + ' min'; }

function leer() {
  app.innerHTML = `<div class="brand"><span class="cube" aria-hidden="true"></span><span>ShowCube</span><span>Werbebericht</span></div>
  <div class="card"><h1 style="font-size:26px">Dieser Bericht-Link ist unvollständig.</h1><p class="sub">Bitte den Link noch einmal ganz kopieren oder beim Laden einen neuen anfragen.</p></div>`;
}

function chart(tage: [string, number][]) {
  const W = 800, H = 220, L = 44, B = 26, T = 8, max = Math.max(1, ...tage.map(t => t[1]));
  const step = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / step) * step, ticks = [0, nice / 2, nice];
  const bw = (W - L) / Math.max(1, tage.length), gap = Math.min(6, bw * .25), y = (v: number) => T + (H - T - B) * (1 - v / nice);
  const every = Math.ceil(tage.length / 10);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Einblendungen pro Tag">
    <g class="grid">${ticks.map(v => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/>`).join('')}</g>
    <g class="axis">${ticks.map(v => `<text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${zahl(v)}</text>`).join('')}
      ${tage.map((t, i) => i % every ? '' : `<text x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${kurz(t[0])}</text>`).join('')}</g>
    ${tage.map((t, i) => { const x = L + i * bw + gap / 2, w = Math.max(2, bw - gap), yy = y(t[1]), hh = Math.max(0, H - B - yy), r = Math.min(4, w / 2, hh);
      // Oben abgerundet, unten gerade auf der Grundlinie.
      const d = hh ? `M${x},${H - B}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + w - r}Q${x + w},${yy} ${x + w},${yy + r}V${H - B}Z` : '';
      return `<g data-i="${i}"><rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}"/><path class="bar" d="${d}" fill="var(--accent)"/></g>`; }).join('')}
  </svg><div class="tip" hidden></div>`;
}

function zeigen(b: Bericht) {
  const summe = b.tage.reduce((a, t) => a + t[1], 0), tageMit = b.tage.filter(t => t[1] > 0).length;
  const lauf = b.von && b.bis ? datum(b.von) + ' bis ' + datum(b.bis) : b.von ? 'seit ' + datum(b.von) : b.bis ? 'bis ' + datum(b.bis) : 'ohne Ende';
  const stand = new Date(b.stand);
  document.title = 'Werbebericht ' + b.partner + ' · ShowCube';
  app.innerHTML = `
  <div class="brand"><span class="cube" aria-hidden="true"></span><span>ShowCube</span><span>Werbebericht</span></div>
  <div><h1>${esc(b.partner)}</h1><p class="sub">Deine Anzeige auf den Bildschirmen von ${esc(b.betrieb)}.</p></div>
  ${b.echt ? '' : '<div class="demo" role="note">Beispielwerte: Diese Zahlen sind aus dem Zeitplan hochgerechnet, nicht von einer Box gezählt.</div>'}
  <section class="card top">
    ${b.bild ? `<img src="${b.bild}" alt="So sieht deine Anzeige auf dem Bildschirm aus">` : ''}
    <dl class="facts">
      <dt>Laufzeit</dt><dd>${lauf}</dd>
      <dt>Wie oft</dt><dd>jede ${b.takt}. Folie, je ${b.sek} Sekunden</dd>
      <dt>Bildschirme</dt><dd>${b.bildschirme.length}</dd>
      <dt>Stand</dt><dd>${stand.toLocaleDateString('de-DE')}, ${stand.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</dd>
    </dl>
  </section>
  <section class="stats">
    <div class="card"><span>Einblendungen</span><b>${zahl(summe)}</b></div>
    <div class="card"><span>Sendezeit</span><b>${dauer(summe * b.sek)}</b></div>
    <div class="card"><span>Pro Tag im Schnitt</span><b>${zahl(tageMit ? summe / tageMit : 0)}</b></div>
    <div class="card"><span>Tage gelaufen</span><b>${tageMit}</b></div>
  </section>
  <section class="card">
    <h2>Einblendungen pro Tag</h2>
    ${b.tage.length ? `<div class="chart" id="chart">${chart(b.tage)}</div>` : '<p class="note">Noch keine Einblendungen. Die Anzeige startet ' + (b.von ? 'am ' + datum(b.von) : 'bald') + '.</p>'}
    <details><summary>Als Tabelle</summary>
      <table><thead><tr><th>Tag</th><th class="n">Einblendungen</th></tr></thead><tbody>${b.tage.map(t => `<tr><td>${datum(t[0])}</td><td class="n">${zahl(t[1])}</td></tr>`).join('')}</tbody></table>
    </details>
  </section>
  <section class="card">
    <h2>Nach Bildschirm</h2>
    <table><thead><tr><th>Bildschirm</th><th>Standort</th><th class="n">Einblendungen</th></tr></thead>
    <tbody>${b.bildschirme.map(s => `<tr><td>${esc(s[0])}</td><td>${esc(s[1])}</td><td class="n">${zahl(s[2])}</td></tr>`).join('')}</tbody></table>
  </section>
  <div class="row"><button class="btn" id="csv">Als CSV speichern</button><span class="note">Für Excel oder Numbers.</span></div>
  <p class="note">${b.echt ? 'Gezählt von den ShowCube-Boxen: jede Einblendung, die tatsächlich auf dem Bildschirm lief.' : ''} Der Bericht zeigt den Stand von ${stand.toLocaleDateString('de-DE')}. Für neuere Zahlen schickt dir ${esc(b.betrieb)} einen neuen Link. Abgerechnet wird direkt mit ${esc(b.betrieb)}, nicht über ShowCube.</p>
  <footer>Gezeigt mit ShowCube. Auch einen Bildschirm, der für dein Geschäft wirbt? <a href="${STARTSEITE}">ShowCube ansehen</a></footer>`;

  const c = document.getElementById('chart');
  if (c) {
    const tip = c.querySelector('.tip') as HTMLElement;
    c.addEventListener('pointermove', (e: PointerEvent) => {
      const g = (e.target as Element).closest('g[data-i]') as SVGGElement | null;
      c.querySelectorAll('g.on').forEach(x => x.classList.remove('on'));
      if (!g) { tip.hidden = true; return; }
      g.classList.add('on'); const t = b.tage[+g.dataset.i!], r = c.getBoundingClientRect(), br = g.querySelector('.hit')!.getBoundingClientRect();
      tip.textContent = datum(t[0]) + ': ' + zahl(t[1]) + ' Einblendungen'; tip.hidden = false;
      tip.style.left = Math.min(r.width - 70, Math.max(70, br.left - r.left + br.width / 2)) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
    });
    c.addEventListener('pointerleave', () => { tip.hidden = true; c.querySelectorAll('g.on').forEach(x => x.classList.remove('on')); });
  }
  document.getElementById('csv')!.onclick = () => {
    const rows = [['Partner', 'Betrieb', 'Tag', 'Einblendungen'], ...b.tage.map(t => [b.partner, b.betrieb, datum(t[0]), String(t[1])])];
    const csv = rows.map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(';')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'werbebericht-' + b.partner.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-') + '.csv';
    document.body.append(a); a.click(); a.remove();
  };
}

const b = berichtLesen(location.hash.slice(1));
if (b) zeigen(b); else leer();
addEventListener('hashchange', () => { const x = berichtLesen(location.hash.slice(1)); if (x) zeigen(x); else leer(); });
