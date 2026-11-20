<?php
// Kontaktformular von kontakt.html: schickt die Anfrage als E-Mail an hallo@showcube.de.
// Läuft auf dem Hostinger-Webhosting (PHP). Antwortet mit JSON { ok: true } oder { ok: false, fehler: "…" }.
// Schutz gegen Spam: verstecktes Feld („website“), Mindestzeit zum Ausfüllen, höchstens 5 Anfragen pro Stunde und IP
// (IP nur als Prüfsumme, Datei wird nach einer Stunde nicht mehr beachtet), keine Zeilenumbrüche in Kopfzeilen.
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

$gesendet = mail(EMPFAENGER, mb_encode_mimeheader($betreff, 'UTF-8', 'Q'), $text, $kopf, '-f' . ABSENDER);
if (!$gesendet) antwort(500, ['ok' => false, 'fehler' => 'Das hat leider nicht geklappt. Schreib uns bitte direkt an hallo@showcube.de.']);
antwort(200, ['ok' => true]);
