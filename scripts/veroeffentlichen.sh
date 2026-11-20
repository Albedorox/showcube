#!/usr/bin/env bash
# Legt die fertige Website (Ordner aus scripts/website.mjs) als neuen Commit auf einen Website-Branch:
#   website-stage → stage.showcube.de, website-prod → showcube.de
# Hostinger ist mit diesen Branches verbunden (Git-Deployment in hPanel) und holt jeden neuen Commit
# sofort selbst ab. Auf diesen Branches liegt nur, was online gehört, kein Quellcode.
# Aufruf aus GitHub Actions: scripts/veroeffentlichen.sh <ordner> <branch> <stand>   Anleitung: docs/deployment.md
set -euo pipefail

quelle="${1:?Ordner fehlt}"
branch="${2:?Branch fehlt}"
stand="${3:?Stand fehlt}"
case "$branch" in website-stage|website-prod) ;; *) echo "::error::Branch „$branch“ ist kein Website-Branch." >&2; exit 1 ;; esac

adresse="https://x-access-token:${GITHUB_TOKEN:?}@github.com/${GITHUB_REPOSITORY:?}.git"
arbeit="$(mktemp -d)"
if git ls-remote --exit-code --heads "$adresse" "$branch" >/dev/null; then
  git clone -q --depth 1 --branch "$branch" "$adresse" "$arbeit"
else
  git -C "$arbeit" init -q -b "$branch"
  git -C "$arbeit" remote add origin "$adresse"
fi

# Inhalt komplett ersetzen: was es nicht mehr gibt, verschwindet auch online.
find "$arbeit" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a "$quelle"/. "$arbeit"/

cd "$arbeit"
git add -A
if git diff --cached --quiet; then
  echo "Keine Änderung, $branch zeigt schon diesen Stand."
  exit 0
fi
git -c user.name='github-actions[bot]' -c user.email='41898341+github-actions[bot]@users.noreply.github.com' \
  commit -q -m "Website ${stand:0:7} (${branch#website-})" -m "Stand auf main: $stand"
git push -q origin "$branch"
echo "$branch zeigt jetzt $stand"
