#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

# Ensure we're in the repo root
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Fetch latest from remote
git fetch origin

if $DRY_RUN; then
  echo "=== DRY RUN ==="
  echo ""
  echo "Current staging HEAD:"
  git log origin/staging -1 --oneline
  echo ""
  echo "Current master HEAD:"
  git log origin/master -1 --oneline
  echo ""
  echo "Commits on staging not yet in master:"
  git log origin/master..origin/staging --oneline
  echo ""
  echo "Files that would change:"
  git diff --stat origin/master..origin/staging
  echo ""
  echo "No changes made. Remove --dry-run to deploy."
  exit 0
fi

# Switch to master and merge staging
git checkout master
git pull origin master
git merge origin/staging --no-ff -m "deploy: merge staging into master"
git push origin master

echo ""
echo "Deployed to production. Vercel will build and promote automatically."
echo "Monitor the deployment at: https://vercel.com"
echo "Health check: https://assessment.valuetovictory.com/api/health"
