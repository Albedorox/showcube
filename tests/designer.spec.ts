// Vorlagen-Designer (release/designer.html): Marke und eigene animierte Vorlagen.
import { test, expect, nurLinux, erwarteAufLeinwand, uhrAnhalten, uhrVor } from './hilfen';
import type { Page } from '@playwright/test';

const vorlagen = async (page: Page) => {
  await page.goto('release/designer.html');
  await page.getByRole('tab', { name: 'Vorlagen' }).click();
  await expect(page.getByText('Zeitleiste und Ebenen')).toBeVisible();
};
const balken = (page: Page) => page.locator('.zr b[role="slider"]');

test.describe('Vorlagen-Designer', () => {
  test('Marke: Name und Farben wirken sofort auf alle Vorlagen', async ({ page }) => {
    await page.goto('release/designer.html');
    await erwarteAufLeinwand(page, 'CAFÉ MORGENROT');
    await page.getByLabel('Name auf den Folien').fill('Bäckerei Sonne');
    await erwarteAufLeinwand(page, 'BÄCKEREI SONNE');
    const haupt = page.getByLabel('Hauptfarbe als Hex');
    const vorher = await haupt.inputValue();
    await page.getByRole('button', { name: /^Farbset / }).nth(1).click();
    await expect(page.getByLabel('Hauptfarbe als Hex')).not.toHaveValue(vorher);
    // Eigene Farbe als Hex eintragen
    await page.getByLabel('Hauptfarbe als Hex').fill('#123456');
    await page.getByLabel('Hauptfarbe als Hex').press('Enter');
    await expect(page.getByLabel('Hauptfarbe als Hex')).toHaveValue('#123456');
  });

  test('Zeitleiste: Balken ziehen verschiebt den Start der Animation', async ({ page }) => {
    await vorlagen(page);
    const b = balken(page).first();
    const vorher = await b.getAttribute('aria-valuetext');
    const box = await b.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(balken(page).first()).not.toHaveAttribute('aria-valuetext', vorher);
    const [start] = (await balken(page).first().getAttribute('aria-valuetext')).match(/[\d,]+/);
    expect(parseFloat(start.replace(',', '.'))).toBeGreaterThan(parseFloat(vorher.match(/[\d,]+/)[0].replace(',', '.')));
  });

  test('Zeitleiste: mit der Tastatur um 0,1 s verschieben', async ({ page }) => {
    await vorlagen(page);
    await balken(page).first().focus();
    const vorher = Number(await balken(page).first().getAttribute('aria-valuenow'));
    await page.keyboard.press('ArrowRight');
    await expect(balken(page).first()).toHaveAttribute('aria-valuenow', String(Math.round((vorher + 0.1) * 10) / 10));
  });

  test('Ebenen: am Griff ziehen ändert die Reihenfolge', async ({ page }) => {
    await vorlagen(page);
    const zeilen = page.locator('.zr[data-ebene]');
    const reihenfolge = () => zeilen.evaluateAll(z => z.map(x => x.getAttribute('data-ebene')));
    const vorher = await reihenfolge();
    const griff = await zeilen.nth(0).locator('.griff').boundingBox();
    const ziel = await zeilen.nth(2).boundingBox();
    await page.mouse.move(griff.x + griff.width / 2, griff.y + griff.height / 2);
    await page.mouse.down();
    await page.mouse.move(griff.x + griff.width / 2, ziel.y + ziel.height / 2 + 4, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText('Ebene 1 liegt jetzt auf Position 3.')).toBeVisible();
    const nachher = await reihenfolge();
    expect(nachher[2]).toBe(vorher[0]);
    expect(nachher.slice().sort()).toEqual(vorher.slice().sort());
  });

  test('neue Vorlage aus einem Startpunkt anlegen', async ({ page }) => {
    await vorlagen(page);
    const liste = page.locator('.vitem');
    const n = await liste.count();
    await page.locator('.starter button', { hasText: 'Willkommen' }).click();
    await expect(liste).toHaveCount(n + 1);
    await expect(liste.last()).toHaveAttribute('aria-current', 'true');
  });

  test('„Für Agenturen“ erklärt die Arbeit mit mehreren Kunden', async ({ page }) => {
    await page.goto('release/designer.html');
    await page.getByRole('tab', { name: 'Für Agenturen' }).click();
    await expect(page.getByText('„Ins Panel übernehmen“ oder das Markenpaket als Datei schicken.', { exact: false })).toBeVisible();
  });

  test('Ins Panel übernehmen: Panel öffnet sich mit der Marke', async ({ page, context }) => {
    await page.goto('release/designer.html');
    await page.getByLabel('Name auf den Folien').fill('Bäckerei Sonne');
    const [panel] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Ins Panel übernehmen' }).click()]);
    await panel.waitForLoadState();
    await expect(panel.locator('#toast')).toContainText('Marke „Bäckerei Sonne“ aus dem Designer übernommen.');
    await expect(panel.getByRole('heading', { name: 'Vorlagen', level: 1 })).toBeVisible();
  });

  test('Bildvergleich Marke', async ({ page }) => {
    nurLinux();
    await uhrAnhalten(page);
    await page.goto('release/designer.html');
    await uhrVor(page, 3_000);
    await expect(page).toHaveScreenshot('designer-marke.png');
  });
});

test.describe('Vorlagen-Designer auf dem Handy', () => {
  test('Vorlagen und Zeitleiste erreichbar @handy', async ({ page }) => {
    await page.goto('release/designer.html');
    await page.getByRole('tab', { name: 'Vorlagen' }).click();
    await expect(page.getByText('Zeitleiste und Ebenen')).toBeVisible();
    const breite = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(breite[0], 'keine waagerechte Scrollleiste').toBeLessThanOrEqual(breite[1]);
  });
});
