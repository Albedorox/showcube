// Startseite (index.html): Verkaufsseite für Interessenten.
import { test, expect, nurLinux, erwarteAufLeinwand, leinwandLeeren, uhrAnhalten, uhrVor } from './hilfen';

test.describe('Startseite', () => {
  test('zeigt die Texte, die bleiben sollen (siehe CLAUDE.md)', async ({ page }) => {
    await page.goto('./');
    await expect(page).toHaveTitle(/ShowCube/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Dein Fernseher wird zum');
    await expect(page.getByRole('heading', { name: 'Ein Bildschirm verkauft nur, wenn er aktuell ist' })).toBeVisible();
    // Vergleichskarten: oben „Bisher“, darunter „Mit ShowCube“, beides sichtbar.
    const karten = page.locator('#warum p.old');
    await expect(karten).toHaveCount(3);
    for (const k of await karten.all()) await expect(k.locator('b')).toHaveText('Bisher');
    await expect(page.locator('#warum .new')).toHaveText(['Mit ShowCube', 'Mit ShowCube', 'Mit ShowCube']);
  });

  test('alle Bereiche und Links im Menü sind da', async ({ page }) => {
    await page.goto('./');
    for (const id of ['warum', 'so-gehts', 'branchen', 'funktionen', 'preise', 'fragen', 'kontakt']) await expect(page.locator('#' + id)).toBeAttached();
    expect(await page.locator('#funktionen h3').count()).toBeGreaterThanOrEqual(10);
  });

  test('häufige Fragen: sichtbare Fragen und Google-Daten (JSON-LD) stimmen überein', async ({ page }) => {
    await page.goto('./');
    const sichtbar = (await page.locator('#fragen summary').allInnerTexts()).map(s => s.trim());
    const json = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
    const faq = (Array.isArray(json) ? json : json['@graph'] || [json]).find((x: any) => x['@type'] === 'FAQPage');
    expect(faq, 'FAQPage im JSON-LD').toBeTruthy();
    expect(faq.mainEntity.map((q: any) => q.name)).toEqual(sichtbar);
  });

  test('jeder Link auf eine Datei im Repo führt zu einer Seite, die es gibt', async ({ page, request }) => {
    await page.goto('./');
    const ziele = await page.locator('a[href], link[href], img[src], script[src]').evaluateAll(els =>
      els.map(e => e.getAttribute('href') || e.getAttribute('src')).filter(u => u && !/^(#|mailto:|https?:)/.test(u)));
    expect(ziele.length).toBeGreaterThan(5);
    for (const ziel of [...new Set(ziele)]) {
      const antwort = await request.get(ziel.split('#')[0]);
      expect(antwort.status(), ziel).toBe(200);
    }
  });

  test('der Fernseher zeigt echte Folien, das Handy ändert den Preis', async ({ page }) => {
    await page.goto('./');
    const tv = page.locator('.stage canvas.live');
    await expect(tv).toBeVisible();
    await erwarteAufLeinwand(page, 'Mittagstisch');
    await erwarteAufLeinwand(page, '8,90 €');
    const handy = page.locator('.stage .phone');
    await expect(handy).toHaveAttribute('data-st', /idle|tap|type/, { timeout: 10_000 });
    await expect(handy).toHaveAttribute('data-st', 'live', { timeout: 10_000 });
    await expect(handy.locator('li.hit b')).toHaveText('7,90 €');
    await leinwandLeeren(page);
    await erwarteAufLeinwand(page, '7,90 €');
    await expect(handy).toHaveAttribute('data-st', 'off', { timeout: 10_000 });
  });

  test('mit „Bewegung reduzieren“ wechseln die Folien trotzdem', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    await erwarteAufLeinwand(page, 'Mittagstisch');
    await erwarteAufLeinwand(page, 'MITTAGSDEAL', 20_000);
  });

  test('Bildvergleich oben (Desktop)', async ({ page }) => {
    nurLinux();
    await uhrAnhalten(page);
    await page.goto('./');
    await uhrVor(page, 3000);
    await expect(page).toHaveScreenshot('startseite-oben.png');
  });
});

test.describe('Startseite auf dem Handy', () => {
  test('passt in die Breite und zeigt den Fernseher @handy', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const breite = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    expect(breite[0], 'keine waagerechte Scrollleiste').toBeLessThanOrEqual(breite[1]);
    await erwarteAufLeinwand(page, 'Mittagstisch');
  });

  test('Bildvergleich oben @handy', async ({ page }) => {
    nurLinux();
    await uhrAnhalten(page);
    await page.goto('./');
    await uhrVor(page, 3000);
    await expect(page).toHaveScreenshot('startseite-oben-handy.png');
  });
});
