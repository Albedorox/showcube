#!/usr/bin/env bash
# Richtet eine ShowCube-Box auf einem Raspberry Pi ein (Raspberry Pi OS mit Desktop, labwc).
#
#   bash box-einrichten.sh [--light] [pfad/zu/player.html]
#
# --light: Box läuft nur mit Inhalten vom Stick (ShowCube Light), kein Koppel-Code auf dem Fernseher.
#          Mit Taste E und „Mit ShowCube Cloud verbinden“ wird sie später trotzdem zur Cloud-Box.
# - Legt den Player nach ~/player/index.html (ohne Pfad: vom USB-Stick).
# - Berechnet die Box-Kennung aus der Seriennummer des Pi, z.B. SC-K7QD-2MXA. Sie steht aufs Gehäuse.
# - Erzeugt einmalig einen geheimen Box-Schlüssel. Kennung und Schlüssel liegen in ~/.config/showcube/box
#   (nur für diesen Benutzer lesbar) und überstehen damit jedes Zurücksetzen des Browsers.
# - Startet den Player beim Hochfahren im Vollbild, als Cloud-Box mit Kennung und Schlüssel.
# Mehrfach ausführen ist ungefährlich: Kennung und Schlüssel bleiben gleich.
set -euo pipefail

CONF="$HOME/.config/showcube"
BOX="$CONF/box"
PLAYER_DIR="$HOME/player"
AUTOSTART="$HOME/.config/labwc/autostart"

seriennummer() {
  local s="${SHOWCUBE_SERIE:-}"   # nur zum Testen auf einem anderen Rechner
  if [ -z "$s" ] && [ -r /sys/firmware/devicetree/base/serial-number ]; then
    s=$(tr -d '\0' < /sys/firmware/devicetree/base/serial-number)
  fi
  if [ -z "$s" ]; then
    s=$(awk -F': *' '/^Serial/ {print $2}' /proc/cpuinfo 2>/dev/null || true)
  fi
  # Führende Nullen weg, klein geschrieben: beide Quellen liefern so denselben Wert.
  s=$(printf '%s' "$s" | tr -d '[:space:]' | tr 'A-F' 'a-f' | sed 's/^0*//')
  printf '%s' "$s"
}

kennung_aus() {
  # SHA-256 über die Seriennummer, die ersten 5 Bytes als Base32 (A-Z, 2-7): 8 Zeichen, keine 0/1 zum Verwechseln.
  local k
  local hex
  hex=$(printf 'showcube-box:%s' "$1" | sha256sum | cut -c1-10)
  k=$(printf "$(printf '%s' "$hex" | sed 's/../\\x&/g')" | base32)
  printf 'SC-%s-%s' "${k:0:4}" "${k:4:4}"
}

mkdir -p "$CONF" "$PLAYER_DIR" "$(dirname "$AUTOSTART")"
chmod 700 "$CONF"

if [ -f "$BOX" ]; then
  # shellcheck disable=SC1090
  . "$BOX"
fi
SERIE=$(seriennummer)
if [ -z "$SERIE" ]; then
  echo "Keine Seriennummer gefunden. Ist das ein Raspberry Pi?" >&2
  exit 1
fi
NEU=$(kennung_aus "$SERIE")
if [ -n "${KENNUNG:-}" ] && [ "$KENNUNG" != "$NEU" ]; then
  echo "Achtung: $BOX gehört zu $KENNUNG, dieser Pi hat aber $NEU (Karte aus einer anderen Box?)." >&2
  echo "Datei löschen und das Skript neu starten, um die Karte für diesen Pi einzurichten." >&2
  exit 1
fi
KENNUNG=$NEU
if [ -z "${SCHLUESSEL:-}" ]; then
  SCHLUESSEL=$(head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n')
fi
umask 077
printf 'KENNUNG=%s\nSCHLUESSEL=%s\n' "$KENNUNG" "$SCHLUESSEL" > "$BOX"

MODUS="cloud&"; QUELLE=""
for a in "$@"; do
  case "$a" in
    --light) MODUS="" ;;
    *) QUELLE="$a" ;;
  esac
done
if [ -z "$QUELLE" ]; then QUELLE=$(ls /media/"${USER:-$(id -un)}"/*/player.html 2>/dev/null | head -n1 || true); fi
if [ -n "$QUELLE" ]; then
  cp "$QUELLE" "$PLAYER_DIR/index.html"
  chmod 644 "$PLAYER_DIR/index.html"
elif [ ! -f "$PLAYER_DIR/index.html" ]; then
  echo "player.html nicht gefunden. Stick einstecken oder Pfad angeben: bash box-einrichten.sh /pfad/zu/player.html" >&2
  exit 1
fi

CHROMIUM=$(command -v chromium || command -v chromium-browser || echo chromium)
ZEILE="$CHROMIUM --kiosk --noerrdialogs --disable-infobars --autoplay-policy=no-user-gesture-required 'file://$PLAYER_DIR/index.html?${MODUS}box=$KENNUNG&key=$SCHLUESSEL' & # showcube"
touch "$AUTOSTART"
# Alte Player-Zeilen ersetzen (auch die aus der Anleitung ohne Markierung).
grep -v -e '# showcube$' -e "$PLAYER_DIR/index.html" "$AUTOSTART" > "$AUTOSTART.neu" || true
printf '%s\n' "$ZEILE" >> "$AUTOSTART.neu"
mv "$AUTOSTART.neu" "$AUTOSTART"
chmod 600 "$AUTOSTART"

sudo raspi-config nonint do_blanking 1 2>/dev/null || true

cat <<EOF

  ShowCube-Box eingerichtet.

    Box-Kennung:  $KENNUNG

  Diese Kennung aufs Gehäuse drucken. Sie zeigt sich auch auf dem Fernseher beim Koppeln
  und im Panel unter dem Bildschirm. Der Schlüssel bleibt geheim in $BOX.

  Jetzt neu starten: sudo reboot
EOF
