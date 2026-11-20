<?php
// Kontaktformular von kontakt.html: schickt die Anfrage als E-Mail an hallo@showcube.de.
// Läuft auf dem Hostinger-Webhosting (PHP). Antwortet mit JSON { ok: true } oder { ok: false, fehler: "…" }.
// Schutz gegen Spam: verstecktes Feld („website“), Mindestzeit zum Ausfüllen, höchstens 5 Anfragen pro Stunde und IP
// (IP nur als Prüfsumme, Datei wird nach einer Stunde nicht mehr beachtet), keine Zeilenumbrüche in Kopfzeilen.
// Versand über die Hostinger-Mail-API aus dem Postfach hallo@ (signiert, landet nicht im Spam). Den Schlüssel dafür
// liest das Skript aus showcube-geheim.php eine Ebene ÜBER dem Webordner, also nie aus dem Repo. Fehlt der Schlüssel
// oder klappt die API nicht, geht die Mail wie früher mit mail() raus.
// Anleitung: docs/kontaktformular.md

declare(strict_types=1);

const EMPFAENGER = 'hallo@showcube.de';
const ABSENDER = 'hallo@showcube.de';
const THEMEN = [
  'testbox' => 'Testbox anfragen',
  'preise' => 'Preise und Pakete',
  'rueckruf' => 'Rückruf gewünscht',
  'partner' => 'Agentur oder Partner',
  'frage' => 'Allgemeine Frage',
];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

function antwort(int $status, array $daten): void {
  http_response_code($status);
  echo json_encode($daten, JSON_UNESCAPED_UNICODE);
  exit;
}
function feld(string $name, int $max): string {
  $wert = trim((string)($_POST[$name] ?? ''));
  $wert = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $wert) ?? '';
  return mb_substr($wert, 0, $max);
}
function einzeilig(string $wert): string {
  return trim(preg_replace('/[\r\n]+/', ' ', $wert) ?? '');
}
/** Schlüssel für die Mail-API: ['mail_api_token' => …, 'postfach' => 'AC…', 'mail_api_url' => optional]. */
function geheim(): array {
  $datei = getenv('SHOWCUBE_GEHEIM') ?: dirname(__DIR__) . '/showcube-geheim.php';
  if (!is_file($datei)) return [];
  $werte = include $datei;
  return is_array($werte) ? $werte : [];
}
/** Schickt die Mail über die Hostinger-Mail-API. true, wenn Hostinger sie angenommen hat (HTTP 2xx). */
function ueberMailApi(array $geheim, string $betreff, string $text, string $html): bool {
  $token = (string)($geheim['mail_api_token'] ?? '');
  $postfach = (string)($geheim['postfach'] ?? '');
  if ($token === '' || !preg_match('/^AC[A-Za-z0-9]+$/', $postfach)) return false;
  $basis = rtrim((string)($geheim['mail_api_url'] ?? 'https://api.mail.hostinger.com'), '/');
  $daten = json_encode([
    'to' => [EMPFAENGER], 'displayName' => 'ShowCube Kontaktformular',
    'subject' => $betreff, 'text' => $text, 'html' => $html,
  ], JSON_UNESCAPED_UNICODE);
  $url = "$basis/api/v1/mailboxes/$postfach/send";
  $kopf = ["Authorization: Bearer $token", 'Content-Type: application/json', 'Accept: application/json'];
  if (function_exists('curl_init')) {
    $c = curl_init($url);
    curl_setopt_array($c, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $daten, CURLOPT_HTTPHEADER => $kopf,
      CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CONNECTTIMEOUT => 5]);
    $antwort = curl_exec($c);
    $status = (int)curl_getinfo($c, CURLINFO_RESPONSE_CODE);
    if ($antwort === false) $antwort = curl_error($c);
  } else {
    $kontext = stream_context_create(['http' => ['method' => 'POST', 'timeout' => 15, 'ignore_errors' => true,
      'header' => implode("\r\n", $kopf) . "\r\n", 'content' => $daten]]);
    $antwort = @file_get_contents($url, false, $kontext);
    $status = 0;
    foreach ($http_response_header ?? [] as $zeile) if (preg_match('#^HTTP/\S+ (\d{3})#', $zeile, $m)) $status = (int)$m[1];
  }
  if ($status >= 200 && $status < 300) return true;
  error_log("kontakt.php: Mail-API antwortet $status " . mb_substr((string)$antwort, 0, 300));
  return false;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') antwort(405, ['ok' => false, 'fehler' => 'Bitte das Formular auf showcube.de/kontakt.html nutzen.']);

// Spamschutz 1: Das versteckte Feld füllen nur Bots aus. Sie bekommen trotzdem „ok“, damit sie es nicht weiter versuchen.
if (feld('website', 200) !== '') antwort(200, ['ok' => true]);

// Spamschutz 2: Menschen brauchen mehr als 3 Sekunden zum Ausfüllen.
$start = (int)feld('t', 20);
$jetzt = (int)round(microtime(true) * 1000);
if ($start <= 0 || $jetzt - $start < 3000) antwort(400, ['ok' => false, 'fehler' => 'Das ging zu schnell. Bitte schick die Anfrage noch einmal ab.']);

$name = einzeilig(feld('name', 100));
$email = einzeilig(feld('email', 200));
$betrieb = einzeilig(feld('betrieb', 150));
$telefon = einzeilig(feld('telefon', 40));
$branche = einzeilig(feld('branche', 40));
$thema = THEMEN[feld('thema', 20)] ?? 'Anfrage';
$nachricht = feld('nachricht', 5000);

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($nachricht) < 10) {
  antwort(422, ['ok' => false, 'fehler' => 'Bitte gib deinen Namen, eine gültige E-Mail-Adresse und eine kurze Nachricht an.']);
}

// Spamschutz 3: höchstens 5 Anfragen pro Stunde und IP.
$ip = (string)($_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '');
$ip = trim(explode(',', $ip)[0]);
$datei = sys_get_temp_dir() . '/showcube-kontakt-' . hash('sha256', 'showcube|' . $ip . '|' . date('YmdH'));
$anzahl = is_file($datei) ? (int)file_get_contents($datei) : 0;
if ($anzahl >= 5) antwort(429, ['ok' => false, 'fehler' => 'Du hast gerade schon mehrere Anfragen geschickt. Bitte versuch es später noch einmal oder schreib an hallo@showcube.de.']);
@file_put_contents($datei, (string)($anzahl + 1));

$host = strtolower((string)($_SERVER['HTTP_HOST'] ?? ''));
$stage = str_starts_with($host, 'stage.');
$betreff = ($stage ? '[Stage] ' : '') . '[Kontaktformular] ' . $thema . ' – ' . $name . ($betrieb !== '' ? ' (' . $betrieb . ')' : '');

$text = "Neue Anfrage über das Kontaktformular auf " . ($host ?: 'showcube.de') . "\n\n"
  . "Thema:    $thema\n"
  . "Name:     $name\n"
  . "E-Mail:   $email\n"
  . ($betrieb !== '' ? "Betrieb:  $betrieb\n" : '')
  . ($branche !== '' ? "Branche:  $branche\n" : '')
  . ($telefon !== '' ? "Telefon:  $telefon\n" : '')
  . "Zeit:     " . date('d.m.Y H:i') . "\n\n"
  . "Nachricht:\n" . str_repeat('-', 40) . "\n" . $nachricht . "\n" . str_repeat('-', 40) . "\n\n"
  . "Einfach auf diese E-Mail antworten, die Antwort geht an $email.\n";

$kopf = [
  'From' => mb_encode_mimeheader('ShowCube Kontaktformular', 'UTF-8', 'Q') . ' <' . ABSENDER . '>',
  'Reply-To' => mb_encode_mimeheader($name, 'UTF-8', 'Q') . ' <' . $email . '>',
  'MIME-Version' => '1.0',
  'Content-Type' => 'text/plain; charset=UTF-8',
  'Content-Transfer-Encoding' => '8bit',
  'X-Mailer' => 'ShowCube Kontaktformular',
];

// Die Mail-API kennt keine Antwortadresse. Deshalb steht oben in der Mail ein Knopf, der eine Antwort an die
// Person öffnet, die geschrieben hat.
$h = fn(string $w): string => htmlspecialchars($w, ENT_QUOTES, 'UTF-8');
$antwortLink = 'mailto:' . rawurlencode($email) . '?subject=' . rawurlencode('Re: Deine Anfrage bei ShowCube (' . $thema . ')');
$zeilen = [['Thema', $thema], ['Name', $name], ['E-Mail', $email], ['Betrieb', $betrieb], ['Branche', $branche], ['Telefon', $telefon], ['Zeit', date('d.m.Y H:i')]];
$html = '<div style="font:15px/1.5 system-ui,sans-serif;color:#1d2b28;max-width:640px">'
  . '<p>Neue Anfrage über das Kontaktformular auf ' . $h($host ?: 'showcube.de') . '.</p>'
  . '<p><a href="' . $h($antwortLink) . '" style="display:inline-block;padding:10px 18px;border-radius:999px;background:#0b7a67;color:#fff;text-decoration:none;font-weight:600">'
  . 'Antworten an ' . $h($name) . '</a></p><table style="border-collapse:collapse">';
foreach ($zeilen as [$k, $v]) if ($v !== '') $html .= '<tr><td style="padding:2px 16px 2px 0;color:#5b6b67">' . $h($k) . '</td><td>'
  . ($k === 'E-Mail' ? '<a href="' . $h($antwortLink) . '">' . $h($v) . '</a>' : $h($v)) . '</td></tr>';
$html .= '</table><p style="white-space:pre-wrap;border-left:3px solid #0b7a67;padding-left:12px">' . $h($nachricht) . '</p></div>';
$textApi = str_replace("Einfach auf diese E-Mail antworten, die Antwort geht an $email.", "Antwort bitte an $email schicken (Knopf „Antworten an …“ oben in der Mail).", $text);

$gesendet = ueberMailApi(geheim(), $betreff, $textApi, $html)
  || mail(EMPFAENGER, mb_encode_mimeheader($betreff, 'UTF-8', 'Q'), $text, $kopf, '-f' . ABSENDER);
if (!$gesendet) antwort(500, ['ok' => false, 'fehler' => 'Das hat leider nicht geklappt. Schreib uns bitte direkt an hallo@showcube.de.']);
antwort(200, ['ok' => true]);
