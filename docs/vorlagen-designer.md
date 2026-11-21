# Vorlagen-Designer: Folien im CI des Kunden

Frage aus dem Vertrieb: „Die Folien bauen sich von selbst. Sind die dann auch im CI des Kunden,
und kann er Design und Animation selbst einstellen?“ Antwort: ja, in zwei Stufen.

## 1. Marke (für alle)

Logo hochladen, Haupt- und Zweitfarbe kommen automatisch aus dem Logo, dazu Dunkel und Hell.
Alternativ ein vordefiniertes Farbset wählen. Jede Farbe bleibt frei wählbar (Farbwähler oder Hex-Wert). Dazu kommen
zwei Schriften (fünf mitgelieferte oder eine eigene Datei) und der Übergang zwischen den Folien
(Überblenden, Schieben, Zoomen, harter Schnitt, mit Dauer). Der Designer zeigt den Kontrast, damit
die Speisekarte lesbar bleibt.

Die Marke gilt sofort für **alles**: Branchenvorlagen (Menütafel, Objekte, Angebote), Bausteine
(QR, Bewertungen, Countdown) und eigene Vorlagen. Ohne Marke sieht alles aus wie bisher.
Mit Marke bekommt die Menütafel einen weichen Schein in der Hauptfarbe, und die Angebotsfolie zeigt statt der Pizza
ein langsam drehendes Muster aus abgerundeten Quadraten in den Markenfarben. So läuft auch der Fernseher auf der Startseite.

## 2. Eigene Vorlagen (Kunde selbst oder Agentur)

Freie Gestaltung mit Text, Fläche, Kreis, Bild, Video, Logo und QR-Code. Pro Element:

- Lage und Größe, eigene Fassung für hochkant möglich. Rechts steht beides klar getrennt: **Position** mit X
  (Abstand vom linken Rand) und Y (Abstand vom oberen Rand) der oberen linken Ecke, darunter **Größe** mit Breite
  und Höhe. Alles in Prozent der Folie, so passt die Vorlage auf jeden Bildschirm.
- Farbe als **Rolle der Marke** (Hauptfarbe, Zweitfarbe, Dunkel, Hell) oder als ganz eigene Farbe: Dafür gibt es
  neben den vier Markenfarben den beschrifteten Knopf **„Eigene Farbe“**, der den Farbwähler öffnet. Über den Feldern
  steht, was gerade gilt, z. B. „Schriftfarbe: Hell“ oder „Füllfarbe: Eigene Farbe #00aa44“. Das gilt bei Text,
  Fläche, Kreis, QR-Code und beim Hintergrund der Vorlage.
- Schrift als Rolle (Titel, Text). Zu langer Text wird kleiner, nie abgeschnitten.
- **Bild**: Unter „Anzeige“ wählst du „Ganz zeigen“ (das ganze Bild ist zu sehen, freie Ränder bleiben leer) oder
  „Füllen“ (füllt die Fläche, überstehende Ränder werden abgeschnitten). Ein neues Bild-Element und jedes Bild, das du
  in ein Element ohne eigene Einstellung hochlädst, starten mit „Ganz zeigen“, damit nichts überraschend abgeschnitten
  ist. Für ein Foto über die ganze Folie stellst du danach auf „Füllen“. Freigestellte Bilder (PNG, WebP, GIF oder SVG
  mit durchsichtigem Hintergrund) bleiben durchsichtig und liegen frei auf der Folie. Fotos ohne durchsichtige Stellen
  werden als JPEG gespeichert, das hält das Markenpaket klein (`shared/bild.ts`, gilt auch für Bilder im Panel).
- **Hinterlegter Text** (bei Text unter „Hinterlegt“): Jede Zeile bekommt eine Farbfläche, so breit wie die Zeile,
  wie ein Textmarker oder Störer, zum Beispiel weiße Schrift auf der Hauptfarbe. Zur Wahl stehen bewusst nur die
  vier Farben der Marke, keine freie Farbe, damit es im CI bleibt. Die Flächen schließen ohne Lücke aneinander an
  und folgen der Ausrichtung (links, Mitte, rechts). Hat die Schrift dieselbe Farbe wie die Fläche, stellt der Designer
  sie auf Hell oder Dunkel um, je nachdem was besser lesbar ist. Gilt auch für Text, den der Kunde im Panel einträgt,
  und läuft so auf der Box.
- **Mehrere Elemente auf einmal**: Element anklicken, dann mit Umschalt oder Strg (Mac: Cmd) + Klick weitere dazu
  nehmen, z. B. den Kreis und den Preis darauf. Oder auf freier Fläche einen Rahmen aufziehen, gewählt wird, was ganz
  darin liegt. Auch in der Zeitleiste geht Umschalt/Strg + Klick, praktisch für Elemente, die ganz verdeckt sind.
  Die Gruppe hat einen gestrichelten Rahmen, Ziehen bewegt alle zusammen (eingerastet wird die Mitte der Gruppe),
  ebenso die Pfeiltasten. Rechts stehen die gewählten Elemente, die Position der Gruppe, Verdoppeln und Löschen für
  alle. Umschalt/Strg + Klick auf ein gewähltes Element nimmt es wieder heraus, ein normaler Klick darauf wählt nur
  noch dieses, Esc hebt die Auswahl auf, Strg + A wählt alles.
- Animation mit Start und Dauer: Einblenden, von unten/links/rechts, Heranzoomen, Aufploppen,
  Schreibmaschine, Pulsieren, langsamer Zoom fürs Foto. Zeitleiste und „Abspielen“ im Designer.
- Zeitleiste zum Arrangieren: Jedes animierte Element hat einen Balken mit Sekunden-Skala. Balken ziehen
  verschiebt den Start, an der linken oder rechten Kante ziehen ändert Start oder Dauer (Raster 0,1 s).
  Beim Ziehen steht die Zeit über dem Balken, die Felder „Start nach“ und „Dauer“ rechts laufen mit, danach
  spielt die Vorschau die Folie einmal ab. Umgekehrt folgen die Balken sofort, wenn du die Felder änderst.
  Mit der Tastatur: Balken anwählen, Pfeil links/rechts verschiebt, mit Umschalt ändert er die Dauer.
  Pulsieren und langsamer Zoom laufen bis zum Folienende, dort lässt sich nur der Start ziehen.
- Ebenen in der Zeitleiste sortieren: Die Zeitleiste zeigt alle Elemente als Ebenen, oben liegt vorn
  (Nummer 1 = ganz vorn). Am Griff links in der Zeile ziehen und loslassen ändert die Reihenfolge, auch per
  Finger auf Handy und Tablet. Der Griff ist bewusst getrennt vom Zeitbalken, damit Sortieren und Zeit ziehen
  sich nicht in die Quere kommen. Mit der Tastatur: Griff anwählen, Pfeil hoch bringt die Ebene nach vorn,
  Pfeil runter nach hinten. Die Knöpfe „Nach vorn“ und „Nach hinten“ rechts gibt es weiterhin. Die Reihenfolge
  gilt für Quer- und Hochkant-Fassung gleich, Strg + Z macht sie rückgängig. Elemente ohne Animation stehen
  mit einer gestrichelten Bahn („immer sichtbar“) in der Liste.
- **„Kunde darf das im Panel ausfüllen“**: macht das Element zu einem Feld (z. B. „Preis“, „Foto“).
  Alles andere bleibt gesperrt. So bleibt das CI sauber und der Kunde ändert trotzdem selbst den Preis.
- **Video-Ebene** (Knopf „Video“): eine Fläche für einen fertig produzierten Film, z. B. vom Grafiker oder der
  Agentur, mit Logo, Preis oder Text darüber. Sie liegt wie jede Ebene in der Zeitleiste, lässt sich animieren
  (Einblenden, Heranzoomen …) und hat „Füllen“ oder „Ganz zeigen“ und runde Ecken. Den Film wählt immer der
  Kunde im Panel aus seinen Medien (MP4 oder WebM), darum ist die Ebene immer ein freies Feld. So bleibt das
  Markenpaket klein. Zum Ausprobieren im Designer gibt es „Testfilm wählen“, der Testfilm wird nicht gespeichert.
  Auf der Box läuft der Film stumm, die Folie startet ihn von vorn und dauert so lange wie der Film.

Startpunkte unter „Neue Vorlage anlegen“: Angebot groß, Foto mit Botschaft, Termin und QR, Willkommen.
Ganz oben steht **„Aus Bild erzeugen“ (Pro)**: ein vorhandenes Plakat, einen Flyer oder eine alte Folie hochladen und
daraus eine Vorlage mit Ebenen machen lassen. SVG-Dateien gehen ohne KI, Bilder (PNG, JPEG, WebP) liest die KI.
Alles dazu in [vorlage-aus-bild.md](vorlage-aus-bild.md).
Darüber stehen die „Vorlagen von …“ des gewählten Kunden. Auf schmalen Bildschirmen (Tablet, Handy) sind beide
Gruppen eigene Kästen mit Überschrift und kurzer Erklärung, die Vorlagen wischst du darin seitlich durch.

## Wie die Teile zusammenhängen

```
designer.html  ──Markenpaket (showcube-marke.json)──►  panel.html (Vorlagen: „Deine Marke“)
   Kunde oder Agentur                                     gespeichert in betriebe.einstellungen.marke
                                                                │  Paket: config.marke + Bausteine der Art „design“
                                                                ▼
                                                          player.html (Box): Farben, Schriften, Übergang, Animationen
```

- Das Markenpaket ist eine JSON-Datei, Logo, Bilder und eigene Schriften stecken als data:-URL darin.
  Dadurch reist alles im Paket mit und die Box zeigt es auch offline.
- Im Panel: „Vorlagen“ zeigt die Marke, „Im Designer bearbeiten“ öffnet den Designer mit ihr,
  „Ins Panel übernehmen“ im Designer bringt sie zurück (gleicher Browser über localStorage, sonst als Datei).
- Im Editor einer Slideshow: unter „Bausteine“ eigene Vorlagen einfügen, dort nur die freien Felder.
  Die Marke lässt sich pro Slideshow abschalten.
- Code: `shared/marke.ts` (Marke, Schriften, Farben aus dem Logo), `shared/design.ts` (Elemente,
  Zeichnen, Animationen, Startpunkte), `designer/` (App), `designer/aus-bild.ts` (Vorlage aus Bild).

## Agenturen als Partner

Im Designer kann eine Agentur mehrere Kunden verwalten (oben umschalten, „Partner-Modus“).
Im Panel gibt es „Agentur einladen“. Im Prototyp wird die Einladung nur vorgemerkt, nichts verschickt.

Rechte, wie geplant:

| | Kunde | Agentur |
| --- | --- | --- |
| Marke gestalten | ja | ja |
| Eigene Vorlagen, Felder freigeben | auf Wunsch | ja |
| Freie Felder ausfüllen | ja | ja |
| Veröffentlichen, Bildschirme, Abo | ja | nein |
| Mehrere Kunden in einer Ansicht | nein | ja |

Nächster Backend-Schritt (noch nicht umgesetzt, nicht eingespielt):

```sql
-- Rolle "agentur" für Mitglieder: darf nur einstellungen.marke schreiben, sonst nur lesen.
alter table public.mitglieder drop constraint mitglieder_rolle_check;
alter table public.mitglieder add constraint mitglieder_rolle_check check (rolle in ('inhaber', 'mitarbeiter', 'agentur'));
create table public.einladungen (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid not null references public.betriebe on delete cascade,
  email text not null, rolle text not null default 'agentur',
  erstellt timestamptz not null default now(), angenommen timestamptz
);
-- Dazu: RPC marke_speichern(b uuid, m jsonb) für Agenturen, RLS auf shows/pakete/bildschirme nur für inhaber/mitarbeiter,
-- E-Mail-Einladung über Supabase Auth (invite), Agentur-Ansicht = Liste der Betriebe mit Rolle agentur.
```

## Offen

- Eigene Schriften: Lizenz für Bildschirmnutzung muss der Kunde haben (Hinweis steht im Designer).
- Große Bilder im Markenpaket machen Pakete schwer. Später als Dateien im Speicher statt data:-URL.
- Video-Ebene: Ton gibt es bewusst nicht (Laden, Wartezimmer). Ein Film, der länger als 10 Minuten läuft, wird abgebrochen.
- Video-Ebene auf dem Pi 5 testen: der Film wird pro Bild auf die Leinwand gemalt. Bei 1080p sollte das flüssig sein, bei 4K eher nicht.
- Übergang „Schieben“/„Zoomen“ auf dem Pi 5 testen (CSS-Transform, sollte flüssig laufen).
