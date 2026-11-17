# Hinweise für Claude in diesem Repo

## Neue Funktionen: immer Doku und Startseite mitziehen

Jede neue oder geänderte Funktion, die ein Kunde sehen kann, ist erst fertig, wenn im selben PR auch
diese Stellen stimmen:

- `README.md` (Tabelle „Stand“) und die passende Datei unter `docs/` (z. B. `docs/wie-alles-zusammenhaengt.md`).
- Die Startseite `index.html`: Funktionen-Raster, bei Bedarf eine häufige Frage (dann auch im FAQPage-JSON-LD oben)
  und Links im Footer unter „Apps“.
- `npm run build` und `release/` mit einchecken.

## Startseite: Text, der bleibt

Black findet die Copy gut. Diese Teile bleiben inhaltlich so, nur ergänzen, nicht umschreiben:

- Hero „Dein Fernseher wird zum besten Verkäufer.“
- „Warum ShowCube“ mit „Ein Bildschirm verkauft nur, wenn er aktuell ist“.
- Der Vergleich in den Karten: oben „Bisher“, darunter „Mit ShowCube“ (beides als Beschriftung sichtbar).

## Sonst

- Sprache der Oberfläche und Doku: Deutsch, „du“, ganze Sätze.
- Schriften liegen im Repo bzw. in den Einzeldateien, keine Google Fonts (DSGVO).
