#!/usr/bin/env bash
# Wartet, bis eine Website den erwarteten Stand zeigt (version.txt), höchstens etwa 4 Minuten.
# Aufruf: scripts/online-pruefen.sh <adresse mit / am Ende> <stand>
set -uo pipefail
adresse="${1:?Adresse fehlt}"; stand="${2:?Stand fehlt}"
online=''
for versuch in $(seq 1 24); do
  online=$(curl -fsS -H 'Cache-Control: no-cache' "${adresse}version.txt?t=$(date +%s)" 2>/dev/null | tr -d '[:space:]')
  [ "$online" = "$stand" ] && { echo "${adresse} zeigt $stand"; exit 0; }
  echo "Versuch $versuch: online steht „${online:-nichts}“, warte …"; sleep 10
done
if [ -z "$online" ]; then
  # Noch nie ein Stand online: Hostinger ist noch nicht mit dem Branch verbunden (Ersteinrichtung).
  echo "::warning::${adresse} liefert noch keine version.txt. Ist Hostinger schon mit dem Website-Branch verbunden? Siehe docs/deployment.md."
  exit 0
fi
echo "::error::${adresse} zeigt nach 4 Minuten noch „$online“ statt $stand. In hPanel unter Git → Deployments nachsehen."
exit 1
