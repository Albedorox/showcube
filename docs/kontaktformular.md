# Kontaktformular, Impressum und Datenschutz

## Kontaktformular

`kontakt.html` ist die Seite „Schreib uns“. Oben stehen Textbausteine: **Testbox anfragen**, **Preise und Pakete**,
**Rückruf gewünscht**, **Agentur oder Partner**, **Allgemeine Frage**. Ein Klick setzt einen vorformulierten Text
ins Nachrichtenfeld. Eigener Text wird dabei nie überschrieben, der Baustein kommt dann darunter.
Ein Link mit `?thema=testbox` (oder `preise`, `rueckruf`, `partner`, `frage`) wählt den Baustein gleich vor.
„Testbox anfragen“ auf der Startseite und „Schreib uns“ auf der Vorschaltseite führen so direkt zum Formular.

Pflicht sind Name, E-Mail und Nachricht. Betrieb, Telefon und Branche sind freiwillig.

**Versand:** `kontakt.php` läuft auf dem Hostinger-Webhosting und schickt die Anfrage als E-Mail an
**hallo@showcube.de**. Der Betreff beginnt mit `[Kontaktformular]`, dann folgen Thema, Name und Betrieb, zum Beispiel
`[Kontaktformular] Testbox anfragen – Erika Muster (Pizzeria Sole)`. Anfragen von stage.showcube.de tragen vorne
zusätzlich `[Stage]`. „Antworten“ im Mailprogramm geht direkt an die Adresse der Person, die geschrieben hat.

**Spamschutz** ohne Captcha und ohne Cookies:
- ein verstecktes Feld, das nur Bots ausfüllen (sie bekommen „ok“, es geht aber keine Mail raus),
- mindestens 3 Sekunden zwischen Laden und Absenden,
- höchstens 5 Anfragen pro Stunde von derselben IP-Adresse (nur als Prüfsumme gespeichert),
- Zeilenumbrüche in Name und Adresse werden entfernt, damit niemand fremde Empfänger einschmuggeln kann.

Auf GitHub Pages läuft kein PHP. Dort kann das Formular nicht senden und zeigt den Hinweis auf hallo@showcube.de.

## Impressum und Datenschutz

`impressum.html` (Angaben nach § 5 DDG, Einzelunternehmer Manuel Schweizer, Friedrichshafen) und
`datenschutz.html` (keine Cookies, kein Tracking, Hosting bei Hostinger, Kontaktformular, Panel mit Supabase in
Frankfurt). Verlinkt im Fuß der Startseite, der Vorschaltseite „Bald da“ und der drei Seiten selbst.
Ändert sich etwas an Adresse, Hosting oder Diensten, beide Seiten anpassen. Gemeinsames Aussehen: `assets/seiten.css`.

## Tests

`tests/kontakt.spec.ts` prüft die Bausteine, das Absenden (mit nachgestellter Serverantwort), Fehlermeldungen und die
Handy-Ansicht. Außerdem startet der Test `kontakt.php` mit dem eingebauten PHP-Server (`tests/kontakt-hilfe.mjs`).
Statt einer echten Mail schreibt er in eine Datei, und der Test prüft Empfänger, Betreff, Antwortadresse und den
Spamschutz. Dafür muss PHP installiert sein (auf GitHub Actions ist es das).
