# Wie Player, Konfigurator, Light und Cloud zusammenhängen

Kurz: Es gibt **einen Player** auf der Box. Light und Cloud unterscheiden sich nur darin,
**wie die Inhalte auf die Box kommen**. Der Konfigurator ist ein Verkaufswerkzeug, kein Teil der Box.

```
                 ┌──────────────────────────┐
                 │  Cloud-Panel (Browser)   │  Bildschirme, Slideshows, Medien, Vorlagen,
                 │  app.showcube.de         │  Fernwartung. Nur in der Cloud-Stufe.
                 └────────────┬─────────────┘
                              │  Paket (Slideshow + Zeitplan + Dateien)
          Cloud: über Internet│                    Light: als Datei auf dem USB-Stick
                              ▼                                    │
                 ┌──────────────────────────┐                      │
                 │  Player auf der Box      │◄─────────────────────┘
                 │  speichert das Paket,    │
                 │  spielt offline weiter   │
                 └──────────────────────────┘

  Konfigurator: Foto vom Schaufenster + Slideshow des Kunden = Verkaufsbild, Postkarte.
  Lebt auf der Website (Lead-Magnet) und im Panel („Im Schaufenster ansehen“).
```

## Die Teile

| Teil | Wofür | Light | Cloud |
| --- | --- | --- | --- |
| `player/` | Läuft im Vollbild auf der Box. Spielt das zuletzt erhaltene Paket, auch ohne Internet. | ja | ja |
| `panel/` | Das Web-Panel: Inhalte bearbeiten, veröffentlichen, Bildschirme aus der Ferne warten. | nein (nur Export aufs USB-Paket, z.B. durch dich beim Einrichten) | ja |
| `konfigurator/` | Vertrieb: zeigt dem Kunden seinen Laden mit Bildschirm. | Verkaufshilfe | Verkaufshilfe und Vorschau im Panel |
| `shared/paket.ts` | Das Format, das Panel und Player verbindet. Ein Format für beide Stufen. | | |

## Ist der Konfigurator „im Panel“?

Teilweise, und so ist es richtig:

- Die **Vorlagen** (Speisekarte, Objekte, Angebote) sind schon dieselben: sie liegen in
  `shared/templates.ts` und werden von Player, Panel und Konfigurator benutzt.
- Im Panel öffnet **„Im Schaufenster ansehen“** den Konfigurator mit den Texten und Farben
  der gerade bearbeiteten Slideshow. Das ist für Kunden nett, aber kein Kernstück.
- Für die **Offline-Variante (Light)** taugt der Konfigurator nichts: er bringt keine Inhalte auf
  die Box. Er bleibt ein Vertriebswerkzeug, egal welche Stufe der Kunde kauft.

## Empfohlene Reihenfolge

1. **Testbox läuft auf echter Hardware** (#1). Ohne das ist alles andere Theorie.
2. **Paket als gemeinsames Format** festhalten (in diesem Prototyp angelegt). Damit kann der Player
   heute schon ein Paket vom USB-Stick laden: das ist die Light-Stufe (#5).
3. **Panel-Prototyp mit Pilotkunden durchklicken** (Pizzeria, Makler): Was fehlt, was ist zu viel?
4. **Echtes Backend** für die Cloud-Stufe (#8): Konto und Login, Bildschirm koppeln per Code,
   Pakete und Dateien speichern, die Box holt sich neue Pakete und meldet ihren Zustand.
   Gebaut mit Supabase (EU, Frankfurt), siehe [backend.md](backend.md). Das Paket-Format bleibt, nur der Transportweg ändert sich.
5. **Abrechnung** (Stripe) erst, wenn ein Pilot die Cloud-Stufe tatsächlich nutzt.

## Was der Panel-Prototyp echt macht und was gespielt ist

Echt:
- Slideshows aus Vorlagen und eigenen Bildern/Videos zusammenstellen, mit Vorschau Tag/Abend, quer/hoch.
- Preistabelle: eine Zeile pro Eintrag, einzelne Einträge mit dem Auge ausblenden („heute aus“), ohne sie zu löschen.
- Sofort-Hinweis: ein Band über allen Folien, sofort auf den gewählten Bildschirmen, für eine Stunde, heute oder bis er beendet wird.
- Zeitplan mit Ruhetagen, Logo des Betriebs, die letzten acht veröffentlichten Stände zum Zurückholen, Rückgängig nach jedem Löschen.
- Veröffentlichen schickt das Paket an einen **echten Player**, der über „Live öffnen“ in einem
  zweiten Tab läuft. Der Player meldet sich zurück (Folie, Tageszeit, Laufzeit) und reagiert auf
  Bildschirm an/aus, Neustart, Identifizieren und Bildschirmfoto.
- Bausteine (QR-Code, Bewertungen, Countdown) und die Infoleiste reisen im Paket mit (`extras`, `leiste`). Der Player zeigt sie auch offline, nur das Wetter braucht Internet und fehlt sonst einfach.
- Zeiträume (ab, bis, Wochentage) prüft der Player selbst anhand seiner Uhr. Ein Wochenangebot verschwindet also auch ohne Verbindung pünktlich.
- Der Player zählt, wie oft jede Folie heute lief, und meldet das mit dem Herzschlag ans Panel (Fernwartung, „Heute gezeigt“, CSV-Bericht).
- „Für USB-Stick exportieren“ erzeugt `showcube-paket.json`, das der Player unter „Paket laden“ einliest.

Mit Konto (sobald der Server eingerichtet ist, siehe [backend.md](backend.md)) ist auch das hier echt:
- Anmelden, Slideshows, Dateien, Hinweis und Einstellungen liegen auf dem Server, auf jedem Gerät gleich.
- Bildschirme sind echte Boxen (`player.html?cloud`), gekoppelt mit dem Code vom Fernseher.
- Veröffentlichen, An/Aus, Neustart, Finden, Foto und Sofort-Hinweis erreichen die Box über das Internet,
  spätestens nach 10 Sekunden. Das Panel zeigt, wann sich jede Box zuletzt gemeldet hat.

Gespielt (in der Demo ohne Konto):
- Kein Server, kein Login. Alles liegt im Browser (localStorage und IndexedDB).
- Die Verbindung zwischen Panel und Player ist ein BroadcastChannel, funktioniert also nur im selben Browser.
- Temperatur, Speicher, Netz und der Online-Status der Demo-Bildschirme sind erfunden.
- Koppeln nimmt jeden sechsstelligen Code (mit Konto nur den echten).
- Die Wiedergabezahlen der Demo-Bildschirme sind aus dem Zeitplan hochgerechnet. Die Meldung bei Ausfall verschickt nichts, auch mit Konto noch nicht.
- Bewertungen tippt man im Prototyp ab. Später holt ShowCube Sterne und Stimmen aus dem Google-Unternehmensprofil.
