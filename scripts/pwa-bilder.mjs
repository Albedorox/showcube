// Erzeugt die App-Icons aus pwa/icon.svg und die Bildschirmfotos fürs Installieren in pwa/bilder/.
// Nur nötig, wenn sich Icon oder Panel sichtbar ändern: npm run build, dann node scripts/pwa-bilder.mjs, dann noch einmal npm run build.
// Nur das Logo geändert? node scripts/pwa-bilder.mjs --nur-icons
// Braucht Playwright mit Chromium.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const svg = await readFile(resolve(root, 'pwa/icon.svg'), 'utf8');
const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
// Das Logo in pwa/icon.svg hat schon runde Ecken.
// logo = Logo allein, Ecken transparent (Browser, Desktop, Favicon).
// flaeche = Logo mittig auf der hellen App-Farbe, vollflächig: maskable (Android-Homescreen und Startbild) und Apple.
// Die Fläche hat dieselbe Farbe wie background_color im Manifest, so zeigt Android beim Start nur das Logo.
const FLAECHE = '#f6f5f1';
const jobs = [
  ['icon-192.png', 192, 'logo', 1], ['icon-512.png', 512, 'logo', 1], ['favicon-32.png', 32, 'logo', 1],
  // maskable: Logo bei 60 %, damit es auch in der runden Maske (sichere Zone 80 %) ganz zu sehen ist.
  ['maskable-512.png', 512, 'flaeche', 0.6], ['apple-touch-icon.png', 180, 'flaeche', 0.7],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, kind, anteil] of jobs) {
  const bg = kind === 'flaeche' ? FLAECHE : 'transparent';
  const s = Math.round(size * anteil);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;background:${bg};display:grid;place-items:center"><img src="${uri}" style="width:${s}px;height:${s}px;display:block"></div></body></html>`);
  await page.locator('div').screenshot({ path: resolve(root, 'pwa/bilder', name), omitBackground: true });
}
// Mit --nur-icons bleiben die Bildschirmfotos, wie sie sind.
if (process.argv.includes('--nur-icons')) { await browser.close(); console.log('Icons fertig in pwa/bilder/'); process.exit(0); }
// Bildschirmfotos für den Installieren-Dialog (Android, Chrome) und später für die Stores.
const panel = 'file://' + resolve(root, 'release/panel.html');
const shots = [['screen-wide.png', '#screens', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ['screen-phone.png', '#shows', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]];
for (const [name, hash, opts] of shots) {
  const ctx = await browser.newContext({ ...opts, colorScheme: 'light', locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-11-13T12:30:00+01:00')); // mittags, damit die Bildschirme etwas zeigen
  await p.goto(panel + hash);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: resolve(root, 'pwa/bilder', name) });
  await ctx.close();
}
await browser.close();
console.log('Icons und Bildschirmfotos fertig in pwa/bilder/');
