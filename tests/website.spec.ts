// Website für Hostinger (scripts/website.mjs): Was auf stage.showcube.de und showcube.de hochgeladen wird.
// Geprüft wird der fertig zusammengestellte Ordner, so wie ihn die Workflows „Stage aktualisieren“ und „Live schalten“ hochladen.
import { test, expect, nurLinux } from './hilfen';
// @ts-ignore: reines JavaScript-Modul ohne Typen
import { zusammenstellen, prodSeite } from './website-hilfe.mjs';

const STAND = '0123456789abcdef0123456789abcdef01234567';
type Website = { dateien: string[]; lesen(n: string): Promise<string>; gibtEs(n: string): boolean; adresse: string; original(n: string): Promise<string> };
type Seite = 'bald' | 'startseite';
const bauen = (umgebung: 'stage' | 'prod', ordner: string, seite?: Seite): Promise<Website> => zusammenstellen(umgebung, ordner, STAND, seite);

test.describe('Website für Hostinger', () => {
  test('Prod enthält nur, was online gehört', async ({}, info) => {
    const w = await bauen('prod', info.outputPath('prod'), 'startseite');
    const dateien = w.dateien;
    for (const muss of ['index.html', 'sitemap.xml', 'robots.txt', '.htaccess', 'version.txt', 'release/panel.html',
      'release/player.html', 'release/designer.html', 'release/bericht.html', 'release/konfigurator.html', 'release/sw.js',
      'release/box-einrichten.sh', 'assets/og.png', 'pwa/icon.svg',
      'impressum.html', 'datenschutz.html', 'kontakt.html', 'kontakt.php', 'assets/seiten.css']) expect(dateien, muss).toContain(muss);
    // Kein Quellcode, keine Tests, keine Gehäuse-Dateien, keine Doku, kein Backend.
    for (const d of dateien) expect(d, d).toMatch(/^(index\.html|sitemap\.xml|robots\.txt|\.htaccess|version\.txt|assets\/|release\/|pwa\/icon\.svg$|impressum\.html$|datenschutz\.html$|kontakt\.(html|php)$)/);
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

    // Vorschau der Vorschaltseite unter /bald/, mit Schriften und Logo aus dem Hauptordner.
    expect(w.dateien).toContain('bald/index.html');
    await page.goto(w.adresse + 'bald/');
    await expect(page.getByRole('img', { name: 'ShowCube Logo' })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 20px "Bricolage Grotesque"'))).toBe(true);
  });

  test('jeder Link der Startseite führt auch im hochgeladenen Ordner zu einer Datei', async ({ page }, info) => {
    const w = await bauen('prod', info.outputPath('prod-links'), 'startseite');
    await page.goto(w.adresse);
    const ziele = await page.locator('a[href], link[href], img[src], script[src]').evaluateAll(els =>
      els.map(e => e.getAttribute('href') || e.getAttribute('src')).filter(u => u && !/^(#|mailto:|https?:)/.test(u)) as string[]);
    expect(ziele.length).toBeGreaterThan(5);
    for (const ziel of new Set(ziele)) expect(w.gibtEs(ziel.split(/[?#]/)[0]), ziel).toBe(true);
  });
});

// Vorschaltseite „Bald da“ (bald/index.html): läuft auf showcube.de, solange website.json "bald" sagt.
test.describe('Vorschaltseite Bald da', () => {
  test('website.json sagt, was auf showcube.de läuft', async () => {
    expect(['bald', 'startseite']).toContain(await prodSeite());
  });

  test('showcube.de zeigt Logo, Teaser und Kontakt, die Apps bleiben erreichbar', async ({ page, request }, info) => {
    const w = await bauen('prod', info.outputPath('bald'), 'bald');
    expect(await w.lesen('index.html')).toBe(await w.original('bald/index.html'));
    expect(w.dateien, 'keine Sitemap, solange nur die Vorschaltseite läuft').not.toContain('sitemap.xml');
    expect(await w.lesen('robots.txt')).not.toContain('Sitemap');
    expect(w.dateien).toContain('release/box-einrichten.sh');
    expect(w.dateien).not.toContain('bald/index.html');

    await page.goto(w.adresse);
    await expect(page).toHaveTitle(/ShowCube: Bald da/);
    const logo = page.getByRole('img', { name: 'ShowCube Logo' });
    await expect(logo).toBeVisible();
    // Das Logo steht waagerecht in der Mitte.
    const box = (await logo.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(2);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dein Fernseher wird zum besten Verkäufer.');
    await expect(page.getByText('Bald da', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Schreib uns' })).toHaveAttribute('href', 'kontakt.html?thema=testbox');
    await expect(page.getByRole('link', { name: 'hallo@showcube.de' })).toHaveAttribute('href', 'mailto:hallo@showcube.de');
    // Impressum und Datenschutz sind verlinkt und liegen im Ordner.
    for (const [name, ziel] of [['Impressum', 'impressum.html'], ['Datenschutz', 'datenschutz.html']]) {
      await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', ziel);
      expect(w.gibtEs(ziel), ziel).toBe(true);
    }
    // Schriften und Icons kommen aus dem Ordner selbst, nicht aus dem Netz.
    await expect.poll(() => page.evaluate(() => document.fonts.check('700 20px "Bricolage Grotesque"'))).toBe(true);
    for (const ziel of await page.locator('link[href]').evaluateAll(els => els.map(e => e.getAttribute('href')!).filter(u => !/^https?:/.test(u)))) {
      expect((await request.get(w.adresse + ziel)).status(), ziel).toBe(200);
    }
  });

  test('Bildvergleich', async ({ page }, info) => {
    nurLinux();
    const w = await bauen('prod', info.outputPath('bald-bild'), 'bald');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(w.adresse);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('bald.png');
  });

  test('passt aufs Handy @handy', async ({ page }, info) => {
    const w = await bauen('prod', info.outputPath('bald-handy'), 'bald');
    await page.goto(w.adresse);
    await expect(page.getByRole('img', { name: 'ShowCube Logo' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Schreib uns' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});
