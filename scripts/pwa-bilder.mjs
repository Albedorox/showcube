// Erzeugt die App-Icons aus pwa/icon.svg und die Bildschirmfotos fürs Installieren in pwa/bilder/.
// Nur nötig, wenn sich Icon oder Panel sichtbar ändern: npm run build, dann node scripts/pwa-bilder.mjs, dann noch einmal npm run build.
// Braucht Playwright mit Chromium.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const svg = await readFile(resolve(root, 'pwa/icon.svg'), 'utf8');
const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
// rund = für Browser und Desktop (transparente Ecken), voll = maskable, Apple und Stores
const jobs = [
  ['icon-192.png', 192, 'rund'], ['icon-512.png', 512, 'rund'],
  ['maskable-512.png', 512, 'voll'], ['apple-touch-icon.png', 180, 'voll'], ['favicon-32.png', 32, 'rund'],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, kind] of jobs) {
  const r = kind === 'rund' ? Math.round(size * 0.22) : 0;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img src="${uri}" style="width:${size}px;height:${size}px;display:block;border-radius:${r}px"></body></html>`);
  await page.locator('img').screenshot({ path: resolve(root, 'pwa/bilder', name), omitBackground: true });
}
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
