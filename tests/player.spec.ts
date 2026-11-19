// Player (release/player.html): läuft im Vollbild auf der Box.
import { test, expect, slideshowOeffnen, nurLinux, bereich, erwarteAufLeinwand, leinwandLeeren, uhrAnhalten, uhrVor } from './hilfen';

test.describe('Player', () => {
  test('startet mit Beispiel-Folien und zeigt den Hinweis auf die Einstellungen', async ({ page }) => {
    await page.goto('release/player.html');
    await expect(page.locator('#toast')).toContainText('Taste E');
    await erwarteAufLeinwand(page, 'Hausmann Immobilien');
    await erwarteAufLeinwand(page, '890 € kalt');
  });

  test('Einstellungen öffnen mit Taste E und schließen mit Escape', async ({ page }) => {
    await page.goto('release/player.html');
    const panel = page.locator('#panel');
    await page.keyboard.press('e');
    await expect(panel).toHaveClass(/open/);
    // Mittwoch 12 Uhr: Tag-Folien, nächster Wechsel um 17 Uhr.
    await expect(page.locator('#stWhat')).toContainText('Tag');
    await expect(page.locator('#stNext')).toContainText('17:00');
    await page.keyboard.press('Escape');
    await expect(panel).not.toHaveClass(/open/);
    await page.getByRole('button', { name: 'Einstellungen' }).click();
    await expect(panel).toHaveClass(/open/);
  });

  test('Branche wechseln, Preis ändern, Tageszeit simulieren', async ({ page }) => {
    await page.goto('release/player.html');
    await page.keyboard.press('e');
    await page.getByLabel('Branche').selectOption({ label: 'Gastro: Menütafel' });
    await erwarteAufLeinwand(page, 'Mittagstisch');
    const eintraege = page.getByLabel('Einträge');
    await expect(eintraege).toHaveValue(/Salame \| 8,90 €/);
    await eintraege.fill((await eintraege.inputValue()).replace('8,90 €', '6,66 €'));
    await leinwandLeeren(page);
    await page.locator('[data-sim="eve"]').click();
    await expect(page.locator('#stWhat')).toContainText('Abend');
    await erwarteAufLeinwand(page, 'Abendkarte');
    await erwarteAufLeinwand(page, '6,66 €');
    await page.locator('[data-sim="off"]').click();
    await expect(page.locator('#stWhat')).toContainText('Schwarzer Bildschirm');
    // Nach dem Neuladen ist alles noch da (läuft ohne Internet aus dem Browser-Speicher).
    await page.reload();
    await page.keyboard.press('e');
    await expect(page.getByLabel('Branche')).toHaveValue('gastro');
    await expect(page.getByLabel('Einträge')).toHaveValue(/Salame \| 6,66 €/);
  });

  test('Folien wechseln von selbst nach der eingestellten Zeit', async ({ page }) => {
    await page.goto('release/player.html');
    await page.keyboard.press('e');
    await page.getByLabel('Branche').selectOption({ label: 'Gastro: Menütafel' });
    await page.keyboard.press('Escape');
    await erwarteAufLeinwand(page, 'Mittagstisch');
    await leinwandLeeren(page);
    await page.clock.runFor(9_000);
    await erwarteAufLeinwand(page, 'MITTAGSDEAL');
  });

  test('Bildvergleich erste Folie', async ({ page }) => {
    nurLinux();
    await uhrAnhalten(page);
    await page.goto('release/player.html');
    await uhrVor(page, 7_000);
    await expect(page).toHaveScreenshot('player-makler.png');
  });
});

test.describe('Light: Paket per USB-Stick', () => {
  test('Paket aus dem Panel exportieren und im Player laden', async ({ page, context }) => {
    await page.goto('release/panel.html?demo');
    await slideshowOeffnen(page, 'Mittags- und Abendkarte');
    await page.getByLabel('Preis, Zeile 1').fill('4,44 €');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Für USB-Stick' }).click()]);
    expect(download.suggestedFilename()).toBe('showcube-paket.json');
    const datei = await download.path();

    const player = await context.newPage();
    await player.goto('release/player.html');
    await player.keyboard.press('e');
    await player.getByLabel('ShowCube-Paket laden').setInputFiles(datei);
    await expect(player.locator('#paketNote')).toContainText('geladen');
    await expect(player.getByLabel('Branche')).toHaveValue('gastro');
    await expect(player.getByLabel('Einträge')).toHaveValue(/4,44 €/);
    await erwarteAufLeinwand(player, '4,44 €');
  });
});
