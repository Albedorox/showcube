# ShowCube

Plug & Show: ein einfaches, bezahlbares Digital-Signage-System für kleine Betriebe
(Gastro, Läden, Makler, Praxen). Eine kleine Box am Fernseher zeigt Angebote,
Speisekarten oder Objekte, gesteuert nach Tageszeit, auch ganz ohne Internet.

## Stand

Frühe Prototypen in TypeScript. Player, Cloud-Panel und Konfigurator teilen sich die
Folien-Vorlagen und die Schriften. Wie die Teile zusammenhängen:
[docs/wie-alles-zusammenhaengt.md](docs/wie-alles-zusammenhaengt.md). Der Build macht aus jedem eine einzelne HTML-Datei, die ohne
Internet läuft.

| Ordner | Was | Status |
| --- | --- | --- |
| `player/` | Player v0: läuft im Vollbild auf der Box, offline, mit Vorlagen, eigenen Bildern und Videos und Zeitplan (Tag, Abend, Bildschirm aus). Einstellungen mit Taste `E`. | Prototyp, im Browser getestet, noch nicht auf einem Raspberry Pi |
| `panel/` | Cloud-Panel: Bildschirme mit Fernwartung, Preistabelle mit „heute aus“, Sofort-Hinweis auf alle Bildschirme, Zeitplan mit Ruhetagen, Versionen zum Zurückholen, Medien, Vorlagen, Befehlsleiste (Strg + K), hell/dunkel, fürs Handy gebaut. „Live öffnen“ startet einen echten Player im zweiten Tab, der die Inhalte bekommt. | Klick-Prototyp ohne Server |
| Bausteine | Zusatzfolien für jede Slideshow: echter QR-Code, Google-Bewertungen mit Bewerten-QR, Countdown-Aktion. Jede Folie und jedes Medium kann einen Zeitraum haben (ab, bis, Wochentage) und verschwindet danach von selbst. Infoleiste unten mit Laufband, Uhr und Wetter (Open-Meteo, ohne Konto). Im Panel: Wiedergabe-Nachweis pro Bildschirm mit CSV-Bericht und Meldung bei Ausfall. Code in `shared/bausteine.ts`. | Prototyp, Wetter braucht Internet auf der Box |
| `konfigurator/` | Schaufenster-Konfigurator für den Vertrieb: Foto vom Schaufenster, Bildschirm perspektivisch hineinmontieren, Vorher/Nachher, Postkarte A6. | Prototyp |
| `shared/` | Gemeinsame Folien-Vorlagen, Schriften und das Paket-Format zwischen Panel und Player (Bricolage Grotesque, Figtree; beide OFL 1.1). | |
| `release/` | Fertig gebaute Einzeldateien `player.html`, `panel.html` und `konfigurator.html`. | wird bei jedem Build erneuert |
| `docs/` | Anleitungen, z.B. Testbox einrichten. | |

## Ausprobieren

Ohne etwas zu installieren: den Ordner `release/` herunterladen und eine der Dateien im
Browser öffnen. Schriften und Vorlagen stecken in der Datei.

Cloud-Panel ausprobieren: `release/panel.html` öffnen, bei einem Bildschirm „Live öffnen“
klicken, dann unter „Slideshows“ einen Preis ändern und veröffentlichen. Der Player im
anderen Tab zeigt die Änderung sofort. Dafür müssen `panel.html` und `player.html` im
selben Ordner liegen.

Für eine Testbox auf einem Raspberry Pi 5: siehe [docs/testbox-einrichten.md](docs/testbox-einrichten.md).

## Entwickeln

Voraussetzung ist Node.js ab Version 20.

```
npm install
npm run dev                # alle Apps, dann /panel/, /player/, /konfigurator/ öffnen
npm run dev:player         # Player mit Live-Vorschau
npm run dev:konfigurator   # Konfigurator mit Live-Vorschau
npm run build              # Typprüfung, dann release/*.html neu bauen
```

Nach Änderungen `npm run build` ausführen und `release/` mit einchecken.

## Geplante Stufen

- **Light:** offline, Inhalte per USB-Stick, einmaliger Kauf.
- **Cloud:** Web-Panel, Zeitpläne, Status der Bildschirme, Abo pro Bildschirm.
- **Pro:** mehrere Nutzer und Standorte, Integrationen, API.

Eine Codebase für alle Stufen; eine Lizenz auf der Box schaltet die Funktionen frei.

## Bekannte Baustellen

- „Bildschirm aus“ zeigt nur Schwarz. Echtes Ausschalten des Fernsehers per HDMI-CEC fehlt noch.
