# Website veröffentlichen: Stage und showcube.de

Die Website (Startseite, Panel, Player, Designer, Konfigurator, Bericht) läuft bei Hostinger.
Es gibt zwei Umgebungen:

| Umgebung | Adresse | Wann sie sich ändert |
| --- | --- | --- |
| **Stage** (Testumgebung) | https://stage.showcube.de | automatisch nach jedem Merge in `main`, sobald die Tests grün sind |
| **Prod** (echte Seite) | https://showcube.de | nur wenn du auf „Live schalten“ drückst |

Von Hand kopierst du nie etwas.

## Vorschaltseite „Bald da“

Solange ShowCube noch nicht offiziell startet, zeigt **showcube.de** nur eine Vorschaltseite: das ShowCube-Logo
in der Mitte, „Plug & Show“, „Dein Fernseher wird zum besten Verkäufer.“, ein kurzer Teaser und der Kontakt
hallo@showcube.de. Die Seite steht in `bald/index.html`. Stage zeigt immer die volle Startseite, die Vorschaltseite
siehst du dort zur Vorschau unter https://stage.showcube.de/bald/.

Was auf showcube.de läuft, steht in `website.json`:

```json
{ "showcube.de": "bald" }
```

Zum offiziellen Start wird daraus `"startseite"`: Pull Request, mergen, dann „Live schalten“. Danach zeigt
showcube.de die volle Startseite mit Sitemap. Die Apps unter `release/` (Panel, Player, Box-Skript) sind auch
während „Bald da“ unter ihren Adressen erreichbar, aber nirgends verlinkt. Stage ist für Suchmaschinen gesperrt und zeigt unten links ein oranges Schild
„Stage: Testumgebung“, damit du die beiden nicht verwechselst.

## So läuft eine Änderung bis zu den Kunden

1. **Pull Request:** Die Tests laufen (Workflow „Tests“). Rot heißt: nicht mergen.
2. **Merge in `main`:** Die Tests laufen noch einmal auf `main`. Sind sie grün, startet „Stage aktualisieren“
   von selbst. Nach etwa einer Minute zeigt stage.showcube.de den neuen Stand.
3. **Selbst prüfen** auf https://stage.showcube.de (am Rechner und am Handy).
4. **Live schalten:** Auf GitHub **Actions** → links **Live schalten** → rechts **Run workflow** → grüner Knopf
   **Run workflow**. Genau der Stand, der gerade auf Stage läuft, geht auf showcube.de. Fertig, wenn der Lauf grün ist.

Willst du einen älteren Stand zurück auf showcube.de bringen, trägst du bei „Run workflow“ dessen Commit ein
(z. B. `27451ba`). Er muss auf `main` liegen und grüne Tests haben, sonst bricht der Workflow ab.

Welcher Stand gerade online ist, steht in https://showcube.de/version.txt und https://stage.showcube.de/version.txt.

## Was dahinter passiert

- `scripts/website.mjs stage|prod <ordner>` stellt die Website zusammen: `index.html`, `sitemap.xml`, `assets/`,
  `release/` und das Favicon `pwa/icon.svg`. Für showcube.de mit `"bald"` kommt `bald/index.html` als Startseite
  hinein und die Sitemap fällt weg. Impressum, Datenschutz und Kontaktformular (`kontakt.php`, braucht PHP) sind
  in beiden Umgebungen dabei, siehe [kontaktformular.md](kontaktformular.md). Quellcode, `tests/`, `docs/`, `supabase/` und die Gehäuse-Dateien
  in `hardware/` kommen **nicht** mit. Dazu kommen `.htaccess` (Zwischenspeicher, Dateitypen, www → ohne www),
  `robots.txt` und `version.txt` mit dem Commit.
- `scripts/veroeffentlichen.sh` legt diesen Ordner als neuen Commit auf den Branch **`website-stage`** bzw.
  **`website-prod`**. Auf diesen Branches liegt nur die fertige Website. Nicht von Hand ändern.
- Hostinger ist mit beiden Branches verbunden (Git-Deployment) und holt sie ab:
  `website-stage` → stage.showcube.de (eigene Website mit eigenem Ordner), `website-prod` → showcube.de.
  Zusätzlich kann `scripts/hostinger-abholen.sh` das Abholen über die Hostinger-API anstoßen, falls Hostinger
  einen Push einmal nicht bemerkt. Das geht nur mit dem Secret `HOSTINGER_API_TOKEN`, sonst gibt es nur einen Hinweis.
- Stage darf nicht im Ordner von showcube.de liegen: Hostinger spielt eine Website nur in einen leeren Ordner ein.
- `scripts/online-pruefen.sh` wartet danach, bis die Seite den neuen Stand in `version.txt` zeigt.
- Workflows: `.github/workflows/stage.yml` („Stage aktualisieren“) und `.github/workflows/live.yml` („Live schalten“).
  In GitHub erscheinen beide als Umgebungen **stage** und **prod** mit Verlauf (Repo-Startseite rechts „Deployments“).

In GitHub liegen keine FTP- oder SSH-Passwörter, höchstens der Hostinger-API-Schlüssel (Secret `HOSTINGER_API_TOKEN`).
Hostinger liest das Repo über seine GitHub-App.

## Einmalige Einrichtung (erledigt am 20.11.2026)

1. In hPanel: Website `showcube.de` und eigene Website `stage.showcube.de`, SSL für beide,
   „HTTPS erzwingen“ an. Hostinger-CDN ist an.
2. In hPanel unter Websites → showcube.de → Verwalten → Erweitert → Git: GitHub verbunden, Zugriff auf `showcube`.
3. Git-Deployment eingerichtet (über den Hostinger-Connector, `hosting_deploy`, Typ „static“):
   stage.showcube.de ← Branch `website-stage`, showcube.de ← Branch `website-prod`, jeweils mit Auto-Deploy.
   Stage war zuerst eine Subdomain im Ordner `public_html/stage` von showcube.de. Dann lehnt Hostinger showcube.de ab
   („Project directory is not empty“). Deshalb ist stage.showcube.de seit 20.11.2026 eine eigene Website.
4. Nur falls Hostinger Pushes nicht von selbst abholt, API-Schlüssel: In hPanel oben rechts auf das Profil → **API** → **Neues Token erstellen** (Name „GitHub Deploy“,
   ohne Ablaufdatum oder 1 Jahr). Das Token in GitHub unter **Settings → Secrets and variables → Actions →
   New repository secret** als `HOSTINGER_API_TOKEN` speichern.
5. Supabase: `site_url` ist https://showcube.de/, erlaubte Login-Ziele sind showcube.de, stage.showcube.de und
   übergangsweise die alte GitHub-Pages-Adresse (`supabase/config.toml`, geht beim Merge automatisch raus).

## Wenn etwas hakt

- **„Stage aktualisieren“ ist rot im Schritt „Zeigt stage.showcube.de den neuen Stand?“:** Hostinger hat den Branch
  nicht abgeholt. In hPanel unter Git nachsehen, ob die Verbindung noch steht, und dort „Deploy“ drücken.
- **Stage zeigt alte Inhalte im Browser:** Neu laden. Seiten und Skripte werden nie lange zwischengespeichert,
  nur Bilder und Schriften (eine Woche, ihre Namen ändern sich nicht).
- **Die Tests auf `main` sind rot:** Dann geht nichts auf Stage, und „Live schalten“ lehnt diesen Stand ab.
- **GitHub Pages** (albedorox.github.io/showcube) läuft vorerst weiter. Wenn showcube.de steht, kann es aus.
