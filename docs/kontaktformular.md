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
zusätzlich `[Stage]`.

Die Mail geht über die **Hostinger-Mail-API** aus dem Postfach hallo@ an hallo@. So ist sie vom echten Mailserver
signiert (DKIM, SPF und DMARC bestanden) und landet im Posteingang statt im Spam. Die Mail-API kennt keine
Antwortadresse: Oben in der Mail steht deshalb der Knopf **„Antworten an …“**, und die E-Mail-Adresse ist ein Link.
Beides öffnet eine Antwort an die Person, die geschrieben hat. „Antworten“ im Mailprogramm ginge an hallo@ selbst.
Eine Kopie jeder Anfrage liegt außerdem im Ordner „Gesendet“ von hallo@.

**Der Schlüssel** für die Mail-API liegt nur auf dem Server, nie im Repo: in `showcube-geheim.php` eine Ebene über dem
Webordner (`domains/showcube.de/` und `domains/stage.showcube.de/`, neben `public_html`). Inhalt:

```php
<?php
return ['mail_api_token' => '…', 'postfach' => 'AC191ac6c7eb0a0c4f1cd1c845d05c'];
```

Der Schlüssel heißt bei Hostinger „Kontaktformular showcube.de“, gilt nur für das Postfach hallo@ und wurde am
20.11.2026 angelegt. Neu anlegen oder sperren: in hPanel unter E-Mails → showcube.de → Agentic Mail → API-Zugang
(oder über den Hostinger-Connector, `mail_api-tokens_create` bzw. `mail_api-tokens_revoke`), dann die Datei auf beiden
Seiten ersetzen.

**Rückfall:** Fehlt die Datei oder antwortet die Mail-API nicht, schickt `kontakt.php` die Mail wie früher mit
`mail()` direkt vom Webserver. Die kommt auch an, aber ohne Signatur und deshalb meist im Spam-Ordner. Der Fehler
steht dann im PHP-Fehlerprotokoll von Hostinger („kontakt.php: Mail-API antwortet …“).

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
Handy-Ansicht. Außerdem startet der Test `kontakt.php` mit dem eingebauten PHP-Server (`tests/kontakt-hilfe.mjs`), einmal mit
einer nachgestellten Mail-API (prüft Postfach, Schlüssel, Empfänger, Betreff, Antwort-Knopf und dass HTML aus der Anfrage
nicht ausgeführt wird) und einmal ohne Schlüssel. Dann schreibt `mail()` in eine Datei statt eine echte Mail zu
schicken, und der Test prüft Empfänger, Betreff, Antwortadresse, den Rückfall und den Spamschutz. Dafür muss PHP installiert sein (auf GitHub Actions ist es das).
