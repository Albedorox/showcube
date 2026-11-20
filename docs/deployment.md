# Website veröffentlichen: Stage und showcube.de

Die Website (Startseite, Panel, Player, Designer, Konfigurator, Bericht) läuft bei Hostinger.
Es gibt zwei Umgebungen:

| Umgebung | Adresse | Wann sie sich ändert |
| --- | --- | --- |
| **Stage** (Testumgebung) | https://stage.showcube.de | automatisch nach jedem Merge in `main`, sobald die Tests grün sind |
| **Prod** (echte Seite) | https://showcube.de | nur wenn du auf „Live schalten“ drückst |

Von Hand kopierst du nie etwas. Stage ist für Suchmaschinen gesperrt und zeigt unten links ein oranges Schild
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
  `release/` und das Favicon `pwa/icon.svg`. Quellcode, `tests/`, `docs/`, `supabase/` und die Gehäuse-Dateien
  in `hardware/` kommen **nicht** mit. Dazu kommen `.htaccess` (Zwischenspeicher, Dateitypen, www → ohne www),
  `robots.txt` und `version.txt` mit dem Commit.
- `scripts/veroeffentlichen.sh` legt diesen Ordner als neuen Commit auf den Branch **`website-stage`** bzw.
  **`website-prod`**. Auf diesen Branches liegt nur die fertige Website. Nicht von Hand ändern.
- Hostinger ist mit beiden Branches verbunden (Git-Deployment in hPanel) und holt jeden neuen Commit sofort ab:
  `website-stage` → Ordner `public_html/stage` (stage.showcube.de), `website-prod` → `public_html` (showcube.de).
- `scripts/online-pruefen.sh` wartet danach, bis die Seite den neuen Stand in `version.txt` zeigt.
- Workflows: `.github/workflows/stage.yml` („Stage aktualisieren“) und `.github/workflows/live.yml` („Live schalten“).
  In GitHub erscheinen beide als Umgebungen **stage** und **prod** mit Verlauf (Repo-Startseite rechts „Deployments“).

Es gibt keine Passwörter oder Zugangsdaten in GitHub. Hostinger liest über seine GitHub-App.

## Einmalige Einrichtung (erledigt am 20.11.2026)

1. In hPanel: Domain `showcube.de`, Subdomain `stage.showcube.de` (Ordner `public_html/stage`), SSL für beide,
   „HTTPS erzwingen“ an. Hostinger-CDN ist an.
2. In hPanel unter Websites → showcube.de → Verwalten → Erweitert → Git: GitHub verbunden, Zugriff auf `showcube`.
3. Git-Deployment eingerichtet (über den Hostinger-Connector, `hosting_deploy`, Typ „static“):
   stage.showcube.de ← Branch `website-stage`, showcube.de ← Branch `website-prod`, jeweils mit Auto-Deploy.
4. Supabase: `site_url` ist https://showcube.de/, erlaubte Login-Ziele sind showcube.de, stage.showcube.de und
   übergangsweise die alte GitHub-Pages-Adresse (`supabase/config.toml`, geht beim Merge automatisch raus).

## Wenn etwas hakt

- **„Stage aktualisieren“ ist rot im Schritt „Zeigt stage.showcube.de den neuen Stand?“:** Hostinger hat den Branch
  nicht abgeholt. In hPanel unter Git nachsehen, ob die Verbindung noch steht, und dort „Deploy“ drücken.
- **Stage zeigt alte Inhalte im Browser:** Neu laden. Seiten und Skripte werden nie lange zwischengespeichert,
  nur Bilder und Schriften (eine Woche, ihre Namen ändern sich nicht).
- **Die Tests auf `main` sind rot:** Dann geht nichts auf Stage, und „Live schalten“ lehnt diesen Stand ab.
- **GitHub Pages** (albedorox.github.io/showcube) läuft vorerst weiter. Wenn showcube.de steht, kann es aus.
