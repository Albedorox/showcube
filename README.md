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
| `player/` | Player v0: läuft im Vollbild auf der Box, offline, mit Vorlagen, eigenen Bildern und Videos und Zeitplan (Tag, Abend, Bildschirm aus). Videos laufen stumm, ganz oder mit eigener Dauer, auch als Ebene in eigenen Vorlagen. Einstellungen mit Taste `E`. | Prototyp, im Browser getestet, noch nicht auf einem Raspberry Pi |
| `panel/` | Cloud-Panel: Bildschirme mit Fernwartung, Preistabelle mit „heute aus“, Farbe aus Vorschlägen oder frei per Farbwähler, Sofort-Hinweis auf alle Bildschirme, Zeitplan mit Ruhetagen, Versionen zum Zurückholen, Medien (Bilder, MP4, WebM, je mit eigener Dauer in Sekunden), Vorlagen, Befehlsleiste (Strg + K), hell/dunkel, fürs Handy gebaut. „Live öffnen“ startet einen echten Player im zweiten Tab, der die Inhalte bekommt. | Klick-Prototyp ohne Server |
| Bausteine | Zusatzfolien für jede Slideshow: echter QR-Code, Google-Bewertungen mit Bewerten-QR, Countdown-Aktion. Jede Folie und jedes Medium kann einen Zeitraum haben (ab, bis, Wochentage) und verschwindet danach von selbst. Infoleiste unten mit Laufband, Uhr und Wetter (Open-Meteo, ohne Konto). Im Panel: Wiedergabe-Nachweis pro Bildschirm mit CSV-Bericht und Meldung bei Ausfall. Code in `shared/bausteine.ts`. | Prototyp, Wetter braucht Internet auf der Box |
| App (PWA) | Das Panel lässt sich als App installieren: eigenes Icon auf Handy, Tablet und Rechner, Vollbild, startet auch ohne Netz, meldet neue Versionen mit „Neu laden“. Android und Chrome zeigen „App installieren“ oben im Panel, auf dem iPhone erklärt derselbe Knopf den Weg über Teilen. Langes Drücken aufs Icon: Sofort-Hinweis oder Inhalte. Dateien in `pwa/`, der Build legt sie nach `release/`. | Prototyp, Push-Meldungen brauchen erst das Backend |
| Backend | ShowCube Cloud auf Supabase (Frankfurt): Konto und Login im Panel, Slideshows und Dateien auf dem Server, Box koppeln per Code vom Fernseher (`player.html?cloud`), die Box holt sich ihr Paket und meldet sich alle 10 Sekunden. Fernwartung (An/Aus, Neustart, Finden, Foto) und Sofort-Hinweis gehen übers Internet. Pro-Stufe pro Betrieb (Tabelle `abos`) mit KI-Kontingent, Edge Function `vorlage-aus-bild` (Claude, Schlüssel nur als Secret). Code in `supabase/`, `shared/cloud.ts`. Anmeldung mit E-Mail-Bestätigung und optional Zwei-Faktor (Authenticator-App, unter „Konto“ im Panel), Koppel-Codes gelten eine Stunde. **Benutzerverwaltung für Admins** (Bereich „Benutzer“ im Panel): alle Konten mit Abo, letzter Anmeldung, Zwei-Faktor und Boxen, Suche und Filter (Filterwechsel tauscht nur die Liste, ohne Flackern), Abo auf Pro oder Cloud stellen (mit Enddatum und KI-Kontingent), Konto sperren, freigeben, E-Mail bestätigen, löschen, mit Protokoll. Einrichten: [docs/backend.md](docs/backend.md). | Läuft auf Supabase (Projekt imrrbyeywegpmqxuinji, Frankfurt) |
| Partner-Slots | „Dein Bildschirm verdient mit“: der Laden vermietet Sendezeit an Geschäfte aus der Nachbarschaft. Schalter in den Einstellungen (Zahnrad im Panel), standardmäßig aus. Eingeschaltet gibt es den Bereich „Partner“: Anzeige gestalten oder Bild hochladen, „jede N. Folie“, Laufzeit, Slideshows. Der Player mischt die Anzeigen ein und zählt pro Partner und Tag. Die Folie „Werbeplatz frei“ wirbt mit QR-Code um neue Partner, solange Plätze frei sind. Jeder Partner bekommt einen Bericht-Link ohne Login (`release/bericht.html`). Abgerechnet wird ohne ShowCube. Siehe [docs/partner-slots.md](docs/partner-slots.md). | Prototyp, Bericht zeigt den Stand beim Erstellen des Links |
| `designer/` | Vorlagen-Designer: Marke (Logo, Farben aus dem Logo, als Farbset oder frei mit Farbwähler, Schriften, Übergang) für alle Vorlagen und eigene Vorlagen mit Animationen und Video-Ebene (den fertigen Film wählt der Kunde im Panel), die du in der Zeitleiste per Ziehen arrangierst. Dort sortierst du auch die Ebenen per Drag & Drop am Griff. Texte lassen sich in einer Markenfarbe hinterlegen (Farbfläche hinter jeder Zeile). Mehrere Elemente wählst du mit Umschalt oder Strg + Klick oder per aufgezogenem Rahmen und verschiebst sie zusammen. Lage und Größe stehen klar als X, Y, Breite und Höhe da. Felder, die der Kunde im Panel ausfüllen darf, werden freigegeben, der Rest bleibt im CI. Für Kunden und Werbeagenturen (mehrere Kunden). Übergabe ans Panel als Markenpaket. **Vorlage aus Bild (Pro):** Plakat, Flyer oder alte Folie hochladen, daraus wird eine Vorlage mit Ebenen (SVG ohne KI, Bilder mit KI über die Edge Function `vorlage-aus-bild`), siehe [docs/vorlage-aus-bild.md](docs/vorlage-aus-bild.md). Siehe [docs/vorlagen-designer.md](docs/vorlagen-designer.md). | Prototyp, Partner-Zugänge noch ohne Backend, KI braucht den Schlüssel auf dem Server |
| `konfigurator/` | Schaufenster-Konfigurator für den Vertrieb: Foto vom Schaufenster, Bildschirm perspektivisch hineinmontieren, Vorher/Nachher, Postkarte A6. | Prototyp |
| `shared/` | Gemeinsame Folien-Vorlagen, Schriften und das Paket-Format zwischen Panel und Player (Bricolage Grotesque, Figtree; beide OFL 1.1). | |
| `index.html` | Startseite (https://showcube.de, vorerst auch noch auf GitHub Pages): Verkaufsseite für Interessenten mit Branchen, Funktionen, Preisen und häufigen Fragen. Die Links zu Panel, Player und Konfigurator stehen im Footer. `panel.html?demo` öffnet gleich die Demo. Der Fernseher oben zeigt die echten Player-Folien in den ShowCube-Farben (Code in `startseite/demo.ts`, gebaut nach `release/startseite-demo.js`). Für die Preisänderung fliegt ein Handy herein und danach wieder hinaus, damit der Fernseher im Vordergrund bleibt. Schriften und Vorschaubild liegen in `assets/`, `sitemap.xml` ist für die Google Search Console. | Preise sind noch vorläufig |
| Website | Läuft bei Hostinger in zwei Umgebungen: **Stage** https://stage.showcube.de bekommt nach jedem Merge in `main` mit grünen Tests automatisch den neuen Stand, **Prod** https://showcube.de genau diesen Stand per Knopf „Live schalten“ (GitHub Actions). Ohne Quellcode, Tests und Gehäuse-Dateien, Stage ist für Suchmaschinen gesperrt und trägt ein Stage-Schild. Bis zum offiziellen Start zeigt showcube.de nur die Vorschaltseite „Bald da“ mit Logo und Teaser (`bald/index.html`, umschalten in `website.json`). Code in `scripts/website.mjs`, `.github/workflows/stage.yml` und `live.yml`. Siehe [docs/deployment.md](docs/deployment.md). | Stage läuft seit 20.11.2026, showcube.de mit Vorschaltseite |
| Kontakt und Rechtliches | Kontaktformular `kontakt.html` mit Textbausteinen (Testbox, Preise, Rückruf, Agentur, Frage). `kontakt.php` schickt die Anfrage über die Hostinger-Mail-API (signiert, landet im Posteingang) an hallo@showcube.de, Betreff beginnt mit „[Kontaktformular]“, Knopf „Antworten an …“ in der Mail, Spamschutz ohne Captcha. Dazu `impressum.html` und `datenschutz.html`, verlinkt auf Startseite und Vorschaltseite. Siehe [docs/kontaktformular.md](docs/kontaktformular.md). | Läuft auf Hostinger (PHP), auf GitHub Pages ohne Versand |
| `hardware/` | Gehäuse v1 für den Raspberry Pi 5: von vorne ein Würfel (96 × 96 mm), 40 mm tief, Kabel gehen unsichtbar hinten unten raus. Solidcraft-Datei, STEP, STL und 3MF zum Drucken, Bilder und Druckhinweise in [hardware/gehaeuse/LIESMICH.md](hardware/gehaeuse/LIESMICH.md). Wird nicht veröffentlicht (weder bei Hostinger noch auf GitHub Pages, `_config.yml`). | Prototyp, Maße aus dem Datenblatt, noch nicht gedruckt |
| `tests/` | Automatische Regressionstests mit Playwright: die wichtigsten Abläufe von Startseite, Player, Panel, Partner-Slots und Designer im echten Browser, dazu was auf die Website hochgeladen wird, dazu Bildvergleiche. Laufen bei jedem Pull Request auf GitHub (Workflow „Tests“), ohne echtes Backend und mit fester Uhrzeit. Jede neue Funktion bringt ihren Test mit. Siehe [docs/tests.md](docs/tests.md). | 106 Tests, laufen bei jedem PR |
| `release/` | Fertig gebaute Einzeldateien `player.html`, `panel.html`, `konfigurator.html`, `designer.html` und `bericht.html` (Bericht für Werbepartner). | wird bei jedem Build erneuert |
| Marke (CI) | Brand-Guidelines und CI-Mappe für ShowCube selbst: Logo (Würfel und Wortmarke) in allen Varianten als SVG und PNG, Aufbau und Schutzraum, Farben mit Hex/RGB und Kontrast, Schriften, Bausteine, Bildsprache, Tonalität. Regeln zum Nachlesen in [docs/brand/README.md](docs/brand/README.md), zum Ansehen `docs/brand/ci-mappe.html` im Browser öffnen. Logos in `docs/brand/logo/`, neu erzeugen mit `scripts/marke-logos.py` und `scripts/marke-png.mjs`. Ein Test prüft, dass Farben und Würfel-Proportionen zu Startseite, Panel und Vorschaltseite passen. | Stand 24.11.2026 |
| `docs/` | Anleitungen, z.B. Testbox einrichten, Website veröffentlichen. | |

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
npm run dev:designer       # Vorlagen-Designer mit Live-Vorschau
npm run build              # Typprüfung, dann release/*.html neu bauen
npm test                   # alle Tests gegen release/ (vorher bauen), siehe docs/tests.md
npm run backend:start      # lokaler Supabase-Server (braucht Docker), siehe docs/backend.md
npm run backend:test       # prüft Koppeln, Veröffentlichen und Zugriffsregeln
```

Nach Änderungen `npm run build` ausführen, `npm test` laufen lassen und `release/` mit einchecken.
Neue Funktionen bringen ihren Test mit, siehe [docs/tests.md](docs/tests.md).

App-Icon oder Aussehen des Panels geändert? Dann auch die Bilder fürs Installieren neu machen:
`npm run build`, dann `node scripts/pwa-bilder.mjs` (braucht Playwright), dann noch einmal `npm run build`.
Das Icon selbst steht in `pwa/icon.svg`.

Installieren und Offline-Start gehen nur über `https://` (z.B. https://showcube.de) oder `localhost`, nicht beim Öffnen der Datei per Doppelklick.

## Geplante Stufen

- **Light:** offline, Inhalte per USB-Stick, einmaliger Kauf.
- **Cloud:** Web-Panel, Zeitpläne, Status der Bildschirme, Abo pro Bildschirm. Backend: [docs/backend.md](docs/backend.md).
- **Pro:** mehrere Nutzer und Standorte, Integrationen, API.

Eine Codebase für alle Stufen; eine Lizenz auf der Box schaltet die Funktionen frei.

## Bekannte Baustellen

- „Bildschirm aus“ zeigt nur Schwarz. Echtes Ausschalten des Fernsehers per HDMI-CEC fehlt noch.
