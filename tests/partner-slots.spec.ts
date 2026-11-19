// Partner-Slots: Sendezeit an Werbepartner vermieten, Bericht-Link ohne Login (release/bericht.html).
import { test, expect, nurLinux, bereich, erwarteAufLeinwand, leinwandTexte, uhrAnhalten, uhrVor } from './hilfen';
import type { Page } from '@playwright/test';

async function partnerAn(page: Page) {
  await page.goto('release/panel.html?demo');
  await expect(bereich(page, 'Partner')).toHaveCount(0);
  await page.locator('#settings').click();
  await page.getByLabel(/Partner-Slots: Dein Bildschirm verdient mit/).check();
  await expect(page.locator('#toast')).toContainText('Partner-Slots sind an.');
  await expect(page.getByRole('heading', { name: 'Werbepartner', level: 1 })).toBeVisible();
}

test.describe('Partner-Slots', () => {
  test('standardmäßig aus, in den Einstellungen einschalten zeigt „Partner“', async ({ page }) => {
    await partnerAn(page);
    await expect(bereich(page, 'Partner')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Blumen Berger', level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Fahrschule Ost', level: 2 })).toBeVisible();
    // Wieder ausschalten: der Bereich verschwindet.
    await page.locator('#settings').click();
    await page.getByLabel(/Partner-Slots: Dein Bildschirm verdient mit/).uncheck();
    await expect(page.locator('#toast')).toContainText('Partner-Slots sind aus.');
    await expect(bereich(page, 'Partner')).toHaveCount(0);
  });

  test('Partner pausieren und wieder einschalten', async ({ page }) => {
    await partnerAn(page);
    await page.getByRole('button', { name: 'Pausieren: Fahrschule Ost' }).click();
    await expect(page.getByRole('button', { name: 'Einschalten: Fahrschule Ost' })).toBeVisible();
    await page.getByRole('button', { name: 'Einschalten: Fahrschule Ost' }).click();
    await expect(page.getByRole('button', { name: 'Pausieren: Fahrschule Ost' })).toBeVisible();
  });

  test('neuen Partner anlegen', async ({ page }) => {
    await partnerAn(page);
    await page.getByRole('button', { name: 'Partner hinzufügen' }).click();
    const dlg = page.locator('#dlgWerbung');
    await expect(dlg).toBeVisible();
    await dlg.locator('input[type="text"]').first().fill('Eiscafé Venezia');
    await dlg.getByRole('button', { name: 'Partner anlegen' }).click();
    await expect(page.getByRole('heading', { name: 'Eiscafé Venezia', level: 2 })).toBeVisible();
  });

  test('Bericht ansehen: öffnet ohne Login mit den Zahlen des Partners', async ({ page, context }) => {
    await partnerAn(page);
    const karte = page.locator('.wcard', { has: page.getByRole('heading', { name: 'Blumen Berger' }) });
    const [bericht] = await Promise.all([context.waitForEvent('page'), karte.getByRole('link', { name: /Ansehen/ }).click()]);
    await bericht.waitForLoadState();
    await expect(bericht).toHaveURL(/bericht\.html#/);
    await expect(bericht.getByRole('heading', { name: 'Blumen Berger', level: 1 })).toBeVisible();
    await expect(bericht.getByText('Deine Anzeige auf den Bildschirmen von')).toBeVisible();
    await expect(bericht.getByText('Beispielwerte')).toBeVisible();
    await expect(bericht).toHaveTitle(/Werbebericht Blumen Berger/);
  });

  test('Bericht-Link kopieren liefert einen Link, der funktioniert', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await partnerAn(page);
    await page.locator('.wcard', { has: page.getByRole('heading', { name: 'Fahrschule Ost' }) }).getByRole('button', { name: 'Bericht-Link' }).click();
    await expect(page.locator('#toast')).toContainText('Bericht-Link für Fahrschule Ost kopiert.');
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/bericht\.html#/);
    const neu = await context.newPage();
    await neu.goto(link);
    await expect(neu.getByRole('heading', { name: 'Fahrschule Ost', level: 1 })).toBeVisible();
  });

  test('kaputter Bericht-Link zeigt einen verständlichen Hinweis', async ({ page }) => {
    await page.goto('release/bericht.html#kaputt');
    await expect(page.getByText('Dieser Bericht-Link ist unvollständig.')).toBeVisible();
  });

  test('Live-Player mischt die Partner-Anzeige zwischen die Folien', async ({ page, context }) => {
    await partnerAn(page);
    await bereich(page, 'Bildschirme').click();
    const [player] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /Live öffnen/ }).first().click()]);
    await erwarteAufLeinwand(player, 'Mittagstisch');
    await expect.poll(async () => { const t = (await leinwandTexte(player)).join(' '); if (/Frische Tulpen|Führerschein|Werbeplatz/.test(t)) return true; await player.keyboard.press('ArrowRight'); return false; },
      { message: 'Partner-Folie läuft im Player', timeout: 15_000, intervals: [250] }).toBe(true);
  });

  test('Bildvergleich Partner-Bereich', async ({ page }) => {
    nurLinux();
    await uhrAnhalten(page);
    await page.goto('release/panel.html?demo');
    await uhrVor(page, 500);
    await page.locator('#settings').click();
    await page.getByLabel(/Partner-Slots: Dein Bildschirm verdient mit/).check();
    await page.locator('#toast').evaluate(e => e.remove());
    await uhrVor(page, 1_500);
    await expect(page).toHaveScreenshot('partner-uebersicht.png');
  });
});
