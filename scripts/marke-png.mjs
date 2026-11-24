// Macht aus den Logo-SVGs in docs/brand/logo/ PNG-Dateien für Programme ohne SVG (Word, Canva, Mail-Signatur).
// Zeichen: 512 und 1024 px, Logos: 1200 px breit, durchsichtiger Hintergrund. Braucht Playwright.
// Aufruf: node scripts/marke-png.mjs   (vorher bei Bedarf python3 scripts/marke-logos.py)
import { chromium } from '@playwright/test';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ordner = resolve(import.meta.dirname, '../docs/brand/logo');
await mkdir(resolve(ordner, 'png'), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const datei of (await readdir(ordner)).filter(f => f.endsWith('.svg'))) {
  const svg = await readFile(resolve(ordner, datei), 'utf8');
  const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  const breiten = datei.includes('zeichen') ? [512, 1024] : [1200];
  for (const breite of breiten) {
    const hoehe = Math.round(breite * h / w);
    await page.setViewportSize({ width: breite, height: hoehe });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${breite}px;height:${hoehe}px}</style>${svg}`);
    const name = datei.replace('.svg', datei.includes('zeichen') ? `-${breite}.png` : '.png');
    await page.screenshot({ path: resolve(ordner, 'png', name), omitBackground: true });
    console.log('png/' + name);
  }
}
await browser.close();
