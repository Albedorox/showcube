# Hinweise für Claude in diesem Repo

## Neue Funktionen: Doku immer, Startseite nur wenn nötig

Jede neue oder geänderte Funktion, die ein Kunde sehen kann, ist erst fertig, wenn im selben PR die Doku stimmt:
`README.md` (Tabelle „Stand“) und die passende Datei unter `docs/`. Dazu `npm run build` und `release/` mit einchecken.
Und die Tests dazu, siehe unten „Tests“.

Die Startseite `index.html` nur anpassen, wenn wirklich eine **relevante neue Funktion** dazukommt, also etwas,
das ein Interessent kennen sollte (Beispiel: Vorlagen-Designer, ja; ein Farbwähler oder eine kleine Verbesserung, nein).
Dann: Funktionen-Raster, bei Bedarf eine häufige Frage (auch im FAQPage-JSON-LD oben) und Links im Footer unter „Apps“.
Im Zweifel die Startseite nicht anfassen und im PR erwähnen, dass sie unverändert bleibt.

## Tests: jede Änderung bringt ihren Test mit

Das Repo hat automatische Regressionstests (Playwright, `tests/`, Anleitung in `docs/tests.md`).
GitHub Actions lässt sie bei jedem PR laufen. Regeln für jede Session:

- **Vor dem PR alles grün:** `npm run build`, dann `npm test`. Erst wenn beides ohne Fehler durchläuft,
  den PR als fertig melden. Nach dem Push auch den Check „Tests“ auf GitHub abwarten.
- **Neue oder geänderte Funktion = neuer oder angepasster Test im selben PR**, in der passenden Datei
  `tests/<app>.spec.ts` (Startseite, Player, Panel, Partner-Slots, Designer). Den Ablauf so prüfen, wie ein Kunde ihn
  klickt. Ein Bugfix bekommt einen Test, der den Fehler vorher gezeigt hätte.
- **Tests nie abschwächen, um grün zu werden:** nicht löschen, nicht überspringen, keine Erwartung lockern, nur weil
  sie stört. Ändert sich ein Verhalten absichtlich, den Test anpassen und das im PR in einem Satz sagen.
- **Bildvergleiche** (`tests/bilder/`): Ändert sich das Aussehen absichtlich, die Bilder mit `npm run test:bilder`
  (unter Linux) oder dem Workflow „Bildvergleiche erneuern“ neu aufnehmen und im PR sagen, welche Bilder sich warum ändern.
- Tests sprechen nie das echte Backend an. `tests/hilfen.ts` sperrt das Internet und stellt die Uhr fest
  (Mittwoch, 18.11.2026, 12 Uhr). Neue Tests immer `test` und `expect` aus `./hilfen` nehmen.
- Im PR-Text kurz aufführen, welche Tests neu oder geändert sind.

## Startseite: Text, der bleibt

Black findet die Copy gut. Diese Teile bleiben inhaltlich so, nur ergänzen, nicht umschreiben:

- Hero „Dein Fernseher wird zum besten Verkäufer.“
- „Warum ShowCube“ mit „Ein Bildschirm verkauft nur, wenn er aktuell ist“.
- Der Vergleich in den Karten: oben „Bisher“, darunter „Mit ShowCube“ (beides als Beschriftung sichtbar).

## Sonst

- Sprache der Oberfläche und Doku: Deutsch, „du“, ganze Sätze.
- Schriften liegen im Repo bzw. in den Einzeldateien, keine Google Fonts (DSGVO).
