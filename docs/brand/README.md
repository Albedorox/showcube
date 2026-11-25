# ShowCube Brand-Guidelines

Hier steht, wie ShowCube aussieht und klingt. Alles ist aus dem abgeleitet, was es schon gibt (Startseite,
Vorschaltseite „Bald da“, Panel, Player). Wer etwas Neues gestaltet, ob Flyer, Messestand, Folie, Mail oder App-Bildschirm,
richtet sich danach.

Zum Ansehen gibt es die **CI-Mappe** als Seite: [ci-mappe.html](ci-mappe.html) im Browser öffnen (aus dem
heruntergeladenen Repo, die Seite holt Logos und Schriften aus den Nachbarordnern). Die Logos liegen in [logo/](logo/).

Diese Seite gilt für die Marke **ShowCube** selbst. Die Marke eines Kunden (sein Logo, seine Farben auf seinen Folien)
regelt der Vorlagen-Designer, siehe [../vorlagen-designer.md](../vorlagen-designer.md).

## 1. Die Marke in einem Satz

ShowCube ist die kleine Box, die aus jedem Fernseher einen Verkäufer macht. Einstecken, fertig: **Plug & Show**.

- **Für wen:** kleine Betriebe ohne Technik-Abteilung: Gastro, Läden, Makler, Praxen.
- **Versprechen:** Der Bildschirm ist immer aktuell, und das kostet dich Sekunden statt Nachmittage.
- **Haltung:** einfach, ehrlich, nahbar. Wir sind der kompetente Kollege, nicht der Konzern.
- **Was uns trägt:** läuft auch ohne Internet, Server in Deutschland, keine Google-Dienste, faire Preise.

## 2. Logo

Das Logo besteht aus dem **Zeichen** (der Würfel) und der **Wortmarke** „ShowCube“.

Das Zeichen ist ein abgerundetes Quadrat in ShowCube-Grün mit einem kleinen weißen Quadrat in der Mitte. Es steht
für beides zugleich: die Box selbst und den Bildschirm, auf dem etwas läuft. Die untere Kante ist etwas dunkler,
der Würfel „steht“ also, das ist gewollt.

### Aufbau (Raster 100)

| Teil | Maß |
| --- | --- |
| Würfel | 100 × 100, Ecken 26,7 (also gut ein Viertel der Kante) |
| Innenquadrat | 36 × 36, genau mittig, Ecken 10 |
| Dunkle Kante unten | unterste 10, Schwarz mit 18 % Deckkraft |
| Logo quer | Zeichen 100, Abstand 33, Wortmarke in Schriftgröße 73 (wie im Kopf der Startseite: 30 px, 10 px, 22 px) |
| Wortmarke | Bricolage Grotesque, Stärke 800, Laufweite −2 %, als Pfade (braucht keine Schrift) |

### Dateien in `logo/`

| Datei | Wofür |
| --- | --- |
| `showcube-logo.svg` | Standard auf hellem Grund (Papier oder Weiß) |
| `showcube-logo-dunkel.svg` | auf dunklem Grund (Tiefgrün, Dunkelmodus): Würfel in Mint, Schrift hell |
| `showcube-logo-verlauf-weiss.svg` | auf Tiefgrün, wenn der Würfel wie auf der Vorschaltseite leuchten soll |
| `showcube-logo-gestapelt.svg`, `…-gestapelt-weiss.svg` | hochkant: Zeichen über der Wortmarke, z. B. Vorschaltseite, Aufkleber, Gehäuse |
| `showcube-logo-schwarz.svg`, `…-weiss.svg` | einfarbig: Stempel, Gravur, Fax, Zeitung, Druck in einer Farbe |
| `showcube-zeichen.svg` | nur der Würfel, flach (Kopfzeilen, kleine Größen) |
| `showcube-zeichen-verlauf.svg` | nur der Würfel mit Verlauf und Schatten (groß: App-Icon, Vorschaltseite, Messewand) |
| `showcube-zeichen-mint.svg` | nur der Würfel für dunkle Flächen |
| `showcube-zeichen-schwarz.svg`, `…-weiss.svg` | nur der Würfel, einfarbig, Innenquadrat ausgespart |
| `png/` | dieselben als PNG (Zeichen 512 und 1024 px, Logos 1200 px breit) für Programme ohne SVG |

Die SVGs entstehen mit `scripts/marke-logos.py` aus der Schrift im Repo. Wer das Logo ändert, ändert das Skript und
lässt es neu laufen, statt die SVGs von Hand zu bearbeiten. Die PNGs macht danach `node scripts/marke-png.mjs`.

### Regeln

- **Schutzraum:** rund ums Logo mindestens die Breite des Innenquadrats frei lassen (36 % der Würfelkante).
- **Mindestgröße:** Zeichen 16 px (Favicon), Logo quer 96 px breit am Bildschirm, 25 mm im Druck.
- **Untergrund:** auf Papier `#f6f5f1`, Weiß oder Tiefgrün `#0f2a25`. Auf Fotos nur auf einer ruhigen, dunklen oder hellen
  Stelle, sonst die einfarbige Version.
- **Nicht:** verzerren, drehen, umfärben (kein Rot, kein Blau), Schatten oder Kontur hinzufügen, das Innenquadrat
  verschieben oder vergrößern, die Wortmarke in einer anderen Schrift setzen, „Showcube“ oder „Show Cube“ schreiben.
- **App-Icon:** Das Zeichen auf eigener Fläche, so wie im Kopf des Panels. Quelle ist `pwa/icon.svg`, die Bilder
  macht `scripts/pwa-bilder.mjs`. Der Würfel muss dort dieselben Proportionen haben wie hier.

### Schreibweise

**ShowCube**, ein Wort, S und C groß. Im Satz: „mit ShowCube“, „deine ShowCube-Box“, „ShowCube Cloud“ (die Panel-App).
Der Claim heißt **Plug & Show**, mit &-Zeichen, in Versalien gesetzt: PLUG & SHOW.

## 3. Farben

ShowCube ist grün. Ein ruhiges, tiefes Petrol-Grün als Hauptfarbe, Mint als heller Akzent für dunkle Flächen, dazu
warmes Papier statt kaltem Weiß. Die Werte stehen so in den Apps (CSS-Variablen in `index.html`, `panel/index.html`,
`bald/index.html`). Ein Test (`tests/marke.spec.ts`) passt auf, dass diese Seite und die Apps übereinstimmen.

### Markenfarben

| Name | Hex | RGB | Variable | Wofür |
| --- | --- | --- | --- | --- |
| ShowCube-Grün | `#0b7a67` | 11 122 103 | `--accent` | Hauptfarbe: Logo, Knöpfe, Links, Haken |
| Grün dunkel | `#096555` | 9 101 85 | `--accent-hover` | Hover, untere Verlaufsfarbe |
| Grün hell | `#0e8a75` | 14 138 117 | | obere Verlaufsfarbe (Würfel groß, App-Icon) |
| Mint | `#46c9b0` | 70 201 176 | `--mint` | Akzent auf Dunkel, Claim, Fokus-Rahmen, Hauptfarbe im Dunkelmodus |
| Tiefgrün | `#0f2a25` | 15 42 37 | `--deep` | dunkle Bereiche, Vorschaltseite, Fußzeile |
| Tiefgrün dunkel | `#0b1f1b` | 11 31 27 | | Verlauf nach außen auf Tiefgrün |
| Grün zart | `#dcf0ea` | 220 240 234 | `--accent-soft` | Hinterlegungen, Plaketten, gewählte Zeilen |

### Neutrale Farben

| Name | Hell | Dunkelmodus | Variable |
| --- | --- | --- | --- |
| Papier (Hintergrund) | `#f6f5f1` | `#0d1110` | `--bg` |
| Fläche (Karten) | `#ffffff` | `#151a19` | `--surface` |
| Fläche 2 | `#efede7` | `#1c2322` | `--surface-2` |
| Linie | `#e2dfd6` | `#252e2c` | `--line` |
| Tinte (Text) | `#14181a` | `#e9efed` | `--ink` |
| Gedämpft (Nebentext) | `#56605c` | `#9aa7a3` | `--muted` |

### Signalfarben (nur im Panel)

| Name | Hell | Dunkel | Wofür |
| --- | --- | --- | --- |
| Gut | `#17794d` | `#4fca86` | läuft, online |
| Warnung | `#a65f00` | `#f0b25a` | bald, prüfen |
| Fehler | `#b3261e` | `#f1776c` | aus, Ausfall, löschen |
| Tag | `#e9a23b` | | Zeitplan „Tag“ |
| Abend | `#4b57b8` | | Zeitplan „Abend“ |

### Kontrast (WCAG)

| Kombination | Verhältnis | Ergebnis |
| --- | --- | --- |
| Weiß auf ShowCube-Grün | 5,3 : 1 | AA, auch für normalen Text |
| ShowCube-Grün auf Papier | 4,8 : 1 | AA |
| Tinte auf Papier | 16,4 : 1 | AAA |
| Gedämpft auf Papier | 6,0 : 1 | AA |
| Mint auf Tiefgrün | 7,4 : 1 | AAA |
| Fast-Schwarz `#0b1312` auf Mint | 9,2 : 1 | AAA (Knöpfe auf Dunkel) |
| Mint auf Weiß | 2,1 : 1 | **nicht für Text.** Mint gehört auf dunklen Grund. |

### Verteilung

Viel Papier und Weiß, Text in Tinte, Grün sparsam und gezielt: ein Hauptknopf pro Bereich, Haken, Hervorhebungen.
Faustregel 70 % Papier/Weiß, 20 % Tinte und Grau, 10 % Grün. Tiefgrün für ganze Bereiche (Fußzeile, Vorschaltseite,
Messewand), dann mit Mint als Akzent.

## 4. Schrift

Zwei Schriften, beide unter der SIL Open Font License 1.1, frei auch für Druck und Werbung. Sie liegen im Repo
(`assets/fonts/`, `shared/fonts.css`), werden nie von Google Fonts geladen (DSGVO).

| Schrift | Rolle | Stärken | Merkmale |
| --- | --- | --- | --- |
| **Bricolage Grotesque** | Überschriften, Wortmarke, große Zahlen und Preise | 800 (Hero, Logo), 700 (Zwischentitel) | Laufweite −1 bis −2,5 %, Zeilenhöhe 1,0–1,2, „ausgeglichen“ umbrechen |
| **Figtree** | Fließtext, Knöpfe, Formulare, Beschriftungen | 400 (Text), 600 (Navigation), 700 (Knöpfe, Labels) | Zeilenhöhe 1,5–1,6 |

Ersatz, falls die Schrift fehlt (Office, Mail): Segoe UI, sonst Arial.

### Größen (Startseite)

| Element | Schrift | Größe |
| --- | --- | --- |
| Hero-Überschrift | Bricolage 800 | 38–64 px, Laufweite −2,5 % |
| Abschnittstitel | Bricolage 800 | 30–44 px |
| Kartentitel | Bricolage 700 | 18–20 px |
| Einleitung (Lead) | Figtree 400 | 20 px, gedämpft |
| Fließtext | Figtree 400 | 17 px |
| Kicker, Labels | Figtree 700 | 12–14 px, Versalien, Laufweite +7 % |
| Claim „PLUG & SHOW“ | Figtree 700 | Versalien, Laufweite +22 %, Mint |

## 5. Form und Bausteine

- **Runde Ecken überall**, wie beim Würfel. Knöpfe 12 px (klein 10 px), Karten 14 px, Felder 9 px, Plaketten ganz rund.
- **Knöpfe:** Hauptknopf grün mit weißer Schrift, 50 px hoch auf der Startseite; zweiter Knopf weiß mit Linie,
  beim Drüberfahren grüner Rand. Pro Bereich höchstens ein grüner Knopf.
- **Plaketten (Eyebrow):** Grün zart als Fläche, ShowCube-Grün als Schrift, ganz rund.
- **Haken:** „✓“ in Grün vor kurzen Vorteilen („Läuft auch ohne Internet“).
- **Schatten:** weich und weit, nie hart. Karten fast flach, schwebende Teile (Fernseher, Handy, Fenster) mit tiefem Schatten.
- **Fokus:** 2–3 px Rahmen in Mint oder Grün, immer sichtbar für die Tastatur.
- **Symbole:** Linien-Icons, 24er-Raster, Strich 1,8, runde Enden. Keine gefüllten oder bunten Icons.
- **Hell und dunkel:** Jede Oberfläche gibt es in beiden Modi. Im Dunkelmodus wird Mint zur Hauptfarbe.
- **Bewegung:** ruhig und kurz (0,15–0,3 s). Der Würfel darf schweben. Bei „Bewegung reduzieren“ hören Deko-Animationen auf,
  Inhalte (Folien) laufen weiter.

## 6. Bildsprache

- **Echte Situationen:** Fernseher in einer Pizzeria, im Schaufenster, beim Makler. Der Bildschirm zeigt echte Folien
  (am besten aus dem Player), keine erfundenen Hochglanz-Oberflächen.
- **Warm und nahbar:** Tageslicht, echte Läden, keine Stockfotos von Anzugträgern im Großraumbüro.
- **Geräte:** Fernseher mit schmalem schwarzen Rand, Handy mit dünnem Rahmen, unverzerrt.
- **Beispielbetriebe** dürfen Fantasienamen tragen („Pizzeria Da Marco“), aber keine echten Marken.

## 7. Sprache (Tone of Voice)

ShowCube redet wie ein freundlicher Profi am Tresen: klar, direkt, ohne Fachchinesisch.

- **Du**, nie Sie. Auch im Panel und in Mails.
- **Ganze Sätze**, kurz. Lieber zwei Sätze als ein Schachtelsatz.
- **Nutzen vor Technik:** „Preise änderst du in Sekunden, vom Handy aus“ statt „Cloud-basiertes Content-Management“.
- **Deutsche Wörter**, wo es sie gibt: Bildschirm statt Display, Folie statt Slide, Vorlage statt Template,
  Zeitplan statt Scheduling. Eingeführte Begriffe bleiben (Digital Signage, App, QR-Code).
- **Ehrlich:** keine Superlative ohne Beleg, keine Fantasie-Zahlen, Grenzen offen sagen („Wetter braucht Internet“).
- **Knöpfe sagen, was passiert:** „Kostenlose Demo ansehen“, „Live schalten“, „Testbox anfragen“, nicht „Weiter“ oder „OK“.
- Keine Ausrufezeichen-Ketten, keine Emojis in Texten für Kunden.

### Kernsätze

- „Dein Fernseher wird zum besten Verkäufer.“
- „Ein Bildschirm verkauft nur, wenn er aktuell ist.“
- „Anstecken, fertig.“
- „Plug & Show“

### So und nicht so

| So | Nicht so |
| --- | --- |
| Preise änderst du in Sekunden selbst, vom Handy aus. | Mit unserer innovativen Cloud-Lösung managen Sie Ihren Content effizient. |
| Läuft auch ohne Internet. | 100 % Offline-Fähigkeit dank Edge-Computing. |
| Der Bildschirm ist aus. Wir haben dir eine Mail geschickt. | Fehler 503: Gerät nicht erreichbar. |

## 8. Ansprechpartner und Kontakt

- Website: https://showcube.de
- E-Mail: hallo@showcube.de (Interessenten), info@showcube.de (allgemein)
- Domain, Postfächer und Hosting: Hostinger, siehe [../deployment.md](../deployment.md)
