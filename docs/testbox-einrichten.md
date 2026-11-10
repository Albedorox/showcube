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

`player/index.html` aus diesem Repository als `player.html` auf einen USB-Stick kopieren,
dazu die Bilder und Videos, die laufen sollen.

## 3. Pi starten und einrichten

Pi an den Fernseher, Tastatur, Maus und Stick anschließen, Netzteil zuletzt einstecken.
Im Terminal diese Zeilen einzeln eingeben:

```bash
mkdir -p ~/player ~/.config/labwc
cp /media/svizz/*/player.html ~/player/index.html
echo '$(command -v chromium || command -v chromium-browser) --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required file:///home/svizz/player/index.html &' >> ~/.config/labwc/autostart
sudo raspi-config nonint do_blanking 1
sudo reboot
```

Die Zeilen legen den Player ab, starten ihn beim Hochfahren automatisch im Vollbild und
verhindern, dass der Bildschirm nach 10 Minuten schwarz wird.

## 4. Inhalte einstellen

1. Nach dem Neustart läuft der Player. Taste `E` drücken.
2. Branche wählen, Name und Einträge eintragen, Farbe wählen, Logo vom Stick laden.
3. Eigene Fotos oder Videos über „Dateien hinzufügen“ laden und festlegen, wann sie laufen.
4. Zeitplan an die Öffnungszeiten anpassen.
5. Mit `E` schließen. Alles bleibt auf der Box gespeichert, auch ohne Internet.

## 5. Vor dem Ausliefern prüfen

- [ ] Strom ziehen und wieder einstecken: Startet der Player von selbst?
- [ ] Stimmt die Uhrzeit? (Taste `E`, oben im Status-Kasten)
- [ ] Laufen alle Folien und Videos durch?
- [ ] Tastatur, Maus und Stick abziehen. Die Box läuft weiter.
