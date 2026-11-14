# Backend (ShowCube Cloud)

Der kleinste Kern für die Cloud-Stufe: Konto und Login, Slideshows und Dateien auf dem Server,
Boxen per Code koppeln, die Box holt sich ihren Stand selbst ab. Damit kann die erste echte
Testbox bei einem Pilotkunden laufen, gesteuert aus dem Panel von überall.

## Wo es läuft und was es kostet

| Teil | Wo | Kosten |
| --- | --- | --- |
| Datenbank, Login, Dateien | [Supabase](https://supabase.com), Region Frankfurt (EU) | 0 € im Free-Plan |
| Panel, Player, Konfigurator | GitHub Pages wie bisher (`release/`) | 0 € |

Warum Supabase: Login, Datenbank mit Zugriffsregeln und Dateispeicher kommen aus einer Hand, es
läuft in Frankfurt, und es gibt keinen eigenen Server, den jemand pflegen, patchen und überwachen
muss. Die ganze Logik steckt in einer SQL-Datei (`supabase/migrations/`), das Panel und die Box
reden direkt mit Supabase. Wenn ShowCube irgendwann umziehen soll: Supabase ist Open Source und
normales Postgres, man kann es auch selbst betreiben.

Grenzen des Free-Plans, die für die Piloten reichen: 500 MB Datenbank, 1 GB Dateien, 5 GB
Datenverkehr im Monat, Dateien bis 50 MB. Ein Free-Projekt schläft nach einer Woche ohne Zugriffe
ein. Eine laufende Box meldet sich alle 10 Sekunden und sollte das verhindern. Schläft es doch ein,
weckt man es im Dashboard mit einem Klick, die Boxen spielen solange den letzten Stand weiter.

Wechsel auf **Pro (25 $ im Monat)**, sobald zahlende Kunden dranhängen: tägliche Backups,
kein Einschlafen, 100 GB Dateien, größere Videos.

## Einrichten (einmalig, etwa 10 Minuten)

1. Auf [supabase.com](https://supabase.com) ein Konto anlegen (geht mit dem GitHub-Konto).
2. **New project**: Name `showcube`, Region **Central EU (Frankfurt)**, Plan Free.
   Beim Datenbank-Passwort auf „Generate“ klicken und das Passwort kopieren.
3. Oben rechts auf das Konto, **Access Tokens**, „Generate new token“, Name `github-showcube`, kopieren.
4. Im GitHub-Repository unter **Settings → Secrets and variables → Actions**:
   - Reiter **Secrets**: `SUPABASE_ACCESS_TOKEN` (Token aus Schritt 3) und `SUPABASE_DB_PASSWORD` (Passwort aus Schritt 2).
   - Reiter **Variables**: `SUPABASE_PROJECT_ID` = die Projekt-Kennung, das sind die 20 Buchstaben in der
     Adresse des Projekts (`supabase.com/dashboard/project/<kennung>`).
5. Unter **Actions → Backend → Run workflow** einmal starten. Das legt Tabellen, Zugriffsregeln und den
   Dateispeicher an und schaltet anonyme Anmeldung für die Boxen ein. Danach läuft es nach jeder
   Änderung an `supabase/` auf `main` von selbst.
6. In Supabase unter **Project Settings → API Keys** die **Project URL** und den **Publishable key**
   (`sb_publishable_…`) in `shared/backend.json` eintragen und `npm run build` laufen lassen.
   Beide Werte sind öffentlich und dürfen ins Repository. Der „secret key“ gehört **nicht** hinein.

Ab dann zeigt das Panel oben rechts „Anmelden“. Ohne Konto bleibt es die Demo wie bisher.

## Eine Box koppeln

1. Auf der Box `player.html?cloud` öffnen (in der Testbox-Anleitung statt `player.html`),
   oder im Player mit Taste `E` auf „Mit ShowCube Cloud verbinden“.
2. Der Fernseher zeigt einen sechsstelligen Code.
3. Im Panel anmelden, „Bildschirm koppeln“, Code eingeben. Ein paar Sekunden später spielt die Box
   die zugewiesene Slideshow.

Fällt das Internet aus, spielt die Box den letzten Stand weiter, auch nach einem Neustart.

## Wie es zusammenhängt

```
 Panel (Browser, Konto)                       Supabase (Frankfurt)                      Box (Player)
 ──────────────────────                       ────────────────────                      ────────────
 Anmelden mit E-Mail + Passwort  ───────────► auth.users ─► betriebe, mitglieder
 Slideshows bearbeiten           ── 1 s ────► shows (Entwurf, Stand, Versionen)
 Bilder, Videos, Logo            ───────────► Speicher „medien/<betrieb>/<datei>“  ◄─── lädt Dateien
 Veröffentlichen                 ───────────► pakete (gleiches Format wie USB)     ◄─┐
 Bildschirm koppeln (Code)       ───────────► bildschirm_koppeln()                   │  box_anmelden(): anonym, Code
 Neustart, Finden, Foto          ───────────► befehle                              ◄─┤
 Sofort-Hinweis, An/Aus          ───────────► betriebe.hinweis, bildschirme.strom ◄─┤
 Zustand der Boxen               ◄── 5 s ──── bildschirme (zuletzt, zustand)        └── box_stand() alle 10 s:
                                                                                         Herzschlag + Abruf in einem
```

- **Ein Betrieb** ist ein Kundenkonto. Beim Registrieren entsteht er automatisch. Mehrere Nutzer pro
  Betrieb (Pro-Stufe) sind in der Tabelle `mitglieder` schon vorgesehen.
- **Die Box** meldet sich mit einem anonymen Konto an. Sie sieht nur ihr eigenes Paket und die Dateien
  ihres Betriebs, und erst, nachdem jemand aus dem Betrieb ihren Code eingegeben hat.
- **Zugriffsregeln** (Row Level Security) sorgen dafür, dass jeder Betrieb nur seine eigenen Daten sieht.
  `scripts/backend-test.mjs` prüft das bei jedem Pull Request automatisch.
- **Das Paket-Format** ist dasselbe wie auf dem USB-Stick. Nur die Dateien sind Verweise
  (`speicher:<betrieb>/<datei>`) statt eingebetteter Daten.

## Lokal entwickeln

Braucht Docker.

```
npm run backend:start     # lokaler Supabase-Server, zeigt URL und Publishable key
npm run backend:test      # 12 Prüfungen: Koppeln, Veröffentlichen, Befehle, fremde Daten gesperrt
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_KEY=<publishable key> npm run dev
```

Dann `/panel/` und in einem zweiten Fenster `/player/?cloud` öffnen.

## Was bewusst noch fehlt

- **Ausfall-Meldung und Push** (Schritt 2): `bildschirme.zuletzt` ist schon da. Fehlt ein Job, der
  regelmäßig nachsieht, und der Versand per E-Mail und Web-Push.
- **Abrechnung** (Schritt 3): Stripe, erst wenn Piloten zahlen.
- **E-Mails**: Bestätigungs- und Passwort-vergessen-Mails brauchen einen eigenen Mailversand (z.B. Brevo
  oder Resend, im Free-Plan kostenlos). Bis dahin ist die E-Mail-Bestätigung aus, und ein vergessenes
  Passwort setzt man im Supabase-Dashboard zurück.
- **Aufräumen**: gelöschte Medien bleiben im Speicher liegen. Für die Piloten egal.
- **Sofort statt alle 10 Sekunden**: Supabase Realtime könnte Befehle in unter einer Sekunde zustellen.
  Für den Anfang reicht das regelmäßige Nachfragen, es ist robuster.
