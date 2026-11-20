#!/usr/bin/env bash
# Sagt Hostinger, dass es einen Website-Branch jetzt abholen soll (Git-Deployment über die Hostinger-API).
# Hostinger reagiert nicht verlässlich von selbst auf Pushes aus GitHub Actions, deshalb stößt der Workflow
# das Abholen selbst an: Die Auto-Deploy-Einstellung wird neu gespeichert, das deployt den Branch sofort.
# Aufruf: scripts/hostinger-abholen.sh <domain> <branch>
# Braucht das Repository-Secret HOSTINGER_API_TOKEN (hPanel → Profil → API). Anleitung: docs/deployment.md
set -euo pipefail
domain="${1:?Domain fehlt}"; branch="${2:?Branch fehlt}"
konto="${HOSTINGER_KONTO:-u841804110}"
api="https://developers.hostinger.com/api/hosting/v1"

if [ -z "${HOSTINGER_API_TOKEN:-}" ]; then
  echo "::warning::Secret HOSTINGER_API_TOKEN fehlt. Hostinger muss $branch selbst abholen, siehe docs/deployment.md."
  exit 0
fi
anfrage() { curl -fsS --retry 3 --retry-delay 5 -H "Authorization: Bearer $HOSTINGER_API_TOKEN" -H 'Accept: application/json' "$@"; }

installation=$(anfrage "$api/git/installations" | jq -r '[.[] | select(.provider == "github" and .status == "active")][0].uuid // empty')
[ -n "$installation" ] || { echo "::error::Keine aktive GitHub-Verbindung in Hostinger (hPanel → Websites → Verwalten → Erweitert → Git)."; exit 1; }

besitzer="${GITHUB_REPOSITORY%%/*}"; repo="${GITHUB_REPOSITORY##*/}"
anfrage -X PUT -H 'Content-Type: application/json' \
  --data "$(jq -n --arg i "$installation" --arg o "$besitzer" --arg r "$repo" --arg b "$branch" \
    '{installation_uuid: $i, owner: $o, repository: $r, branch: $b, directory: "", is_enabled: true}')" \
  "$api/accounts/$konto/websites/$domain/git/auto-deployments/settings" >/dev/null
echo "Hostinger holt $branch für $domain ab."
