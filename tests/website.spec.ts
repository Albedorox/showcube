// Website für Hostinger (scripts/website.mjs): Was auf stage.showcube.de und showcube.de hochgeladen wird.
// Geprüft wird der fertig zusammengestellte Ordner, so wie ihn die Workflows „Stage aktualisieren“ und „Live schalten“ hochladen.
import { test, expect } from './hilfen';
// @ts-ignore: reines JavaScript-Modul ohne Typen
import { zusammenstellen } from './website-hilfe.mjs';

const STAND = '0123456789abcdef0123456789abcdef01234567';
type Website = { dateien: string[]; lesen(n: string): Promise<string>; gibtEs(n: string): boolean; adresse: string; original(n: string): Promise<string> };
const bauen = (umgebung: 'stage' | 'prod', ordner: string): Promise<Website> => zusammenstellen(umgebung, ordner, STAND);

test.describe('Website für Hostinger', () => {
  test('Prod enthält nur, was online gehört', async ({}, info) => {
    const w = await bauen('prod', info.outputPath('prod'));
    const dateien = w.dateien;
    for (const muss of ['index.html', 'sitemap.xml', 'robots.txt', '.htaccess', 'version.txt', 'release/panel.html',
      'release/player.html', 'release/designer.html', 'release/bericht.html', 'release/konfigurator.html', 'release/sw.js',
      'release/box-einrichten.sh', 'assets/og.png', 'pwa/icon.svg']) expect(dateien, muss).toContain(muss);
    // Kein Quellcode, keine Tests, keine Gehäuse-Dateien, keine Doku, kein Backend.
    for (const d of dateien) expect(d, d).toMatch(/^(index\.html|sitemap\.xml|robots\.txt|\.htaccess|version\.txt|assets\/|release\/|pwa\/icon\.svg$)/);
    expect(dateien.some(d => /\.(stl|step|3mf|ts|toml|sql)$/.test(d))).toBe(false);

    expect(await w.lesen('version.txt')).toBe(STAND + '\n');
    expect(await w.lesen('robots.txt')).toContain('Sitemap: https://showcube.de/sitemap.xml');
    const htaccess = await w.lesen('.htaccess');
    expect(htaccess).toContain('RewriteRule ^stage(/|$) - [R=404,L]');
    expect(htaccess, 'keine eigene HTTPS-Umleitung (Schleife hinter dem CDN)').not.toContain('%{HTTPS}');
    expect(htaccess).not.toContain('noindex');
    const index = await w.lesen('index.html');
    expect(index).toBe(await w.original('index.html'));
    expect(index).toContain('<link rel="canonical" href="https://showcube.de/">');
  });

  test('Stage ist für Suchmaschinen gesperrt und zeigt das Stage-Schild', async ({ page }, info) => {
    const w = await bauen('stage', info.outputPath('stage'));
    expect(await w.lesen('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
    expect(await w.lesen('.htaccess')).toContain('X-Robots-Tag "noindex, nofollow"');

    // So, wie ein Besucher die Stage-Seite öffnet: Schild sichtbar, Seite sonst unverändert.
    await page.goto(w.adresse);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dein Fernseher wird zum');
    await expect(page.locator('#stage-schild')).toHaveText('Stage: Testumgebung');
    await expect(page.locator('meta[name="robots"]')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });

  test('jeder Link der Startseite führt auch im hochgeladenen Ordner zu einer Datei', async ({ page }, info) => {
    const w = await bauen('prod', info.outputPath('prod-links'));
    await page.goto(w.adresse);
    const ziele = await page.locator('a[href], link[href], img[src], script[src]').evaluateAll(els =>
      els.map(e => e.getAttribute('href') || e.getAttribute('src')).filter(u => u && !/^(#|mailto:|https?:)/.test(u)) as string[]);
    expect(ziele.length).toBeGreaterThan(5);
    for (const ziel of new Set(ziele)) expect(w.gibtEs(ziel.split(/[?#]/)[0]), ziel).toBe(true);
  });
});
