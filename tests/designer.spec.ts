// Vorlagen-Designer (release/designer.html): Marke und eigene animierte Vorlagen.
import { test, expect, nurLinux, erwarteAufLeinwand, slideshowOeffnen, uhrAnhalten, uhrVor } from './hilfen';
import type { Page } from '@playwright/test';

const vorlagen = async (page: Page) => {
  await page.goto('release/designer.html');
  await page.getByRole('tab', { name: 'Vorlagen' }).click();
  await expect(page.getByText('Zeitleiste und Ebenen')).toBeVisible();
};
const balken = (page: Page) => page.locator('.zr b[role="slider"]');
// Ein Punkt auf der Bühne, in Prozent der Folie (wie Lage und Größe im Designer).
const aufFolie = async (page: Page, x: number, y: number) => { const r = await page.locator('.rahmen').boundingBox(); return { x: r.x + r.width * x / 100, y: r.y + r.height * y / 100 }; };
const klickAufFolie = async (page: Page, x: number, y: number, taste?: 'Shift' | 'Control') => {
  const p = await aufFolie(page, x, y);
  if (taste) await page.keyboard.down(taste);
  await page.mouse.click(p.x, p.y);
  if (taste) await page.keyboard.up(taste);
};
// Farbe eines Bildpunkts der Bühne (Prozent der Folie).
const bildpunkt = (page: Page, x: number, y: number) => page.locator('.rahmen canvas').evaluate((c: HTMLCanvasElement, [x, y]) => Array.from(c.getContext('2d').getImageData(Math.round(c.width * x / 100), Math.round(c.height * y / 100), 1, 1).data.slice(0, 3)), [x, y]);
const nahAn = (rgb: number[], hex: string) => { const z = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return rgb.every((v, i) => Math.abs(v - z[i]) < 12); };
// Gespeicherter Stand der ersten Vorlage von Café Morgenrot („Angebot groß“).
const ersteVorlage = (page: Page) => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('showcube-designer-v1') || 'null'); return s && s.kunden[s.aktiv].vorlagen[0]; });

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

  test('Text hinterlegen: Farbfläche in der Hauptfarbe hinter jeder Zeile', async ({ page }) => {
    await vorlagen(page);
    // „Hausgemachter Apfelkuchen“ liegt bei X 6 %, Y 27 %. Links oben im Feld ist vorher der dunkle Hintergrund.
    await klickAufFolie(page, 20, 40);
    await expect(page.locator('.eig h3', { hasText: 'Text' })).toBeVisible();
    await expect.poll(async () => nahAn(await bildpunkt(page, 6.4, 28), '#2a1a12'), { message: 'vorher dunkler Hintergrund' }).toBe(true);
    // Nur die Farben der Marke, keine freie Farbe.
    const hinterlegt = page.locator('.farbwahl', { hasText: 'Hinterlegt' });
    await expect(hinterlegt.getByRole('button')).toHaveCount(5);
    await expect(hinterlegt.getByText('Eigene Farbe')).toHaveCount(0);
    await page.getByRole('button', { name: 'Hinterlegt: Hauptfarbe' }).click();
    await expect(page.getByRole('button', { name: 'Hinterlegt: Hauptfarbe' })).toHaveAttribute('aria-pressed', 'true');
    await expect(hinterlegt).toContainText('Hinterlegt: Hauptfarbe');
    await expect.poll(async () => nahAn(await bildpunkt(page, 6.4, 28), '#c2410c'), { message: 'Farbfläche in der Hauptfarbe' }).toBe(true);
    await expect.poll(async () => (await ersteVorlage(page))?.quer[2].hinterlegt).toBe('primaer');
    // Wieder ohne Farbfläche.
    await page.getByRole('button', { name: 'Hinterlegt: ohne Farbfläche' }).click();
    await expect.poll(async () => nahAn(await bildpunkt(page, 6.4, 28), '#2a1a12')).toBe(true);
  });

  test('Hinterlegt in Schriftfarbe: die Schrift wird lesbar umgestellt', async ({ page }) => {
    await vorlagen(page);
    await klickAufFolie(page, 20, 40);
    await page.getByRole('button', { name: 'Schriftfarbe: Hauptfarbe' }).click();
    await page.getByRole('button', { name: 'Hinterlegt: Hauptfarbe' }).click();
    await expect(page.locator('.farbwahl', { hasText: 'Schriftfarbe' })).toContainText('Schriftfarbe: Hell');
  });

  test('„Eigene Farbe“ ist ein beschrifteter Knopf und setzt eine freie Farbe', async ({ page }) => {
    await vorlagen(page);
    await klickAufFolie(page, 20, 40);
    const schrift = page.locator('.farbwahl', { hasText: 'Schriftfarbe' });
    await expect(schrift.locator('label.eigen')).toBeVisible();
    await expect(schrift.locator('label.eigen')).toHaveText('Eigene Farbe');
    await expect(schrift).toContainText('Schriftfarbe: Hell');
    await page.getByLabel('Schriftfarbe: eigene Farbe wählen').fill('#00aa44');
    await expect(schrift).toContainText('Schriftfarbe: Eigene Farbe #00aa44');
    await expect(schrift.locator('label.eigen')).toHaveAttribute('aria-pressed', 'true');
    // Auch bei Fläche und QR-Code steht der Knopf beschriftet da.
    await page.locator('.werkzeuge').getByRole('button', { name: 'Fläche', exact: true }).click();
    await expect(page.locator('.farbwahl', { hasText: 'Füllfarbe' }).locator('label.eigen')).toHaveText('Eigene Farbe');
    await page.locator('.werkzeuge').getByRole('button', { name: 'QR', exact: true }).click();
    await expect(page.locator('.eig label.eigen')).toHaveCount(2);
  });

  test('Lage und Größe: X, Y, Breite und Höhe sind bei jedem Element beschriftet', async ({ page }) => {
    await vorlagen(page);
    for (const art of ['Text', 'Fläche', 'Kreis', 'Bild', 'Video', 'Logo', 'QR']) {
      await page.locator('.werkzeuge').getByRole('button', { name: art, exact: true }).click();
      const lage = page.locator('.eig .lage');
      await expect(lage, art).toContainText('Position');
      await expect(lage, art).toContainText('Größe');
      for (const [kurz, lang] of [['X', 'X (Abstand von links in %)'], ['Y', 'Y (Abstand von oben in %)'], ['Breite', 'Breite in %'], ['Höhe', 'Höhe in %']]) {
        await expect(lage.locator('.pfeld b', { hasText: new RegExp('^' + kurz + '$') }), art + ': ' + kurz).toBeVisible();
        await expect(page.getByLabel(lang, { exact: true }), art + ': ' + lang).toBeVisible();
      }
    }
    // X eintragen verschiebt das Element.
    await page.getByLabel('X (Abstand von links in %)', { exact: true }).fill('12');
    await page.getByLabel('X (Abstand von links in %)', { exact: true }).press('Enter');
    await expect(page.locator('.rahmen .sel')).toHaveAttribute('style', /left: 12%/);
  });

  test('Mehrfachauswahl: Kreis und Preis mit Umschalt wählen und zusammen verschieben', async ({ page }) => {
    await vorlagen(page);
    await klickAufFolie(page, 76, 22);   // Kreis außerhalb des Preises
    await expect(page.locator('.eig h3', { hasText: 'Fläche' })).toBeVisible();
    await klickAufFolie(page, 76, 50, 'Shift');   // Preis dazu
    await expect(page.locator('.eig h3', { hasText: '2 Elemente ausgewählt' })).toBeVisible();
    await expect(page.locator('.eig .chip')).toHaveText(['Kreis', 'Text: 3,80 €']);
    await expect(page.locator('.zr[aria-current="true"]')).toHaveCount(2);
    await expect(page.locator('.rahmen .gruppe-sel')).toBeVisible();

    const finde = (v: any) => !v ? { kreis: {} as any, preis: {} as any, titel: {} as any } : ({ kreis: v.quer.find((e: any) => e.form === 'kreis'), preis: v.quer.find((e: any) => e.text === '3,80 €'), titel: v.quer[2] });
    // Lage im Startpunkt „Angebot groß“ (shared/design.ts) und in der Gruppe rechts.
    const vorher = { kreis: { x: 58, y: 18 }, preis: { x: 60, y: 35 }, titel: { x: 6 } };
    await expect(page.getByLabel('X (Abstand von links in %)', { exact: true })).toHaveValue('58');
    await expect(page.getByLabel('Y (Abstand von oben in %)', { exact: true })).toHaveValue('18');
    // Ziehen am Preis nimmt den Kreis mit.
    const a = await aufFolie(page, 76, 50), b = await aufFolie(page, 66, 54);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
    await expect.poll(async () => finde(await ersteVorlage(page)).kreis.x).toBeLessThan(58);
    const nachher = finde(await ersteVorlage(page));
    expect(nachher.preis.x - vorher.preis.x).toBeCloseTo(nachher.kreis.x - vorher.kreis.x, 5);
    expect(nachher.preis.y - vorher.preis.y).toBeCloseTo(nachher.kreis.y - vorher.kreis.y, 5);
    expect(nachher.titel.x).toBe(vorher.titel.x);
    await expect(page.locator('.eig h3', { hasText: '2 Elemente ausgewählt' })).toBeVisible();

    // Pfeiltaste schiebt beide um 0,5 %.
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => finde(await ersteVorlage(page)).kreis.x).toBe(nachher.kreis.x + 0.5);
    expect(finde(await ersteVorlage(page)).preis.x).toBe(nachher.preis.x + 0.5);

    // Strg + Klick nimmt den Preis wieder heraus.
    const preis = finde(await ersteVorlage(page)).preis;
    await klickAufFolie(page, preis.x + preis.w / 2, preis.y + preis.h / 2, 'Control');
    await expect(page.locator('.eig h3', { hasText: 'Fläche' })).toBeVisible();
    await expect(page.locator('.zr[aria-current="true"]')).toHaveCount(1);
  });

  test('Mehrfachauswahl: Rahmen aufziehen wählt, was ganz darin liegt', async ({ page }) => {
    await vorlagen(page);
    const a = await aufFolie(page, 98, 97), b = await aufFolie(page, 56, 16);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
    await expect(page.locator('.eig h3', { hasText: '2 Elemente ausgewählt' })).toBeVisible();
    await expect(page.locator('.eig .chip')).toHaveText(['Kreis', 'Text: 3,80 €']);
    // Entf löscht beide, Strg + Z holt sie zurück.
    const n = await page.locator('.zr[data-ebene]').count();
    await page.keyboard.press('Delete');
    await expect(page.locator('.zr[data-ebene]')).toHaveCount(n - 2);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.zr[data-ebene]')).toHaveCount(n);
    // Strg + A wählt alles, Esc hebt die Auswahl auf.
    await page.keyboard.press('Control+a');
    await expect(page.locator('.eig h3', { hasText: n + ' Elemente ausgewählt' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.eig h3', { hasText: 'Vorlage' })).toBeVisible();
  });

  test('Bild: hochgeladenes Bild wird erst einmal ganz gezeigt, „Ganz zeigen“ bricht nicht um', async ({ page }) => {
    await vorlagen(page);
    await page.locator('.starter button', { hasText: 'Leere Vorlage' }).click();
    await page.locator('.werkzeuge').getByRole('button', { name: 'Bild', exact: true }).click();
    const anzeige = page.getByRole('group', { name: 'Anzeige' });
    await expect(anzeige.getByRole('button', { name: 'Ganz zeigen' })).toHaveAttribute('aria-pressed', 'true');
    // Beide Knöpfe stehen auf einer Zeile (ein Umbruch machte den Knopf doppelt so hoch).
    for (const k of ['Ganz zeigen', 'Füllen']) expect((await anzeige.getByRole('button', { name: k }).boundingBox()).height, k).toBeLessThan(30);
    // Breites rotes Bild (4:1) in der Fläche bei X 30, Y 30, 40 × 22 %: ganz gezeigt bleibt oben ein Streifen frei.
    await page.getByLabel('Bild wählen').setInputFiles('tests/dateien/bild-breit-rot.png');
    await expect(page.locator('.eig').getByText('Bild ersetzen')).toBeVisible();
    await expect.poll(async () => nahAn(await bildpunkt(page, 50, 41), '#dc1e1e'), { message: 'Bild ist zu sehen' }).toBe(true);
    expect(nahAn(await bildpunkt(page, 50, 30.6), '#dc1e1e'), 'oben nicht abgeschnitten, also frei').toBe(false);
    await expect(anzeige.getByRole('button', { name: 'Ganz zeigen' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.eig')).toContainText('Das ganze Bild ist zu sehen');
    // Füllen: jetzt reicht das Bild bis an den oberen Rand der Fläche.
    await anzeige.getByRole('button', { name: 'Füllen' }).click();
    await expect.poll(async () => nahAn(await bildpunkt(page, 50, 30.6), '#dc1e1e'), { message: 'Fläche ganz gefüllt' }).toBe(true);
    await expect(page.locator('.eig')).toContainText('überstehende Ränder werden abgeschnitten');
  });

  test('Bild im Startpunkt „Foto mit Botschaft“: neues Foto wird ganz gezeigt', async ({ page }) => {
    await vorlagen(page);
    await page.locator('.vitem', { hasText: 'Foto mit Botschaft' }).click();
    await klickAufFolie(page, 50, 20);
    await expect(page.locator('.eig h3', { hasText: 'Bild' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Anzeige' }).getByRole('button', { name: 'Füllen' })).toHaveAttribute('aria-pressed', 'true');
    await page.getByLabel('Bild wählen').setInputFiles('tests/dateien/bild-breit-rot.png');
    await expect(page.getByRole('group', { name: 'Anzeige' }).getByRole('button', { name: 'Ganz zeigen' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('Bild: freigestelltes PNG bleibt durchsichtig, Fotos werden JPEG', async ({ page }) => {
    await vorlagen(page);
    await page.locator('.starter button', { hasText: 'Leere Vorlage' }).click();
    await page.getByRole('button', { name: 'Hintergrund: Hell' }).click();
    await page.locator('.werkzeuge').getByRole('button', { name: 'Bild', exact: true }).click();
    // Roter Kreis auf durchsichtigem Grund, 200 × 200. In der Fläche (X 30, Y 30, 40 × 22 %) liegt das Quadrat bei X 43,8 bis 56,2 %.
    await page.getByLabel('Bild wählen').setInputFiles('tests/dateien/bild-freigestellt.png');
    await expect(page.locator('.eig').getByText('Bild ersetzen')).toBeVisible();
    await expect.poll(async () => nahAn(await bildpunkt(page, 50, 41), '#dc1e1e'), { message: 'Kreis ist zu sehen' }).toBe(true);
    // In der Ecke des Bildes ist der helle Hintergrund der Folie zu sehen, kein schwarzer Kasten.
    expect(nahAn(await bildpunkt(page, 45, 31.5), '#fff7ed'), 'Ecke des Bildes zeigt den Hintergrund').toBe(true);
    const gespeichert = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem('showcube-designer-v1') || 'null'); const v = s && s.kunden[s.aktiv].vorlagen.at(-1); const e = v && v.quer.find((x: any) => x.typ === 'bild'); return e && e.bild ? e.bild.slice(0, 15) : ''; });
    await expect.poll(gespeichert).toBe('data:image/png;');
    // Ein Bild ohne durchsichtige Stellen wird JPEG, das hält das Markenpaket klein.
    await page.getByLabel('Bild wählen').setInputFiles('tests/dateien/bild-breit-rot.png');
    await expect.poll(gespeichert).toBe('data:image/jpeg');
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

  test('Video-Ebene: in der Zeitleiste, Testfilm, der Kunde wählt den Film im Panel', async ({ page, context }) => {
    await vorlagen(page);
    await page.locator('.werkzeuge').getByRole('button', { name: 'Video', exact: true }).click();
    await expect(page.locator('.eig h3', { hasText: 'Video' })).toBeVisible();
    await expect(page.locator('.zeit')).toContainText('Video');
    await expect(page.locator('.eig')).toContainText('Den fertigen Film wählt der Kunde im Panel');
    await page.getByLabel('Testfilm wählen').setInputFiles('tests/dateien/film-2s.webm');
    await expect(page.locator('.eig')).toContainText('Anderen Testfilm');
    const vorlage = await page.locator('.vitem[aria-current="true"] b').innerText();

    // Ins Panel: eigene Vorlage als Baustein einfügen und den Film dazu hochladen.
    const [panel] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: 'Ins Panel übernehmen' }).click()]);
    await panel.waitForLoadState();
    await expect(panel.locator('#toast')).toContainText('aus dem Designer übernommen');
    await slideshowOeffnen(panel, 'Mittags- und Abendkarte');
    await panel.getByRole('tab', { name: /^Bausteine/ }).click();
    await panel.locator('button.own', { hasText: vorlage }).first().click();
    await panel.getByLabel('Video hochladen').last().setInputFiles('tests/dateien/film-2s.webm');
    await expect(panel.locator('.bst').last()).toContainText('Die Folie dauert so lange wie der Film.');
    await expect(panel.locator('.bst').last().locator('select').first()).toHaveValue(/.+/);
    // Der Film steckt im Paket für den USB-Stick, die Box spielt ihn mit der Folie ab.
    const [download] = await Promise.all([panel.waitForEvent('download'), panel.getByRole('button', { name: 'Für USB-Stick' }).click()]);
    const player = await context.newPage();
    await player.goto('release/player.html');
    await player.keyboard.press('e');
    await player.getByLabel('ShowCube-Paket laden').setInputFiles(await download.path());
    await expect(player.locator('#paketNote')).toContainText('geladen');
    const filmId = await player.evaluate(() => { const c = JSON.parse(localStorage.getItem('svizzbox-player-v0') || '{}'); const b = c.extras.find((x: any) => x.kind === 'design'); const v = c.marke.vorlagen.find((x: any) => x.id === b.f.vorlage); const el = v.quer.find((e: any) => e.typ === 'video'); return b.f[el.id]; });
    expect(filmId).toBeTruthy();
    await expect.poll(() => player.evaluate(id => new Promise(res => { const r = indexedDB.open('svizzbox-player', 1); r.onsuccess = () => { const q = r.result.transaction('files').objectStore('files').get(id); q.onsuccess = () => res(q.result && q.result.type); }; }), filmId)).toBe('video/webm');
    // Die Folie mit dem Film läuft so lange wie der Film (2 s), nicht die üblichen 8 s pro Folie.
    await player.keyboard.press('Escape');
    const zaehler = () => player.evaluate(() => JSON.parse(localStorage.getItem('svizzbox-player-v0-plays') || '{"n":{}}').n as Record<string, number>);
    const gezeigt = async () => Object.keys(await zaehler()), wechsel = async () => Object.values(await zaehler()).reduce((a, b) => a + b, 0);
    await expect.poll(async () => { if ((await gezeigt()).some(k => k.startsWith('Eigene Vorlage'))) return true; await player.keyboard.press('ArrowRight'); return false; },
      { message: 'eigene Vorlage mit Film kommt dran', timeout: 15_000, intervals: [300] }).toBe(true);
    const vorher = await wechsel();
    await expect.poll(wechsel, { message: 'nach dem Film geht es weiter', timeout: 5_000 }).toBeGreaterThan(vorher);
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
