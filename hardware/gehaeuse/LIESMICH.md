# ShowCube-Gehäuse v1 (Prototyp)

Von vorne ein Würfel (96 × 96 mm, Ecken R8, Frontkante R2), aber nur 40 mm tief.
Gebaut in Solidcraft, parametrisch (S = Front, D = Tiefe, wall = 2,5 mm).

## Aufbau
- **Gehäuse (Front-Teil):** geschlossene, glatte Front. Hinten offen.
  Oben 7 Lüftungsschlitze, rechts Ausschnitt für USB und LAN, links Schlitz für die SD-Karte.
- **Rückwand:** trägt den Raspberry Pi 5 hochkant auf 4 Abstandshaltern (Lochbild 58 × 49 mm, Löcher 2,7 mm für M2.5).
  6 Lüftungsschlitze hinter der Platine. Wird mit 3 Schrauben M3 (zwei oben, eine links) im Gehäuse verschraubt.
- **Kabelbucht unten:** Die Rückwand endet 28 mm über dem Boden. Strom (USB-C) und Micro-HDMI zeigen nach unten
  und die Kabel gehen hinten unten raus. Von vorne sieht man keine Kabel.

## Dateien
- `ShowCube-Gehaeuse.sc` – Solidcraft-Datei mit Verlauf und Parametern (inkl. Pi-5-Platzhalter)
- `ShowCube-Gehaeuse.step` – für jedes CAD-Programm
- `ShowCube-Gehaeuse-Front.stl`, `ShowCube-Gehaeuse-Rueckwand.stl`, `ShowCube-Gehaeuse.3mf` – für den 3D-Druck
- `ShowCube-Gehaeuse.script.json` – Befehlsskript zum Nachbauen

## Drucken
- Front-Teil mit der Front nach unten aufs Bett legen. So braucht es keine Stützen und die Front wird schön glatt.
- Rückwand flach mit der Außenseite nach unten.
- PETG oder ASA, nicht PLA (der Pi 5 wird warm, PLA wird ab etwa 55 °C weich).

## Noch zu prüfen (Maße sind aus Datenblatt-Werten geschätzt)
- Lage von USB-C und Micro-HDMI zur Kabelbucht mit echten Steckern testen.
- Position von USB/LAN-Ausschnitt und SD-Schlitz am echten Pi 5 nachmessen.
- Hält der Aktivkühler mit 12 mm Luft zur Front die Temperatur? Sonst Front-Abstand oder Schlitze erhöhen.
- Optional: Logo in der Front, Gummifüße, Wandhalterung (VESA hinter dem TV).
