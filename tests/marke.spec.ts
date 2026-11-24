// Brand-Guidelines und CI-Mappe (docs/brand/): Die Mappe lädt, Logos und Farben passen zu dem, was die Apps zeigen.
import { test, expect } from './hilfen';

const MAPPE = './docs/brand/ci-mappe.html';

/** Liest die Farbe einer CSS-Variablen aus dem ersten :root-Block (heller Modus) einer Datei im Repo. */
async function variable(request: import('@playwright/test').APIRequestContext, datei: string, name: string) {
  const text = await (await request.get(datei)).text();
  const root = text.match(/:root\s*\{([^}]*)\}/)![1];
  return root.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1].toLowerCase();
}

test.describe('CI-Mappe', () => {
  test('öffnet mit allen Logos, Schriften und Abschnitten', async ({ page }) => {
    await page.goto(MAPPE);
    await expect(page).toHaveTitle('ShowCube CI-Mappe');
    for (const name of ['Dein Fernseher wird zum besten Verkäufer.', 'Der Würfel ist Box und Bildschirm zugleich.',
      'Ruhiges Grün, warmes Papier.', 'Zwei Schriften, beide frei.', 'Runde Ecken, wie beim Würfel.',
      'Echte Läden, echte Folien.', 'Wie ein freundlicher Profi am Tresen.', 'Alles zum Herunterladen.'])
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    // Jedes Logo-Bild ist wirklich geladen (Datei vorhanden, gültiges SVG).
    const bilder = page.locator('img');
    await expect.poll(() => bilder.evaluateAll((l: HTMLImageElement[]) => l.filter(i => !(i.complete && i.naturalWidth > 0)).map(i => i.src)))
      .toEqual([]);
    expect(await bilder.count()).toBeGreaterThan(15);
    // Schriften kommen aus dem Repo, nicht von Google.
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('800 40px "Bricolage Grotesque"') && document.fonts.check('400 17px Figtree'))).toBe(true);
  });

  test('alle Download-Links finden ihre Datei', async ({ page, request }) => {
    await page.goto(MAPPE);
    const links = await page.locator('#dateien a[href], .unterschrift a[href]').evaluateAll((l: HTMLAnchorElement[]) => [...new Set(l.map(a => a.href))]);
    expect(links.length).toBeGreaterThan(20);
    for (const href of links) expect((await request.get(href)).status(), href).toBe(200);
  });

  test('Farben in der Mappe sind die Farben der Apps', async ({ page, request }) => {
    await page.goto(MAPPE);
    const mappe = await page.locator('.farbe[data-hex]').evaluateAll((l: HTMLElement[]) => l.map(e => e.dataset.hex!));
    const erwartet: [string, string][] = [
      ['index.html', 'accent'], ['index.html', 'mint'], ['index.html', 'deep'], ['index.html', 'bg'], ['index.html', 'ink'], ['index.html', 'line'],
      ['panel/index.html', 'accent'], ['panel/index.html', 'accent-hover'], ['panel/index.html', 'accent-soft'], ['panel/index.html', 'bg'],
      ['bald/index.html', 'bg'], ['bald/index.html', 'bg-2'], ['bald/index.html', 'mint'], ['bald/index.html', 'muted'],
    ];
    for (const [datei, name] of erwartet) {
      const wert = await variable(request, datei, name);
      expect(wert, `${datei} --${name}`).toBeTruthy();
      expect(mappe, `${datei} --${name} = ${wert} steht in der CI-Mappe`).toContain(wert);
    }
  });

  test('das Logo hat die Proportionen des Würfels auf der Startseite', async ({ page, request }) => {
    await page.goto('./');
    const cube = await page.locator('.top .cube').evaluate(e => {
      const s = getComputedStyle(e), i = getComputedStyle(e, '::after');
      const w = parseFloat(s.width);
      return { ecke: parseFloat(s.borderTopLeftRadius) / w, innen: parseFloat(i.width) / w, farbe: s.backgroundColor };
    });
    const svg = await (await request.get('./docs/brand/logo/showcube-zeichen.svg')).text();
    const rects = [...svg.matchAll(/<rect ([^>]*)\/>/g)].map(m => m[1]);
    const zahl = (r: string, a: string) => Number(r.match(new RegExp(`${a}="([\\d.]+)"`))![1]);
    const aussen = rects.find(r => zahl(r, 'width') === 100 && zahl(r, 'height') === 100 && r.includes('fill="#0b7a67"'))!;
    const innen = rects.find(r => r.includes('fill="#ffffff"'))!;
    expect(Math.abs(zahl(aussen, 'rx') / 100 - cube.ecke), 'Ecken wie auf der Startseite').toBeLessThan(0.02);
    expect(Math.abs(zahl(innen, 'width') / 100 - cube.innen), 'Innenquadrat wie auf der Startseite').toBeLessThan(0.02);
    expect(zahl(innen, 'x') + zahl(innen, 'width') / 2, 'Innenquadrat mittig').toBeCloseTo(50, 1);
    expect(cube.farbe).toBe('rgb(11, 122, 103)');
  });

  test('Klick auf einen Farbwert kopiert ihn', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(MAPPE);
    await page.locator('.farbe[data-hex="#0b7a67"] button').click();
    await expect(page.getByRole('status')).toHaveText('#0b7a67 kopiert');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#0b7a67');
  });

  test('Handy-Ansicht ohne waagerechtes Scrollen @handy', async ({ page }) => {
    await page.goto(MAPPE);
    await expect(page.getByRole('heading', { name: 'Corporate Identity' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
