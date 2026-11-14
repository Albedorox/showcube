# Testbox einrichten

Mit dieser Anleitung wird aus einem Raspberry Pi 5 in etwa 30 Minuten eine Testbox,
die nach dem Einstecken von selbst den ShowCube Player im Vollbild startet und ohne
Internet läuft.

Hinweis: Diese Anleitung ist noch nicht auf echter Pi-Hardware getestet.

## Einkaufsliste

| Teil | Hinweis |
| --- | --- |
| Raspberry Pi 5, 2 GB | Reicht für Full-HD-Folien und Videos |
| Offizielles 27-W-Netzteil (USB-C) | Andere Netzteile führen oft zu Abstürzen |
| Gehäuse mit Lüfter oder Kühlkörper | Läuft im Schaufenster den ganzen Tag |
| microSD-Karte 32 GB, Markenkarte (A2) | Billigkarten sind ein häufiger Ausfallgrund |
| Kabel Micro-HDMI auf HDMI | Der Pi 5 hat Micro-HDMI-Buchsen |
| RTC-Batterie für den Pi 5 | Hält die Uhrzeit ohne Internet, wichtig für den Zeitplan |
| USB-Tastatur und Maus | Nur zum Einrichten |

## 1. SD-Karte vorbereiten (am PC)

1. Den Raspberry Pi Imager von raspberrypi.com installieren und starten.
2. Gerät: Raspberry Pi 5. Betriebssystem: Raspberry Pi OS (64-bit) mit Desktop. Speicher: die SD-Karte.
3. Bei „Einstellungen anpassen“: Benutzername `svizz`, ein Passwort, WLAN (nur für die Einrichtung), Zeitzone Europe/Berlin, Tastatur de.
4. Schreiben lassen, Karte in den Pi stecken.

## 2. Player auf einen USB-Stick legen

`release/player.html` aus diesem Repository als `player.html` auf einen USB-Stick kopieren,
dazu die Bilder und Videos, die laufen sollen.

## 3. Pi starten und einrichten

Pi an den Fernseher, Tastatur, Maus und Stick anschließen, Netzteil zuletzt einstecken.
Im Terminal:

```bash
curl -fsSLO https://albedorox.github.io/showcube/release/box-einrichten.sh
bash box-einrichten.sh
sudo reboot
```

Ohne Internet: `box-einrichten.sh` aus `release/` mit auf den Stick legen und
`bash /media/svizz/*/box-einrichten.sh` aufrufen.

Das Skript legt den Player vom Stick ab, startet ihn beim Hochfahren automatisch im Vollbild,
verhindert, dass der Bildschirm nach 10 Minuten schwarz wird, und gibt der Box ihre
**Box-Kennung** (zum Beispiel `SC-K7QD-2MXA`). Die Kennung wird aus der Seriennummer des Pi
berechnet, bleibt also für diesen Pi immer gleich. Sie steht am Ende im Terminal:
**aufs Gehäuse drucken oder kleben.** Dazu legt das Skript einen geheimen Schlüssel auf die
SD-Karte. Mit beiden zusammen erkennt der Server die Box wieder, auch wenn der Browser
zurückgesetzt wird (mehr in [backend.md](backend.md#box-kennung-an-den-pi-gebunden)).

Das Skript kann jederzeit nochmal laufen, zum Beispiel für einen neuen Player vom Stick.
Kennung und Schlüssel bleiben dabei gleich.

## 4. Inhalte einstellen

1. Nach dem Neustart läuft der Player. Taste `E` drücken.
2. Branche wählen, Name und Einträge eintragen, Farbe wählen, Logo vom Stick laden.
3. Eigene Fotos oder Videos über „Dateien hinzufügen“ laden und festlegen, wann sie laufen.
4. Zeitplan an die Öffnungszeiten anpassen.
5. Mit `E` schließen. Alles bleibt auf der Box gespeichert, auch ohne Internet.

## 4b. Oder: Inhalte aus der Cloud

Nach dem Einrichten aus Schritt 3 ist die Box schon eine Cloud-Box
(Server eingerichtet, siehe [backend.md](backend.md)):

1. Das WLAN des Kunden muss dauerhaft eingerichtet sein.
2. Der Fernseher zeigt einen sechsstelligen Code und darunter die Box-Kennung.
3. Im Panel anmelden, „Bildschirm koppeln“, Code eingeben. Im Panel steht die Box-Kennung danach
   unter dem Bildschirm, so lässt sich jede Box im Laden ihrem Eintrag zuordnen.
4. Ohne Internet spielt die Box den zuletzt geholten Stand weiter.

Soll die Box nur mit Inhalten vom Stick laufen (ShowCube Light, ohne Koppel-Code auf dem Fernseher),
in Schritt 3 `bash box-einrichten.sh --light` aufrufen. Kennung und Schlüssel bekommt sie trotzdem,
später lässt sie sich mit Taste `E` und „Mit ShowCube Cloud verbinden“ in die Cloud holen.

## 5. Vor dem Ausliefern prüfen

- [ ] Strom ziehen und wieder einstecken: Startet der Player von selbst?
- [ ] Box-Kennung aufs Gehäuse gedruckt? Stimmt sie mit dem Fernseher überein?
- [ ] Stimmt die Uhrzeit? (Taste `E`, oben im Status-Kasten)
- [ ] Laufen alle Folien und Videos durch?
- [ ] Tastatur, Maus und Stick abziehen. Die Box läuft weiter.
