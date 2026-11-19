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

Freie Gestaltung mit Text, Fläche, Kreis, Bild, Logo und QR-Code. Pro Element:

- Lage und Größe, eigene Fassung für hochkant möglich.
- Farbe als **Rolle der Marke** (Hauptfarbe, Zweitfarbe, Dunkel, Hell) oder als feste Farbe.
- Schrift als Rolle (Titel, Text). Zu langer Text wird kleiner, nie abgeschnitten.
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

Startpunkte unter „Neue Vorlage anlegen“: Angebot groß, Foto mit Botschaft, Termin und QR, Willkommen.
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
  Zeichnen, Animationen, Startpunkte), `designer/` (App).

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
- Videos als Element einer Vorlage fehlen noch.
- Übergang „Schieben“/„Zoomen“ auf dem Pi 5 testen (CSS-Transform, sollte flüssig laufen).
