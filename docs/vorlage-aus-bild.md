# Vorlage aus Bild (Pro)

Idee: Ein Betrieb hat schon ein Plakat, einen Flyer, eine alte Folie oder einen Screenshot. Statt die Vorlage im
Designer nachzubauen, lädt er das Bild hoch und bekommt eine Vorlage mit echten Ebenen: Texte als Text, Fotos als Bild,
Kreise und Flächen als Formen. Danach korrigiert er nur noch Kleinigkeiten und gibt Preise oder Überschriften für den
Kunden frei.

Stand: **Prototyp.** Im Designer fertig und getestet. Die KI antwortet erst, wenn auf dem Server der Schlüssel gesetzt
ist (siehe „Einrichten“).

## Geht das ohne KI?

Zum Teil.

| Datei | Ohne KI | Mit KI |
| --- | --- | --- |
| **SVG** (Export aus Illustrator, Figma, Canva, Affinity) | Ja, zuverlässig. Die Datei hat schon Ebenen. Texte, Rechtecke, Kreise und eingebettete Bilder werden direkt gelesen, Lage und Größe im Browser gemessen. Was sich nicht abbilden lässt (Pfade, Verläufe, beschnittene Gruppen), wird ein freigestelltes Bild ganz hinten. | Geht auch, wird dann wie ein Bild gelesen. |
| **PNG, JPEG, WebP** (Foto, Screenshot, flaches Plakat) | Kaum. Texterkennung (OCR) fände die Wörter, aber nicht, was Überschrift, Preis oder Deko ist, und Fotos, Logos und Flächen lassen sich ohne Bildverständnis nicht sauber trennen. Ergebnis wäre eine Rohskizze. | Ja. Das ist der eigentliche Pro-Weg. |
| **PDF** | Noch nicht. Später: Textebene und Bilder auslesen (ähnlich wie SVG). | Erste Seite als Bild. |

Darum: SVG ohne KI für alle, Bilder mit KI im Pro-Plan.

## So läuft es

1. Designer → „Vorlagen“ → unter „Neue Vorlage anlegen“ **„Aus Bild erzeugen“** (mit Pro-Zeichen).
2. Bild oder SVG hineinziehen oder wählen. Links steht das Original.
3. SVG: **„Ebenen übernehmen (ohne KI)“**. Bild: **„Mit KI erkennen“** (dauert meist 20 bis 60 Sekunden).
4. Rechts steht das Ergebnis schon in der Marke des Kunden (Schriften, Farben), mit Animation. Darunter:
   - **Farben wie im Bild** (Farben nahe an der Marke werden zu Markenfarben, der Rest bleibt eigene Farbe) oder
     **In Markenfarben** (alles wird zur nächstliegenden Markenfarbe, gut für Agenturen, die ein fremdes Muster ins CI holen).
   - **Preise, Überschriften und Fotos als Felder freigeben**: Die KI schlägt vor, was der Betrieb regelmäßig ändert.
   - **Animationen vorschlagen**: Elemente fliegen nacheinander ein (Überschrift von unten, Kreis ploppt auf, Foto zoomt).
   - **Texte und Formen aus ausgeschnittenen Fotos entfernen**: Liegt ein Text auf einem Foto, wird er im Foto grob
     übermalt, weil er als eigene Text-Ebene wiederkommt.
   Die Optionen wirken sofort, ohne neue Analyse.
5. **„Als Vorlage übernehmen“**: Die Vorlage steht in der Liste, alle Ebenen in der Zeitleiste. Hochkant-Bilder werden
   gleich als Hochkant-Fassung angelegt.

Angemeldet wird mit dem ShowCube-Konto aus dem Panel: Wer im selben Browser im Panel angemeldet ist, ist es auch im
Designer. Ohne Anmeldung zeigt das Fenster einen Link zum Panel, ohne Pro einen Hinweis auf den Pro-Plan. SVG geht immer.

## Wie es gebaut ist

```
Designer (Browser)                          Supabase (Frankfurt)                                  Anthropic
─────────────────                           ────────────────────                                  ─────────
Bild verkleinern (max. 1568 px, JPEG)  ──►  Edge Function vorlage-aus-bild
                                              1. Anmeldung prüfen (keine Box, kein anonymes Konto)
                                              2. ki_analyse_buchen(): Pro? Kontingent frei?
                                              3. Bild + Anleitung + Schema  ─────────────────────►  Claude (Bildverständnis)
                                              ◄──────────────── JSON genau im Schema (Structured Output)
                                              4. Modell und Tokens eintragen (ki_analysen)
Ausschneiden, Farben, Felder,          ◄──  {erkennung, rest}
Animationen → Vorlage
```

- **Edge Function:** `supabase/functions/vorlage-aus-bild/index.ts`. Der KI-Schlüssel liegt nur dort als Secret,
  nie im Browser oder im Repository. Die Funktion fragt Claude mit einem festen JSON-Schema (Structured Output). Die
  Antwort ist damit immer gültiges JSON: Hintergrund, Hausfarben und jedes Element mit Art (Text, Fläche, Kreis, Bild,
  Logo, QR-Code), Lage und Größe in Prozent, Text, Zeilenhöhe, Schriftstärke, Ausrichtung, Farben, Vorschlag fürs Feld.
  Lehnt das Modell ab, springt ein anderes ein (Rückfall, `fallbacks: "default"`).
- **Datenbank:** Migration `20261121160000_ki_vorlage.sql`. Tabelle `abos` (Stufe `cloud` oder `pro` pro Betrieb,
  Kontingent `ki_grenze`, Standard 50 im Monat), Tabelle `ki_analysen` (wer, wann, Modell, Tokens). Betriebe können ihre
  Stufe nur lesen, nie selbst setzen. Admins dürfen immer und ohne Grenze. Schlägt eine Analyse fehl, zählt sie nicht.
- **Designer:** `designer/aus-bild.ts` (SVG lesen, KI aufrufen, Ergebnis in eine Vorlage übersetzen) und das Fenster
  in `designer/main.ts`. Fotos und Grafiken werden aus dem Original ausgeschnitten und stecken wie jedes Bild im
  Markenpaket.

## Einrichten (einmalig, etwa 5 Minuten)

Datenbank und Funktion kommen nach dem Merge von selbst auf den Server (Workflow „Backend“). Danach fehlt nur der Schlüssel:

1. Auf [console.anthropic.com](https://console.anthropic.com) anmelden (oder Konto anlegen), unter **Billing** etwas
   Guthaben aufladen (10 € reichen für einige hundert Analysen).
2. **API Keys** → **Create Key**, Name `showcube-vorlage-aus-bild`, den Schlüssel (`sk-ant-…`) kopieren.
   Er wird nur einmal angezeigt.
3. Im Supabase-Dashboard des Projekts `imrrbyeywegpmqxuinji`: **Edge Functions** → **Secrets** → **Add new secret**,
   Name `ANTHROPIC_API_KEY`, Wert = der Schlüssel, **Save**. Neu ausrollen ist nicht nötig.
4. Testen: Im Panel anmelden (als Admin), Designer öffnen, „Aus Bild erzeugen“, ein Plakat hochladen.

Klappt etwas nicht, steht der Grund im Ergebnisfeld des Fensters. Als Admin siehst du ihn genau:

| Meldung | Bedeutung |
| --- | --- |
| „Die KI ist auf dem Server noch nicht eingerichtet.“ | `ANTHROPIC_API_KEY` fehlt in den Secrets. |
| „Das Guthaben im Anthropic-Konto ist aufgebraucht.“ | Unter **Plans & Billing** in der Anthropic Console aufladen. |
| „Anthropic lehnt den Schlüssel ab.“ | Schlüssel falsch kopiert oder gelöscht: neuen anlegen und das Secret ersetzen. |

Kunden sehen in diesen Fällen nur „Die KI ist gerade nicht erreichbar“. Fehlgeschlagene Versuche kosten nichts und zählen
nicht fürs Kontingent. Den genauen Fehler gibt es auch in Supabase unter **Edge Functions** → `vorlage-aus-bild` → **Logs**.

Optional, ebenfalls als Secret:

| Name | Standard | Wofür |
| --- | --- | --- |
| `KI_MODELL` | `claude-opus-5-5` | Günstiger und schneller: `claude-sonnet-5-5` |
| `KI_AUFWAND` | `medium` | `low` schneller und billiger, `high` genauer bei vollen Plakaten |

Einen Kunden auf Pro stellen (SQL Editor):

```sql
insert into public.abos (betrieb_id, stufe) values ('<betrieb-id>', 'pro')
on conflict (betrieb_id) do update set stufe = 'pro';
-- Anderes Kontingent: update public.abos set ki_grenze = 100 where betrieb_id = '<betrieb-id>';
```

## Kosten

Eine Analyse mit Claude Opus 5.5 braucht grob 2.000 bis 4.000 Tokens Eingabe (Bild und Anleitung) und 3.000 bis 8.000
Tokens Ausgabe (mit Nachdenken). Bei 4 $ pro Million Eingabe und 20 $ pro Million Ausgabe sind das etwa **7 bis 18 Cent**.
Mit Claude Sonnet 5.5 etwa die Hälfte. Wer was verbraucht, steht in `ki_analysen` (Spalten `tokens_ein`, `tokens_aus`).
50 Analysen im Monat kosten also höchstens etwa 9 €, im Alltag deutlich weniger, weil kaum jemand das Kontingent ausschöpft.

## Grenzen im Prototyp

- Schriften: Die Vorlage nimmt die Schriften der Marke, nicht die aus dem Bild. Das ist gewollt (CI), sieht aber anders aus
  als das Original.
- Text auf Fotos wird nur grob übermalt (Durchschnittsfarbe, weichgezeichnet). Saubere Retusche bräuchte einen
  Inpainting-Dienst, das wäre ein nächster Schritt.
- Lage und Größe schätzt die KI. Meist passt es auf wenige Prozent, kleine Korrekturen im Designer sind normal.
- Logos: Hat die Marke ein Logo, wird das erkannte Logo zur Logo-Ebene (zeigt das Markenlogo), sonst wird es ausgeschnitten.
- PDF fehlt noch.
- Echte KI-Antworten laufen in keinem automatischen Test. Die Tests stellen die Antwort nach (`tests/dateien/ki-antwort.json`).
