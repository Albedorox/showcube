# Hinweise für Claude in diesem Repo

## Neue Funktionen: Doku immer, Startseite nur wenn nötig

Jede neue oder geänderte Funktion, die ein Kunde sehen kann, ist erst fertig, wenn im selben PR die Doku stimmt:
`README.md` (Tabelle „Stand“) und die passende Datei unter `docs/`. Dazu `npm run build` und `release/` mit einchecken.

Die Startseite `index.html` nur anpassen, wenn wirklich eine **relevante neue Funktion** dazukommt, also etwas,
das ein Interessent kennen sollte (Beispiel: Vorlagen-Designer, ja; ein Farbwähler oder eine kleine Verbesserung, nein).
Dann: Funktionen-Raster, bei Bedarf eine häufige Frage (auch im FAQPage-JSON-LD oben) und Links im Footer unter „Apps“.
Im Zweifel die Startseite nicht anfassen und im PR erwähnen, dass sie unverändert bleibt.

## Startseite: Text, der bleibt

Black findet die Copy gut. Diese Teile bleiben inhaltlich so, nur ergänzen, nicht umschreiben:

- Hero „Dein Fernseher wird zum besten Verkäufer.“
- „Warum ShowCube“ mit „Ein Bildschirm verkauft nur, wenn er aktuell ist“.
- Der Vergleich in den Karten: oben „Bisher“, darunter „Mit ShowCube“ (beides als Beschriftung sichtbar).

## Sonst

- Sprache der Oberfläche und Doku: Deutsch, „du“, ganze Sätze.
- Schriften liegen im Repo bzw. in den Einzeldateien, keine Google Fonts (DSGVO).
