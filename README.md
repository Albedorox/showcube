# ShowCube

Plug & Show: ein einfaches, bezahlbares Digital-Signage-System für kleine Betriebe
(Gastro, Läden, Makler, Praxen). Eine kleine Box am Fernseher zeigt Angebote,
Speisekarten oder Objekte, gesteuert nach Tageszeit, auch ganz ohne Internet.

## Stand

Frühe Prototypen. Beide sind einzelne HTML-Dateien ohne Build-Schritt und lassen
sich direkt im Browser öffnen.

| Ordner | Was | Status |
| --- | --- | --- |
| `player/` | Player v0: läuft im Vollbild auf der Box, offline, mit Vorlagen, eigenen Bildern und Videos und Zeitplan (Tag, Abend, Bildschirm aus). Einstellungen mit Taste `E`. | Prototyp, im Browser getestet, noch nicht auf einem Raspberry Pi |
| `konfigurator/` | Schaufenster-Konfigurator für den Vertrieb: Foto vom Schaufenster, Bildschirm perspektivisch hineinmontieren, Vorher/Nachher, Postkarte A6. | Prototyp |
| `docs/` | Anleitungen, z.B. Testbox einrichten. | |

## Ausprobieren

`player/index.html` oder `konfigurator/index.html` im Browser öffnen. Mehr braucht es nicht.

Für eine Testbox auf einem Raspberry Pi 5: siehe [docs/testbox-einrichten.md](docs/testbox-einrichten.md).

## Geplante Stufen

- **Light:** offline, Inhalte per USB-Stick, einmaliger Kauf.
- **Cloud:** Web-Panel, Zeitpläne, Status der Bildschirme, Abo pro Bildschirm.
- **Pro:** mehrere Nutzer und Standorte, Integrationen, API.

Eine Codebase für alle Stufen; eine Lizenz auf der Box schaltet die Funktionen frei.

## Bekannte Baustellen

- Die Folien-Vorlagen stehen doppelt in Player und Konfigurator. Sie sollen in ein gemeinsames Modul wandern.
- Die Schriften werden aus dem Netz geladen. Offline nutzt der Player eine Ersatzschrift.
- „Bildschirm aus“ zeigt nur Schwarz. Echtes Ausschalten des Fernsehers per HDMI-CEC fehlt noch.
