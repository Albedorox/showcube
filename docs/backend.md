# Backend (ShowCube Cloud)

Der kleinste Kern für die Cloud-Stufe: Konto und Login, Slideshows und Dateien auf dem Server,
Boxen per Code koppeln, die Box holt sich ihren Stand selbst ab. Damit kann die erste echte
Testbox bei einem Pilotkunden laufen, gesteuert aus dem Panel von überall.

## Wo es läuft und was es kostet

| Teil | Wo | Kosten |
| --- | --- | --- |
| Datenbank, Login, Dateien | [Supabase](https://supabase.com), Region Frankfurt (EU) | 0 € im Free-Plan |
| Panel, Player, Konfigurator | Hostinger-Webhosting (showcube.de, Stage auf stage.showcube.de), siehe [deployment.md](deployment.md) | im Hosting-Paket |

Warum Supabase: Login, Datenbank mit Zugriffsregeln und Dateispeicher kommen aus einer Hand, es
läuft in Frankfurt, und es gibt keinen eigenen Server, den jemand pflegen, patchen und überwachen
muss. Die ganze Logik steckt in einer SQL-Datei (`supabase/migrations/`), das Panel und die Box
reden direkt mit Supabase. Wenn ShowCube irgendwann umziehen soll: Supabase ist Open Source und
normales Postgres, man kann es auch selbst betreiben.

Grenzen des Free-Plans, die für die Piloten reichen: 500 MB Datenbank, 1 GB Dateien, 5 GB
Datenverkehr im Monat, Dateien bis 50 MB. Ein Free-Projekt schläft nach einer Woche ohne Zugriffe
ein. Eine laufende Box meldet sich alle 10 Sekunden und sollte das verhindern. Solange noch keine Box
dauerhaft läuft, liest der Workflow `Supabase wachhalten` (`.github/workflows/keepalive.yml`) alle zwei
Tage die Tabelle `keepalive`. GitHub schaltet geplante Workflows nach 60 Tagen ohne Commits im Repo ab,
dann im Reiter Actions wieder einschalten. Schläft das Projekt doch ein, weckt man es im Dashboard mit
einem Klick, die Boxen spielen solange den letzten Stand weiter.

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

Ab dann startet das Panel ohne Anmeldung mit einem Anmelde-Bildschirm. Dort geht es zu „Anmelden“, „Konto anlegen“
oder „Demo ansehen“. Die Demo zeigt Beispiel-Betriebe mit einem Banner, lebt nur im offenen Tab und speichert nichts.
Ein neues Konto startet leer, eine Einrichtungshilfe unter „Bildschirme“ führt durch die ersten drei Schritte.

## Admin-Konto (ShowCube-Team)

Ein Admin sieht alle Kunden, ihre Bildschirme und Inhalte, kann alles ändern und Boxen für einen
Kunden koppeln. So wird ein Konto zum Admin:

1. Im Panel ganz normal ein Konto anlegen.
2. In Supabase links **SQL Editor** öffnen, diese Zeile mit der eigenen E-Mail einfügen und auf **Run** klicken:
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'deine@email.de';
   ```
3. Panel neu laden. Unten links steht dann „Admin“, und der Konto-Knopf oben rechts öffnet die Liste
   aller Betriebe. Ein Klick öffnet den Betrieb, so wie der Kunde ihn sieht.

Admin werden geht bewusst nur über das Dashboard, nie über die Website. Wieder entfernen:
`delete from public.admins where user_id = (select id from auth.users where email = 'deine@email.de');`

## Benutzerverwaltung (nur Admins)

Admins haben im Panel links den Bereich **Benutzer** (auch über Strg + K „Benutzer verwalten“). Dort stehen alle Konten
mit Betrieb, Abo, letzter Anmeldung, Zwei-Faktor, bestätigter E-Mail und Boxen (wie viele davon online). Oben suchst du nach
E-Mail oder Betrieb und filterst nach Pro, Cloud, Gesperrt oder Unbestätigt. Beim Wechsel des Filters tauscht nur die
Liste darunter, Kopf, Zahlen und Suche bleiben stehen, und es wird nichts neu vom Server geladen. Ein Klick auf ein Konto öffnet die Details:

- **Abo:** Cloud oder Pro, bei Pro ein Enddatum (leer = unbefristet) und die KI-Analysen pro Monat. „Abo speichern“
  schreibt in die Tabelle `abos`. Ein Testkonto auf Pro stellen geht also mit zwei Klicks, ohne SQL.
- **Boxen:** jede gekoppelte Box mit Standort, online oder seit wann offline, Version.
- **Betrieb öffnen:** zeigt das Panel so, wie der Kunde es sieht.
- **Sperren / Freigeben:** gesperrt heißt, das Konto wird sofort abgemeldet, kann sich nicht mehr anmelden und kommt auch
  mit einer noch offenen Sitzung nicht mehr an Daten. Die Boxen zeigen weiter den letzten Stand.
- **E-Mail bestätigen:** falls die Bestätigungsmail nicht ankommt.
- **Konto löschen:** löscht Konto, Betrieb, Slideshows, Abo und Dateien und trennt die Boxen. Erst wenn du die E-Mail
  zur Bestätigung eintippst. Lässt sich nicht rückgängig machen.
- **Protokoll:** jede Änderung durch einen Admin (wer, wann, was) steht in der Tabelle `admin_protokoll`.

Sicherheit: Alles läuft über Datenbank-Funktionen (`admin_benutzer`, `admin_abo_setzen`, `admin_sperren`,
`admin_bestaetigen`, `admin_loeschen`, `admin_protokoll_lesen` in `supabase/migrations/20261122180000_benutzerverwaltung.sql`).
Jede prüft auf dem Server zuerst `ist_admin()` (mit Zwei-Faktor-Code, falls eingerichtet) und lehnt sonst mit
„Nur für Admins.“ ab. Admin-Konten, auch das eigene, lassen sich dort weder sperren noch löschen, und Admin-Rechte
vergibt man weiter nur per SQL. Kein Secret Key im Browser nötig.

## Eine Box koppeln

1. Auf der Box `player.html?cloud` öffnen (in der Testbox-Anleitung statt `player.html`),
   oder im Player mit Taste `E` auf „Mit ShowCube Cloud verbinden“.
2. Der Fernseher zeigt einen sechsstelligen Code.
3. Im Panel anmelden, „Bildschirm koppeln“, Code eingeben. Ein paar Sekunden später spielt die Box
   die zugewiesene Slideshow.

Fällt das Internet aus, spielt die Box den letzten Stand weiter, auch nach einem Neustart.

Der Code gilt eine Stunde. Danach zeigt der Fernseher von selbst einen neuen. Gegen Durchprobieren gibt es zwei
Sperren: 10 falsche Codes pro Konto und Stunde, und 100 falsche Codes in 10 Minuten über alle Konten zusammen.

## Sicherheit beim Anmelden

- **E-Mail-Bestätigung:** Ein neues Konto bekommt eine Mail mit „E-Mail bestätigen“ (Vorlage
  `supabase/templates/bestaetigen.html`). Der Link führt zurück ins Panel (`panel.html?bestaetigt`), dort meldet
  man sich mit dem Passwort an. Die Mails gehen über das Hostinger-Postfach **info@showcube.de** raus (im Hostinger-Tarif sind nur zwei Postfächer
  dabei, hallo@ bleibt für Kundenanfragen).
  Einmalig einrichten:
  1. Das Passwort von `info@showcube.de` bereithalten (in hPanel unter **E-Mails** lässt es sich neu setzen).
  2. Auf GitHub unter **Settings → Secrets and variables → Actions → New repository secret** das Secret
     `SUPABASE_SMTP_PASSWORT` mit diesem Passwort anlegen.
  3. Workflow **Backend** einmal von Hand starten (Actions → Backend → Run workflow).
  Solange das Secret fehlt, bleibt die Bestätigung aus und der Workflow zeigt eine Warnung. Die Einstellungen
  stehen in `supabase/config.toml` im Block `[remotes.frankfurt]`, lokal bleibt alles ohne Mail.
- **Passwörter:** mindestens 8 Zeichen, mit Buchstaben und Ziffern. Der Abgleich mit geleakten Passwörtern
  (HaveIBeenPwned) geht bei Supabase erst ab dem Pro-Plan, dann unter Authentication → Passwords einschalten.
- **Zwei-Faktor (Authenticator-App):** Im Panel oben auf das Konto, dann „Zwei-Faktor-Schutz“ → „Einrichten“,
  QR-Code scannen, Code eingeben. Danach fragt das Panel bei jeder Anmeldung nach dem Code. Das prüft auch der
  Server: `aal_ok()` lässt Konten mit zweitem Faktor nur mit einer Sitzung der Stufe `aal2` an Daten
  (`ist_mitglied()`, `ist_admin()`). Für Admin-Konten dringend empfohlen. Wer sein Handy verliert, dem löscht
  ein Admin den Faktor im Supabase-Dashboard (Authentication → Users → Nutzer → MFA).

## Box-Kennung (an den Pi gebunden)

Eine echte Box wird mit `scripts/box-einrichten.sh` eingerichtet (siehe [testbox-einrichten.md](testbox-einrichten.md)).
Das Skript gibt ihr zwei Werte:

| | Woher | Wofür |
| --- | --- | --- |
| **Kennung**, z.B. `SC-K7QD-2MXA` | aus der Seriennummer des Pi berechnet (SHA-256, 8 Zeichen) | steht aufs Gehäuse, auf dem Fernseher beim Koppeln und im Panel unter „Box-Kennung“ |
| **Schlüssel** (43 Zeichen) | einmal zufällig erzeugt | bleibt geheim in `~/.config/showcube/box` auf der SD-Karte |

Der Player bekommt beide beim Start über die Adresse (`index.html?cloud&box=…&key=…`, steht im Autostart).
`box_anmelden()` legt die Box beim ersten Mal in der Tabelle `boxen` an und merkt sich nur den
SHA-256 des Schlüssels. Danach gilt:

- **Browser-Speicher gelöscht:** Die Box meldet sich mit neuem anonymem Konto, aber gleicher Kennung und
  gleichem Schlüssel. Der Server hängt den alten Bildschirm samt Kopplung an das neue Konto. Kein Neu-Koppeln.
- **Jemand liest die Kennung vom Gehäuse ab:** Ohne Schlüssel kommt er nicht an die Box. Gekoppelt wird
  weiterhin nur über den Code auf dem Fernseher, also mit Zugang zum Bildschirm.
- **SD-Karte neu bespielt:** Die Kennung ist gleich (gleicher Pi), der Schlüssel neu. Die Box zeigt dann
  „mit einem anderen Schlüssel angemeldet“. Als Admin im SQL Editor freigeben, die Kopplung bleibt:
  `select public.admin_box_freigeben('SC-K7QD-2MXA');` (geht nur als Admin-Konto, im SQL Editor direkt:
  `update public.boxen set schluessel = null where kennung = 'SC-K7QD-2MXA';`).
  Erst kurz vor dem Neustart der Box freigeben: bis dahin könnte sich jede Box mit dieser Kennung melden.
- **Ohne Kennung** (Player im normalen Browser, `?cloud`) läuft alles wie vorher mit anonymem Konto.
  Eine schon gekoppelte Testbox, die später das Skript bekommt, übernimmt die Kennung und bleibt gekoppelt.

Bekannte Grenze: Wer die Kennung einer Box kennt, bevor diese sich das erste Mal meldet, könnte sie mit
eigenem Schlüssel belegen. Er übernimmt damit nichts, die echte Box würde aber abgewiesen. Deshalb Boxen
bei der Einrichtung einmal online starten. Später lässt sich das mit einer Werks-Freischaltung schließen
(Kennungen vorab im Admin anlegen, nur diese dürfen sich melden).

## Wie es zusammenhängt

```
 Panel (Browser, Konto)                       Supabase (Frankfurt)                      Box (Player)
 ──────────────────────                       ────────────────────                      ────────────
 Anmelden mit E-Mail + Passwort  ───────────► auth.users ─► betriebe, mitglieder
 Slideshows bearbeiten           ── 1 s ────► shows (Entwurf, Stand, Versionen)
 Bilder, Videos, Logo            ───────────► Speicher „medien/<betrieb>/<datei>“  ◄─── lädt Dateien
 Veröffentlichen                 ───────────► pakete (gleiches Format wie USB)     ◄─┐
 Bildschirm koppeln (Code)       ───────────► bildschirm_koppeln()                   │  box_anmelden(): anonym + Kennung, Code
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

## Pro-Stufe und KI (Vorlage aus Bild)

- **Tabelle `abos`**: Stufe pro Betrieb (`cloud` oder `pro`, optional `bis`) und das KI-Kontingent `ki_grenze`
  (Standard 50 Analysen im Monat). Betriebe dürfen ihre Zeile nur lesen. Gesetzt wird von Admins im Panel unter „Benutzer“, später vom Zahlungsanbieter.
  Ohne Zeile gilt `cloud`. Admins dürfen alles Pro-mäßige immer.
- **Tabelle `ki_analysen`**: jede Analyse mit Betrieb, Nutzer, Modell und Tokens (für Kontingent und Kosten).
- **Edge Function `vorlage-aus-bild`** (`supabase/functions/`): rollt der Workflow „Backend“ auf `main` mit aus
  (`supabase functions deploy --use-api`, kein Docker nötig). Sie braucht das Secret `ANTHROPIC_API_KEY`, gesetzt unter
  **Edge Functions → Secrets** im Dashboard. Anleitung, Kosten und Optionen: [vorlage-aus-bild.md](vorlage-aus-bild.md).

## Lokal entwickeln

Braucht Docker.

```
npm run backend:start     # lokaler Supabase-Server, zeigt URL und Publishable key
npm run backend:test      # 16 Prüfungen: Koppeln, Veröffentlichen, Befehle, fremde Daten gesperrt, KI-Kontingent
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_KEY=<publishable key> npm run dev
```

Dann `/panel/` und in einem zweiten Fenster `/player/?cloud` öffnen.

## Was bewusst noch fehlt

- **Ausfall-Meldung und Push** (Schritt 2): `bildschirme.zuletzt` ist schon da. Fehlt ein Job, der
  regelmäßig nachsieht, und der Versand per E-Mail und Web-Push.
- **Abrechnung** (Schritt 3): Stripe, erst wenn Piloten zahlen. Der Zahlungsanbieter setzt dann `abos.stufe`.
- **Passwort vergessen**: Die Mail-Vorlage liegt schon bereit (`supabase/templates/passwort.html`), im Panel
  fehlt noch der Knopf. Bis dahin setzt man ein vergessenes Passwort im Supabase-Dashboard zurück.
- **Aufräumen**: gelöschte Medien bleiben im Speicher liegen. Für die Piloten egal.
- **Sofort statt alle 10 Sekunden**: Supabase Realtime könnte Befehle in unter einer Sekunde zustellen.
  Für den Anfang reicht das regelmäßige Nachfragen, es ist robuster.
