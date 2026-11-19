// Cloud-Panel (release/panel.html): Demo ohne Konto. Das echte Backend wird in Tests nie angesprochen.
import { test, expect, slideshowOeffnen, nurLinux, bereich, erwarteAufLeinwand, leinwandTexte, uhrAnhalten, uhrVor } from './hilfen';
import type { Page } from '@playwright/test';

const demo = async (page: Page) => {
  await page.goto('release/panel.html?demo');
  await expect(page.getByRole('heading', { name: 'Bildschirme', level: 1 })).toBeVisible();
};

test.describe('Panel: Start und Demo', () => {
  test('ohne Konto erscheint die Anmeldung mit „Demo ansehen“', async ({ page }) => {
    await page.goto('release/panel.html');
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anmelden' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Demo ansehen' }).click();
    await expect(page.locator('#demoBar')).toContainText('Nichts wird gespeichert');
    await expect(page.getByRole('heading', { name: 'Bildschirme', level: 1 })).toBeVisible();
  });

  test('Demo zeigt Beispiel-Betriebe und meldet den Ausfall', async ({ page }) => {
    await demo(page);
    await expect(page.getByText('3 von 4 Bildschirmen laufen, 1 ist offline.')).toBeVisible();
    await expect(page.getByText('„Fenster links“ bei Hausmann Immobilien ist offline')).toBeVisible();
    for (const n of ['Theke', 'Schaufenster', 'Fenster links', 'Eingang']) await expect(page.getByRole('heading', { name: n, level: 2 })).toBeVisible();
    await page.getByRole('button', { name: 'Hausmann Immobilien' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(1);
  });

  test('alle Bereiche lassen sich öffnen', async ({ page }) => {
    await demo(page);
    for (const [link, titel] of [['Inhalte', 'Inhalte'], ['Medien', 'Medien'], ['Vorlagen', 'Vorlagen'], ['Bildschirme', 'Bildschirme']]) {
      await bereich(page, link).click();
      await expect(page.getByRole('heading', { name: titel, level: 1 })).toBeVisible();
    }
  });

  test('Befehlsleiste mit Strg + K', async ({ page }) => {
    await demo(page);
    await page.keyboard.press('Control+k');
    const suche = page.locator('#cmdIn');
    await expect(suche).toBeVisible();
    await suche.fill('Inhalte');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Inhalte', level: 1 })).toBeVisible();
  });
});

test.describe('Panel: Inhalte', () => {
  test('Preis ändern, Entwurf sehen, veröffentlichen, im Verlauf zurückholen', async ({ page }) => {
    await demo(page);
    await slideshowOeffnen(page, 'Mittags- und Abendkarte');
    const preis = page.getByLabel('Preis, Zeile 2');
    await expect(preis).toHaveValue('8,90 €');
    await preis.fill('9,40 €');
    await expect(page.getByText('Entwurf', { exact: true })).toBeVisible();
    await expect(page.locator('.changes')).toContainText('1 Gericht geändert');
    await erwarteAufLeinwand(page, '9,40 €');
    await page.locator('.pub').getByRole('button', { name: /veröffentlichen/i }).click();
    await expect(page.locator('#toast')).toContainText('Veröffentlicht');
    await expect(page.locator('.pub').getByText('Veröffentlicht', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: /Verlauf/ }).click();
    await expect(page.locator('.hist li')).not.toHaveCount(0);
  });

  test('Gericht ausblenden und Zeile hinzufügen', async ({ page }) => {
    await demo(page);
    await slideshowOeffnen(page, 'Mittags- und Abendkarte');
    await page.getByRole('button', { name: 'Ausblenden: Salame' }).click();
    await expect(page.getByRole('button', { name: 'Wieder zeigen: Salame' })).toBeVisible();
    await expect(page.locator('.changes')).toContainText('ein- oder ausgeblendet');
    const zeilen = await page.locator('.rows .rw').count();
    await page.getByRole('button', { name: /hinzufügen/ }).first().click();
    await expect(page.locator('.rows .rw')).toHaveCount(zeilen + 1);
  });

  test('Zeitplan: Ruhetag setzen zeigt sich in der Zeitleiste', async ({ page }) => {
    await demo(page);
    await slideshowOeffnen(page, 'Mittags- und Abendkarte');
    await page.getByRole('tab', { name: 'Zeitplan' }).click();
    await expect(page.locator('.tl-bar')).toBeVisible();
    await page.getByLabel('Abend-Folien ab').fill('18:30');
    await page.getByLabel('Abend-Folien ab').blur();
    await expect(page.locator('.changes')).toContainText('Zeitplan');
    const mi = page.getByRole('button', { name: 'Mi ist Ruhetag' });
    await mi.click();
    await expect(page.getByRole('button', { name: 'Mi ist Ruhetag' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('An Ruhetagen bleibt der Bildschirm den ganzen Tag schwarz.')).toBeVisible();
  });
});

test.describe('Panel: Bildschirme', () => {
  test('Sofort-Hinweis auf alle Bildschirme und wieder beenden', async ({ page }) => {
    await demo(page);
    await page.getByRole('button', { name: 'Sofort-Hinweis' }).click();
    const dlg = page.locator('#dlgNotice');
    await expect(dlg).toBeVisible();
    await dlg.getByRole('button', { name: 'Gleich zurück' }).click();
    await dlg.getByRole('button', { name: 'Jetzt zeigen' }).click();
    await expect(page.locator('#toast')).toContainText('Hinweis läuft auf 4 Bildschirmen bis heute Nacht.');
    await erwarteAufLeinwand(page, 'Gleich zurück');
    await page.locator('#noticeStop').click();
    await expect(page.locator('#toast')).toContainText('beendet');
  });

  test('Live öffnen: Player im zweiten Tab bekommt veröffentlichte Preise sofort', async ({ page, context }) => {
    await demo(page);
    const [player] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: /Live öffnen/ }).first().click()]);
    await player.waitForLoadState();
    await expect(player).toHaveURL(/player\.html\?live=/);
    await erwarteAufLeinwand(player, 'Mittagstisch');
    await expect(page.locator('.card.scr').first()).not.toContainText('Live öffnen', { timeout: 10_000 });

    await slideshowOeffnen(page, 'Mittags- und Abendkarte');
    // Meldet sich der Player gerade, zeichnet das Panel neu. Darum Eingabe prüfen und notfalls wiederholen.
    await expect(async () => {
      await page.getByLabel('Preis, Zeile 1').fill('5,55 €');
      await expect(page.getByText('Entwurf', { exact: true })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
    await page.locator('.pub').getByRole('button', { name: /veröffentlichen/i }).click();
    await expect(page.locator('#toast')).toContainText('Veröffentlicht');
    // Der Player speichert das Paket (läuft danach auch offline) und zeigt den neuen Preis.
    await expect.poll(() => player.evaluate(() => Object.keys(localStorage).filter(k => k.includes('-live-')).map(k => localStorage.getItem(k)).join())).toContain('5,55 €');
    await expect.poll(async () => { if ((await leinwandTexte(player)).includes('5,55 €')) return true; await player.keyboard.press('ArrowRight'); return false; },
      { message: 'neuer Preis auf dem Player', timeout: 10_000, intervals: [300] }).toBe(true);
  });

  test('Fernwartung öffnet sich', async ({ page }) => {
    await demo(page);
    await page.getByRole('button', { name: 'Fernwartung' }).first().click();
    await expect(page.locator('#dlgScreen')).toBeVisible();
    await expect(page.locator('#dlgScreen')).toContainText('Theke');
  });

  test('Bildvergleich Bildschirme', async ({ page }) => {
    nurLinux();
    await uhrAnhalten(page);
    await page.goto('release/panel.html?demo');
    await uhrVor(page, 2_000);
    await expect(page).toHaveScreenshot('panel-bildschirme.png');
  });
});

test.describe('Panel auf dem Handy', () => {
  test('Demo und Inhalte bedienbar @handy', async ({ page }) => {
    await demo(page);
    const breite = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(breite[0], 'keine waagerechte Scrollleiste').toBeLessThanOrEqual(breite[1]);
    await page.goto('release/panel.html#shows');
    await expect(page.getByLabel('Preis, Zeile 2')).toBeVisible();
  });
});
