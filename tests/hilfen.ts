// Gemeinsame Grundlage für alle Tests. Jeder Test bekommt eine Seite, die
// - nichts aus dem Internet lädt (Supabase, Wetter, Schriften): Tests hängen nie vom echten Backend ab,
// - eine feste Uhrzeit hat (Mittwoch, 18.11.2026, 12:00 Uhr in Berlin), damit Tag/Abend und Zeitpläne immer gleich sind,
// - mitschreibt, welche Texte auf die Leinwände (canvas) gemalt werden. Folien sind Bilder, so prüfen wir trotzdem ihren Text,
// - am Ende scheitert, wenn ein JavaScript-Fehler aufgetreten ist.
import { test as base, expect, type Page, type BrowserContext } from '@playwright/test';

declare const process: { platform: string };

export const JETZT = new Date('2026-11-18T12:00:00+01:00');

type Fixtures = { fehler: string[] };

export const test = base.extend<Fixtures>({
  fehler: async ({}, use) => { await use([]); },
  context: async ({ context, fehler }, use) => {
    await context.route(/^(?!http:\/\/127\.0\.0\.1)https?:\/\//, r => r.abort('internetdisconnected'));
    await context.addInitScript(() => {
      const texte: string[] = [];
      (window as any).__texte = texte;
      for (const K of [CanvasRenderingContext2D, (window as any).OffscreenCanvasRenderingContext2D].filter(Boolean)) {
        const fill = K.prototype.fillText;
        K.prototype.fillText = function (t: any, ...rest: any[]) { const s = String(t); if (texte[texte.length - 1] !== s) { texte.push(s); if (texte.length > 4000) texte.splice(0, 2000); } return fill.call(this, t, ...rest); };
      }
    });
    await context.clock.install({ time: JETZT });
    const beobachten = (p: Page) => p.on('pageerror', e => fehler.push(`${new URL(p.url()).pathname}: ${e.message}`));
    context.pages().forEach(beobachten);
    context.on('page', beobachten);
    await use(context);
  },
});

test.afterEach(async ({ fehler }) => {
  expect(fehler, 'JavaScript-Fehler auf der Seite').toEqual([]);
});

export { expect };

/** Alle Texte, die seit dem Laden (oder seit leinwandLeeren) auf eine Leinwand gemalt wurden. */
export const leinwandTexte = (page: Page) => page.evaluate(() => (window as any).__texte as string[]);
export const leinwandLeeren = (page: Page) => page.evaluate(() => { (window as any).__texte.length = 0; });

/** Wartet, bis ein Text auf einer Leinwand der Seite erscheint. */
export async function erwarteAufLeinwand(page: Page, text: string | RegExp, timeout = 10_000) {
  await expect.poll(async () => (await leinwandTexte(page)).some(t => typeof text === 'string' ? t.includes(text) : text.test(t)),
    { message: `Text „${text}“ erscheint auf der Folie`, timeout }).toBe(true);
}

/** Für Bildvergleiche vor dem Laden aufrufen: Die Uhr steht dann (10 s nach JETZT) und läuft nur mit uhrVor weiter.
 *  So ist jede Animation bei jedem Lauf an derselben Stelle. */
export async function uhrAnhalten(page: Page) {
  await page.clock.pauseAt(new Date(JETZT.getTime() + 10_000));
}
/** Lässt die angehaltene Uhr um ms weiterlaufen (Timer und Animationen laufen mit). */
export async function uhrVor(page: Page, ms: number) {
  await page.evaluate(() => document.fonts.ready);
  // In kleinen Schritten, damit Dinge ohne Timer (Schriften, Browser-Speicher) dazwischen fertig werden können.
  for (let t = 0; t < ms; t += 250) { await page.clock.runFor(Math.min(250, ms - t)); await page.waitForTimeout(25); }
}

/** Ein Bereich in der Navigation des Panels (Seitenleiste am Rechner, Leiste unten am Handy). */
export const bereich = (page: Page, name: string) =>
  page.locator('#nav:visible, #tabbar:visible').getByRole('button', { name: new RegExp('^' + name + '\\b') });

/** Bildvergleiche sind auf Linux aufgenommen (wie in GitHub Actions). Auf Mac oder Windows sähen Schriften minimal anders aus. */
export const nurLinux = () => test.skip(process.platform !== 'linux', 'Bildvergleiche gelten für Linux (CI)');

/** Panel: Bereich „Inhalte“ öffnen und eine Slideshow wählen. Wartet, bis das Formular fertig neu gezeichnet ist. */
export async function slideshowOeffnen(page: Page, name: string | RegExp) {
  await bereich(page, 'Inhalte').click();
  await expect(page.getByRole('heading', { name: 'Inhalte', level: 1 })).toBeVisible();
  const eintrag = page.locator('.slist .sitem', { hasText: name });
  await eintrag.click();
  await expect(page).toHaveURL(/#shows\/.+/);
  await expect(page.locator('.slist .sitem', { hasText: name })).toHaveAttribute('aria-current', 'true');
  // Der Wechsel der Adresse zeichnet das Formular einen Moment später neu. Erst danach tippen.
  await page.evaluate(() => new Promise(r => setTimeout(() => requestAnimationFrame(r), 50)));
}
