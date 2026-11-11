# ShowCube

Plug & Show: ein einfaches, bezahlbares Digital-Signage-System für kleine Betriebe
(Gastro, Läden, Makler, Praxen). Eine kleine Box am Fernseher zeigt Angebote,
Speisekarten oder Objekte, gesteuert nach Tageszeit, auch ganz ohne Internet.

## Stand

Frühe Prototypen in TypeScript. Player und Konfigurator teilen sich die Folien-Vorlagen
und die Schriften. Der Build macht aus jedem eine einzelne HTML-Datei, die ohne
Internet läuft.

| Ordner | Was | Status |
| --- | --- | --- |
| `player/` | Player v0: läuft im Vollbild auf der Box, offline, mit Vorlagen, eigenen Bildern und Videos und Zeitplan (Tag, Abend, Bildschirm aus). Einstellungen mit Taste `E`. | Prototyp, im Browser getestet, noch nicht auf einem Raspberry Pi |
| `konfigurator/` | Schaufenster-Konfigurator für den Vertrieb: Foto vom Schaufenster, Bildschirm perspektivisch hineinmontieren, Vorher/Nachher, Postkarte A6. | Prototyp |
| `shared/` | Gemeinsame Folien-Vorlagen und Schriften (Bricolage Grotesque, Figtree; beide OFL 1.1). | |
| `release/` | Fertig gebaute Einzeldateien `player.html` und `konfigurator.html`. | wird bei jedem Build erneuert |
| `docs/` | Anleitungen, z.B. Testbox einrichten. | |

## Ausprobieren

Ohne etwas zu installieren: `release/player.html` oder `release/konfigurator.html`
herunterladen und im Browser öffnen. Schriften und Vorlagen stecken in der Datei.

Für eine Testbox auf einem Raspberry Pi 5: siehe [docs/testbox-einrichten.md](docs/testbox-einrichten.md).

## Entwickeln

Voraussetzung ist Node.js ab Version 20.

```
npm install
npm run dev:player         # Player mit Live-Vorschau
npm run dev:konfigurator   # Konfigurator mit Live-Vorschau
npm run build              # Typprüfung, dann release/*.html neu bauen
```

Nach Änderungen `npm run build` ausführen und `release/` mit einchecken.

## Geplante Stufen

- **Light:** offline, Inhalte per USB-Stick, einmaliger Kauf.
- **Cloud:** Web-Panel, Zeitpläne, Status der Bildschirme, Abo pro Bildschirm.
- **Pro:** mehrere Nutzer und Standorte, Integrationen, API.

Eine Codebase für alle Stufen; eine Lizenz auf der Box schaltet die Funktionen frei.

## Bekannte Baustellen

- „Bildschirm aus“ zeigt nur Schwarz. Echtes Ausschalten des Fernsehers per HDMI-CEC fehlt noch.
