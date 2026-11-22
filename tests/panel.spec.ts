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

// ---------- Konto: Bestätigungsmail und Zwei-Faktor ----------
// Supabase wird hier nachgestellt (page.route), das echte Backend bleibt aus dem Spiel.
// Was der Server dabei wirklich prüft (aal2, Sperren), testet scripts/backend-test.mjs gegen einen lokalen Supabase.
const SUPA = 'https://imrrbyeywegpmqxuinji.supabase.co';
const b64u = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function nachgestellt(page: Page, { mfa = false } = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const faktor = { id: 'f-1', factor_type: 'totp', status: 'verified', friendly_name: 'ShowCube' };
  const user = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'pia@example.com', factors: mfa ? [faktor] : [], app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' };
  const jwt = (aal: string) => b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u({ sub: 'u-1', role: 'authenticated', aal, amr: [{ method: 'password', timestamp: exp - 3600 }], exp, session_id: 's-1' }) + '.sig';
  const sitzung = (aal: string) => ({ access_token: jwt(aal), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: 'r-' + aal, user });
  const log: string[] = [];
  const json = (route: any, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  return page.route(SUPA + '/**', route => {
    const u = new URL(route.request().url()), m = route.request().method(); log.push(m + ' ' + u.pathname);
    if (u.pathname === '/auth/v1/signup') return json(route, { ...user, factors: [], identities: [{}] });
    if (u.pathname === '/auth/v1/token') return json(route, sitzung('aal1'));
    if (u.pathname === '/auth/v1/user') return json(route, user);
    if (u.pathname === '/auth/v1/factors/f-1/challenge') return json(route, { id: 'c-1', type: 'totp', expires_at: exp });
    if (u.pathname === '/auth/v1/factors/f-1/verify') {
      const code = JSON.parse(route.request().postData() || '{}').code;
      return code === '246810' ? json(route, sitzung('aal2')) : json(route, { code: 'mfa_verification_failed', msg: 'Invalid TOTP code entered' }, 422);
    }
    if (u.pathname === '/rest/v1/rpc/mein_betrieb') return json(route, 'b-1');
    if (u.pathname === '/rest/v1/rpc/ist_admin') return json(route, false);
    if (u.pathname === '/rest/v1/betriebe' && m === 'GET') return json(route, { name: 'Café Pia', hinweis: null, einstellungen: {} });
    if (u.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204 });
    return json(route, m === 'GET' ? [] : [], m === 'GET' ? 200 : 201);
  }).then(() => log);
}

test.describe('Panel: Konto und Zwei-Faktor', () => {
  test('neues Konto: Hinweis auf die Bestätigungsmail statt sofort angemeldet', async ({ page }) => {
    await nachgestellt(page);
    await page.goto('release/panel.html');
    await page.getByRole('button', { name: 'Konto anlegen' }).first().click();
    await page.getByLabel('Name des Betriebs').fill('Café Pia');
    await page.getByLabel('E-Mail').fill('pia@example.com');
    await page.getByLabel('Passwort').fill('kaffee-2026');
    await expect(page.getByText('Mindestens 8 Zeichen, mit Buchstaben und Ziffern.')).toBeVisible();
    await page.locator('#loginForm').getByRole('button', { name: 'Konto anlegen' }).click();
    await expect(page.getByRole('heading', { name: 'Fast geschafft' })).toBeVisible();
    await expect(page.locator('#loginForm')).toContainText('Wir haben dir eine E-Mail an pia@example.com geschickt.');
    await page.getByRole('button', { name: 'Zur Anmeldung' }).click();
    await expect(page.getByRole('heading', { name: 'Anmelden' })).toBeVisible();
  });

  test('zurück aus der Bestätigungsmail: Hinweis, und die Schlüssel verschwinden aus der Adresse', async ({ page }) => {
    await nachgestellt(page);
    await page.goto('release/panel.html?bestaetigt#access_token=abc&refresh_token=def&type=signup');
    await expect(page.getByRole('status').filter({ hasText: 'Deine E-Mail ist bestätigt.' })).toBeVisible();
    await expect(page).not.toHaveURL(/access_token|bestaetigt/);
    await page.goto('release/panel.html?bestaetigt#error=access_denied&error_description=Email+link+is+invalid+or+has+expired');
    await expect(page.getByText('Der Bestätigungslink ist abgelaufen oder wurde schon benutzt.')).toBeVisible();
  });

  test('Anmelden mit Zwei-Faktor fragt nach dem Code aus der App', async ({ page }) => {
    const log = await nachgestellt(page, { mfa: true });
    await page.goto('release/panel.html');
    await page.getByRole('button', { name: 'Anmelden' }).first().click();
    await page.getByLabel('E-Mail').fill('pia@example.com');
    await page.getByLabel('Passwort').fill('kaffee-2026');
    await page.locator('#loginForm').getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.getByRole('heading', { name: 'Code aus der App' })).toBeVisible();
    expect(log.some(l => l.includes('/rest/v1/')), 'ohne Code keine Daten abgefragt').toBe(false);
    await page.getByRole('textbox', { name: 'Code' }).fill('111 111');
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.getByText('Der Code stimmt nicht.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Code' }).fill('246 810');
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(page.locator('#toast')).toContainText('Angemeldet.');
    // Im Konto steht, dass der Schutz an ist.
    await page.locator('#konto').click();
    await expect(page.getByRole('heading', { name: 'Konto' })).toBeVisible();
    await expect(page.getByText('Ist an. Beim Anmelden fragt ShowCube nach dem Code')).toBeVisible();
    await expect(page.locator('#loginForm').getByRole('button', { name: 'Abmelden' })).toBeVisible();
  });

  test('Konto ohne Zwei-Faktor: Einrichten zeigt QR-Code und Schlüssel', async ({ page }) => {
    await nachgestellt(page);
    await page.route(SUPA + '/auth/v1/factors', r => r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ id: 'f-1', type: 'totp', friendly_name: 'ShowCube', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg"/>', secret: 'JBSWY3DPEHPK3PXP', uri: 'otpauth://totp/ShowCube' } }) }));
    await page.goto('release/panel.html');
    await page.getByRole('button', { name: 'Anmelden' }).first().click();
    await page.getByLabel('E-Mail').fill('pia@example.com');
    await page.getByLabel('Passwort').fill('kaffee-2026');
    await page.locator('#loginForm').getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('#toast')).toContainText('Angemeldet.');
    await page.locator('#konto').click();
    await page.getByRole('button', { name: 'Einrichten' }).click();
    await expect(page.getByRole('img', { name: 'QR-Code für die Authenticator-App' })).toBeVisible();
    await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
    await page.getByLabel('2. Code aus der App').fill('246810');
    await page.getByRole('button', { name: 'Einschalten' }).click();
    await expect(page.locator('#toast')).toContainText('Zwei-Faktor-Schutz ist an.');
  });
});
