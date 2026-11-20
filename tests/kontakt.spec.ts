// Kontaktformular (kontakt.html, kontakt.php), Impressum und Datenschutz.
import { test, expect } from './hilfen';
// @ts-ignore: reines JavaScript-Modul ohne Typen
import { phpServer } from './kontakt-hilfe.mjs';

test.describe('Kontaktformular', () => {
  test('Textbaustein wählen, ausfüllen und absenden', async ({ page }) => {
    let gesendet = '';
    await page.route('**/kontakt.php', async r => { gesendet = r.request().postData() || ''; await r.fulfill({ json: { ok: true } }); });
    await page.goto('kontakt.html');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Schreib uns');

    await page.getByRole('button', { name: 'Testbox anfragen' }).click();
    await expect(page.getByRole('button', { name: 'Testbox anfragen' })).toHaveAttribute('aria-pressed', 'true');
    const nachricht = page.getByLabel('Nachricht');
    await expect(nachricht).toHaveValue(/mit einer Testbox ausprobieren/);
    await page.keyboard.type('2');

    await page.getByLabel('Name').fill('Erika Muster');
    await page.getByLabel('E-Mail').fill('erika@example.com');
    await page.getByLabel('Betrieb').fill('Pizzeria Sole');
    await page.getByLabel('Branche').selectOption('Gastronomie');
    await page.getByRole('button', { name: 'Anfrage senden' }).click();

    await expect(page.getByRole('status')).toHaveText(/Danke, deine Anfrage ist angekommen/);
    expect(gesendet).toContain('name="thema"\r\n\r\ntestbox');
    expect(gesendet).toContain('Erika Muster');
    expect(gesendet).toContain('Pizzeria Sole');
    expect(gesendet).toContain('Anzahl Bildschirme: 2');
    await expect(nachricht).toHaveValue('');
  });

  test('eigener Text wird nie überschrieben, Link mit Thema wählt den Baustein vor', async ({ page }) => {
    await page.goto('kontakt.html?thema=preise');
    const nachricht = page.getByLabel('Nachricht');
    await expect(page.getByRole('button', { name: 'Preise und Pakete' })).toHaveAttribute('aria-pressed', 'true');
    await expect(nachricht).toHaveValue(/Preise und Pakete/);
    // Anderer Baustein ersetzt die unveränderte Vorlage.
    await page.getByRole('button', { name: 'Rückruf gewünscht' }).click();
    await expect(nachricht).toHaveValue(/bitte ruft mich zurück/);
    await expect(nachricht).not.toHaveValue(/Preise und Pakete/);
    // Eigener Text bleibt stehen, der Baustein kommt dazu.
    await nachricht.fill('Wir haben drei Fernseher im Laden.');
    await page.getByRole('button', { name: 'Allgemeine Frage' }).click();
    await expect(nachricht).toHaveValue(/^Wir haben drei Fernseher im Laden\.\n\nHallo ShowCube-Team/);
  });

  test('fehlende Angaben werden genannt, Fehler vom Server landen sichtbar', async ({ page }) => {
    await page.route('**/kontakt.php', r => r.fulfill({ status: 500, json: { ok: false, fehler: 'Das hat leider nicht geklappt.' } }));
    await page.goto('kontakt.html');
    await page.getByRole('button', { name: 'Anfrage senden' }).click();
    await expect(page.getByRole('status')).toHaveText('Bitte ergänze noch deinen Namen, eine gültige E-Mail-Adresse, eine kurze Nachricht.');
    await page.getByLabel('Name').fill('Erika');
    await page.getByLabel('E-Mail').fill('erika@example.com');
    await page.getByLabel('Nachricht').fill('Ich habe eine Frage.');
    await page.getByRole('button', { name: 'Anfrage senden' }).click();
    await expect(page.getByRole('status')).toHaveText('Das hat leider nicht geklappt.');
    await expect(page.getByLabel('Name'), 'Eingaben bleiben bei einem Fehler stehen').toHaveValue('Erika');
  });

  test('passt aufs Handy @handy', async ({ page }) => {
    await page.goto('kontakt.html');
    await expect(page.getByRole('button', { name: 'Anfrage senden' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
});

test.describe('kontakt.php', () => {
  let server: { adresse: string; mails(): string; stoppen(): void };
  test.beforeAll(async () => { server = await phpServer(); });
  test.afterAll(() => server?.stoppen());

  // Zeitstempel wie im Formular: echte Uhr, denn PHP vergleicht mit seiner eigenen Zeit.
  const vorher = (ms: number) => String(Date.now() - ms);
  const anfrage = (felder: Record<string, string>) => ({ multipart: { name: 'Erika Muster', email: 'erika@example.com', nachricht: 'Ich hätte gern eine Testbox.', thema: 'testbox', t: vorher(10_000), website: '', ...felder } });

  test('schickt die Mail an hallo@showcube.de mit Betreff und Antwortadresse', async ({ request }) => {
    const a = await request.post(server.adresse + 'kontakt.php', anfrage({ betrieb: 'Pizzeria Sole', telefon: '07541 123' }));
    expect(a.status()).toBe(200);
    expect(await a.json()).toEqual({ ok: true });
    const mail = server.mails();
    expect(mail).toContain('To: hallo@showcube.de');
    expect(mail).toMatch(/^Subject: \[Kontaktformular\] Testbox anfragen /m);
    expect(mail).toContain('Reply-To: ');
    expect(mail).toContain('<erika@example.com>');
    expect(mail).toContain('Thema:    Testbox anfragen');
    expect(mail).toContain('Betrieb:  Pizzeria Sole');
    expect(mail).toContain('Ich hätte gern eine Testbox.');
  });

  test('Spamschutz: verstecktes Feld, zu schnell, Kopfzeilen-Tricks, zu viele Anfragen', async ({ request }) => {
    const url = server.adresse + 'kontakt.php';
    const vorher = server.mails();
    // Bot füllt das versteckte Feld: Antwort ok, aber keine Mail.
    expect(await (await request.post(url, anfrage({ website: 'http://spam.example' }))).json()).toEqual({ ok: true });
    expect(server.mails()).toBe(vorher);
    // Zu schnell ausgefüllt.
    expect((await request.post(url, anfrage({ t: String(Date.now()) }))).status()).toBe(400);
    // Ungültige Adresse.
    expect((await request.post(url, anfrage({ email: 'kein-mail' }))).status()).toBe(422);
    // Zeilenumbruch im Namen landet nicht als eigene Kopfzeile.
    await request.post(url, anfrage({ name: 'Erika\r\nBcc: opfer@example.com' }));
    expect(server.mails()).not.toMatch(/^Bcc:/m);
    // GET ist nicht erlaubt.
    expect((await request.get(url)).status()).toBe(405);
    // Höchstens 5 Anfragen pro Stunde von derselben Adresse (2 gingen in diesem Server schon durch: oben und hier).
    let letzter = 0;
    for (let i = 0; i < 6; i++) letzter = (await request.post(url, anfrage({}))).status();
    expect(letzter).toBe(429);
  });
});

test.describe('Impressum und Datenschutz', () => {
  test('sind von der Startseite verlinkt und vollständig', async ({ page }) => {
    await page.goto('./');
    await page.locator('footer').getByRole('link', { name: 'Impressum' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impressum');
    for (const text of ['Angaben gemäß § 5 DDG', 'Manuel Schweizer', 'Schloßstr. 42', '88045 Friedrichshafen', 'Einzelunternehmer', 'hallo@showcube.de'])
      await expect(page.locator('main')).toContainText(text);
    await expect(page.getByRole('link', { name: /kontakt\.html/ })).toHaveAttribute('href', 'kontakt.html');
    await page.getByRole('link', { name: 'Datenschutz' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Datenschutzerklärung');
    for (const text of ['keine Cookies', 'Hostinger', 'Kontaktformular', 'Supabase', 'Frankfurt'])
      await expect(page.locator('main')).toContainText(text);
  });

  test('Startseite: „Testbox anfragen“ führt zum Formular mit passendem Baustein', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('link', { name: 'Testbox anfragen' }).last().click();
    await expect(page).toHaveURL(/kontakt\.html\?thema=testbox$/);
    await expect(page.getByLabel('Nachricht')).toHaveValue(/Testbox/);
  });
});

