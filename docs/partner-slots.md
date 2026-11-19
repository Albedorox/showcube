# Partner-Slots: Dein Bildschirm verdient mit

Idee aus dem Markt (markt-displays.de im REWE Friedrichshafen): Ein Laden vermietet Sendezeit auf seinem
Bildschirm an Geschäfte aus der Nachbarschaft. Der Laden verdient mit, der Partner bekommt Sichtbarkeit und
Zahlen dazu. Für ShowCube ist das eine **Zusatzfunktion**, nicht der Kern. Der Kern bleibt
„eigener Bildschirm, immer aktuell, Plug & Show“. Partner-Slots machen aus den Kosten für den Bildschirm
im besten Fall Einnahmen.

Stand: Prototyp. Alles läuft in Panel und Player, ohne Änderung am Server.

## Für den Laden

1. **Einschalten:** Im Panel oben rechts auf das Zahnrad (Einstellungen), dann „Partner-Slots: Dein Bildschirm
   verdient mit“. Standardmäßig ist das aus, dann ist davon nirgends etwas zu sehen. Eingeschaltet erscheint links
   der Bereich **Partner** (auf dem Handy unten in der Leiste).
2. **Freie Plätze bewerben:** Die Folie „Werbeplatz frei“ läuft zwischen den eigenen Folien, mit QR-Code zum Laden
   (z. B. eine Mail-Adresse oder WhatsApp-Link). ShowCube rechnet aus dem Zeitplan aus, wie oft eine Anzeige am Tag
   laufen würde, und schreibt die Zahl auf die Folie. Sie läuft nur, solange weniger Partner gebucht sind, als der Laden
   Plätze hat (Standard: 3).
3. **Partner anlegen:** Name, Ansprechpartner und eine Notiz zur Abmachung (nur für den Laden).
   Dann die Folie:
   - **Anzeige:** Firma, Überschrift, Text, Link für den QR-Code, Bild und die Farbe des Partners. Hat der Partner eine
     fertige Anzeige, nur das Bild hochladen und die Überschrift leer lassen. Dann zeigt die Folie nur das Bild.
   - **Eigene Vorlage** aus dem Vorlagen-Designer, wenn der Laden eine Marke hat.

   Jede Anzeige trägt oben rechts ein kleines Schild „Anzeige“, damit Werbung als solche erkennbar ist.
4. **Sendezeit:** „Jede N. Folie“ (3 bis 12), Tageszeit, Laufzeit von/bis und Wochentage, dazu die Slideshows, auf
   denen der Partner läuft. Das Panel zeigt gleich, wie oft das am Tag ungefähr ist.
5. **Bericht schicken:** „Bericht-Link“ kopiert einen Link, den der Partner ohne Konto öffnen kann. „Ansehen“ öffnet ihn.
6. **Abrechnen:** Macht der Laden selbst. ShowCube nimmt keine Provision und verschickt keine Rechnungen.

Pausieren (Auge) und Löschen gehen direkt auf der Karte, Rückgängig im Hinweis unten. Jede Änderung an Partnern geht
sofort an die Bildschirme: Das Panel legt dafür für jede veröffentlichte Slideshow einen neuen Stand an.

## Für den Partner: der Bericht

`release/bericht.html` zeigt Einblendungen gesamt, Sendezeit, Schnitt pro Tag, ein Balkendiagramm pro Tag (auch als
Tabelle), die Zahlen pro Bildschirm, ein Vorschaubild der Anzeige und einen CSV-Download. Unten ein kleiner Hinweis
auf ShowCube: Partner sind selbst Geschäftsleute und damit Interessenten.

Die Zahlen stecken **im Link selbst** (nach dem `#`, Base64-JSON, Format `Bericht` in `shared/werbung.ts`).
Der Teil nach `#` geht an keinen Server. Deshalb braucht der Bericht kein Login und keinen Server, zeigt aber den Stand
von dem Moment, in dem der Link erstellt wurde. Für neuere Zahlen schickt der Laden einen neuen Link. Mit Vorschaubild
ist der Link etwa 10 bis 12 KB lang. Mail und WhatsApp kommen damit klar.

In der Demo steht im Bericht deutlich „Beispielwerte“. „Von den Boxen gezählt“ steht nur mit Konto und nur, wenn
jede Box ihre Zahlen selbst gemeldet hat.

## Wie es technisch läuft

| Teil | Wo |
| --- | --- |
| Datenmodell im Panel (`werbung`: an/aus, Plätze, freier Platz, Partner mit Kontakt und Abmachung) | `panel/main.ts`, mit Konto in `betriebe.einstellungen.werbung` (kein neues Feld in der Datenbank) |
| Was zur Box reist | `config.werbung` im Paket: nur Name, Takt, Zeitraum und Folie. Kontakt und Abmachung bleiben im Panel. |
| Mischen in die Schleife | `mischen()` in `shared/werbung.ts`, gleich in Player und Panel-Vorschau. „Jede 5. Folie“ heißt: nach je 4 normalen Folien kommt der Partner. Mehrere Partner laufen versetzt. |
| Folien „Anzeige“ und „Werbeplatz frei“ | `shared/bausteine.ts` (Arten `anzeige` und `werbeplatz`). Im normalen Reiter „Bausteine“ tauchen sie nicht auf. |
| Zählen | Der Player zählt jede Partner-Folie pro Tag (letzte 62 Tage, `localStorage`) und meldet das mit dem Herzschlag (`werbung` im Zustand). Ohne Box-Zahlen rechnet das Panel aus Zeitplan und Takt hoch. |
| Bericht | `bericht/` → `release/bericht.html` |

## Was bewusst fehlt (später)

- **Bericht live statt Momentaufnahme:** eine Tabelle `partner_berichte` mit zufälligem Schlüssel und eine Funktion
  `partner_bericht(schluessel)` (security definer), die die gemeldeten Zahlen der Boxen liefert. Dann bleibt der Link
  gleich und zeigt immer den neuesten Stand. Noch nicht angelegt.
- **Geld über ShowCube** (Partner bucht und zahlt online, ShowCube behält einen Anteil): erst, wenn Läden die Funktion
  wirklich nutzen. Bringt Recht, Steuern und Buchhaltung mit.
- **Netzbetreiber als Kunden** (ein Vermarkter wie markt-displays mit vielen Läden): eigene Stufe, später.
- **Reichweite in Kontakten** (wie viele Menschen sahen hin): bräuchte Kamera oder Zählung, bewusst nicht.

## Vorher testen

In der Panel Research (`marktforschung/panel-research.md` im Projektordner) bei den nächsten Läden fragen:
„Würdest du Sendezeit auf deinem Bildschirm an Nachbarn vermieten? An wen, und für wie viel?“ Der Döner-Laden aus
dem ersten Eintrag ist ein gutes Beispiel, wo der Kern („Preise schnell ändern“) schwach zieht, Mit-Verdienen aber
interessant sein könnte.
