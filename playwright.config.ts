// Regressionstests mit Playwright. Anleitung: docs/tests.md
// Getestet werden die fertigen Dateien in release/ (genau das, was Kunden bekommen) und die Startseite index.html.
import { defineConfig, devices } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

const CI = !!process.env.CI;
const PORT = 4173;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  timeout: 30_000,
  reporter: CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  // Bildvergleiche liegen neben den Tests in tests/bilder/. Ohne Betriebssystem im Namen, sie gelten für Linux (CI).
  snapshotPathTemplate: '{testDir}/bilder/{testFileName}/{arg}{ext}',
  expect: {
    timeout: 8_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.015, threshold: 0.25, animations: 'disabled', caret: 'hide' },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',
    trace: CI ? 'on-first-retry' : 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }, grepInvert: /@handy/ },
    { name: 'handy', use: { ...devices['Pixel 7'] }, grep: /@handy/ },
  ],
  webServer: {
    command: `node scripts/test-server.mjs ${PORT}`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !CI,
    stdout: 'ignore',
  },
});
