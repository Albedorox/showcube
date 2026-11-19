# Automatische Tests (Regressionstests)

Damit eine neue Funktion nichts kaputt macht, was vorher ging, prüfen automatische Tests die wichtigsten Abläufe
in einem echten Browser (Chromium, gesteuert von [Playwright](https://playwright.dev)). Sie laufen bei jedem
Pull Request auf GitHub. Ein roter Haken am PR heißt: Etwas Altes ist kaputt. Erst reparieren, dann mergen.

## Was geprüft wird

Getestet werden die fertigen Dateien in `release/` und die Startseite `index.html`, also genau das, was Kunden bekommen.

| Datei | Was die Tests prüfen |
| --- | --- |
| `tests/startseite.spec.ts` | Texte, die bleiben sollen (Hero, „Warum ShowCube“, Bisher/Mit ShowCube), alle Bereiche, häufige Fragen stimmen mit den Google-Daten (JSON-LD) überein, jeder Link auf eine Datei funktioniert, der Fernseher zeigt echte Folien und das Handy ändert den Preis, „Bewegung reduzieren“ hält die Folien nicht an, Handy-Ansicht ohne waagerechtes Scrollen. |
| `tests/player.spec.ts` | Start mit Beispiel-Folien, Einstellungen mit Taste E, Branche und Preise ändern, Tag/Abend/Aus, alles bleibt nach dem Neuladen, Folien wechseln von selbst. Light-Ablauf: Paket im Panel „Für USB-Stick“ exportieren und im Player laden. |
| `tests/panel.spec.ts` | Anmeldung mit „Demo ansehen“, Demo mit Ausfall-Meldung, alle Bereiche, Befehlsleiste (Strg + K), Preis ändern, Entwurf, Veröffentlichen, Verlauf, Gericht ausblenden, Zeitplan mit Ruhetag, Sofort-Hinweis, Fernwartung. „Live öffnen“: der Player im zweiten Tab zeigt einen veröffentlichten Preis. Handy-Ansicht. |
| `tests/partner-slots.spec.ts` | Schalter in den Einstellungen, Bereich „Partner“ erscheint und verschwindet, Partner anlegen und pausieren, Bericht ansehen und Bericht-Link kopieren (öffnet ohne Login), kaputter Link, der Live-Player mischt Partner-Folien ein. |
| `tests/designer.spec.ts` | Marke (Name, Farbset, eigene Farbe) wirkt auf die Vorlagen, Zeitleiste: Balken ziehen und mit Pfeiltasten verschieben, Ebenen am Griff umsortieren, neue Vorlage aus Startpunkt, „Für Agenturen“, „Ins Panel übernehmen“ öffnet das Panel mit der Marke. Handy-Ansicht. |

Dazu **Bildvergleiche**: Von Startseite (Rechner und Handy), Player, Panel, Partner-Bereich und Designer liegt je ein
Referenzbild in `tests/bilder/`. Sieht die Seite später anders aus, schlägt der Test fehl und der Testbericht zeigt
Vorher, Nachher und den Unterschied. So fallen auch optische Fehler auf, die kein Ablauf-Test merkt.

Jeder Test scheitert außerdem, sobald auf der Seite ein JavaScript-Fehler auftritt.

## So bleiben die Tests verlässlich

`tests/hilfen.ts` gilt für jeden Test:

- **Kein Internet:** Alles außer dem lokalen Testserver ist gesperrt. Die Tests sprechen nie das echte Backend
  (Supabase) an und brauchen weder Wetter noch Schriften aus dem Netz. Das Panel läuft als Demo.
- **Feste Uhrzeit:** Mittwoch, 18. November 2026, 12 Uhr in Berlin. Tag/Abend, Zeitpläne und Datumsangaben sind
  dadurch bei jedem Lauf gleich. Für Bildvergleiche steht die Uhr ganz still und läuft nur in festen Schritten weiter.
- **Folien lesen:** Folien werden auf eine Leinwand (canvas) gemalt, sind also Bilder. Die Tests schreiben mit,
  welcher Text gemalt wird, und prüfen so trotzdem, ob z. B. ein neuer Preis auf dem Bildschirm steht
  (`erwarteAufLeinwand(page, '7,90 €')`).

## Selbst laufen lassen

Einmalig: `npm install` und `npx playwright install chromium`.

```
npm run build        # Tests prüfen release/, also vorher bauen
npm test             # alle Tests, dauert etwa eine Minute
npm run test:ui      # Tests im Fenster ansehen, Schritt für Schritt
npx playwright test tests/panel.spec.ts   # nur eine Datei
npx playwright show-report                # Bericht des letzten Laufs mit Bildern
```

Bildvergleiche laufen nur unter Linux, weil Schriften auf Mac und Windows minimal anders aussehen. Dort werden sie übersprungen.

## Auf GitHub

Der Workflow „Tests“ (`.github/workflows/tests.yml`) läuft bei jedem Pull Request und auf `main`:

1. Typprüfung und Build. Danach muss `release/` genau dem eingecheckten Stand entsprechen. Wer vergessen hat,
   `npm run build` auszuführen und `release/` einzuchecken, bekommt hier einen Fehler.
2. Alle Playwright-Tests. Bei einem Fehler liegt der Bericht mit Bildern als Datei „testbericht“ am Lauf
   (Actions → der Lauf → unten „Artifacts“).

**Bildvergleiche erneuern:** Hat sich das Aussehen absichtlich geändert, unter Actions den Workflow
„Bildvergleiche erneuern“ für den Branch des PR starten. Er nimmt die Bilder auf derselben Art Maschine neu auf und
legt sie als Commit auf den Branch. Im PR sieht man dann die geänderten Bilder. Die Tests laufen danach beim
nächsten Push wieder (Commits des Workflows selbst starten keine neuen Läufe).

## Neue Funktion, neuer Test

Jede neue oder geänderte Funktion bringt im selben PR ihren Test mit (Regel in `CLAUDE.md`). So geht's:

1. Passende Datei wählen, z. B. `tests/panel.spec.ts`, oder für einen großen neuen Bereich eine neue `tests/<name>.spec.ts`.
2. `test` und `expect` aus `./hilfen` importieren, nicht direkt aus `@playwright/test`.
3. Den Ablauf so klicken, wie ein Kunde es tut: Elemente über ihre Beschriftung finden
   (`getByRole('button', { name: 'Veröffentlichen' })`, `getByLabel('Preis, Zeile 1')`), dann das Ergebnis prüfen.
4. Bei optischen Änderungen ein Bild aufnehmen: `npm run test:bilder` (Linux) oder den Workflow oben.
5. `npm test` muss grün sein, bevor der PR fertig ist.

Ein Bugfix bekommt einen Test, der den Fehler vorher gezeigt hätte. Tests werden nie gelöscht, übersprungen oder
gelockert, nur damit sie grün werden.
