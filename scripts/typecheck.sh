#!/usr/bin/env bash
# Memory-safe typecheck for parallel agents: only one tsc at a time across the repo (each api tsc run needs ~2-3 GB).
# Usage: bash scripts/typecheck.sh api|app
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/.typecheck.lock"
TARGET="${1:-api}"
waited=0
until mkdir "$LOCK" 2>/dev/null; do
  # Break stale locks older than 10 minutes.
  if [ -d "$LOCK" ] && [ $(( $(date +%s) - $(stat -c %Y "$LOCK" 2>/dev/null || date +%s) )) -gt 600 ]; then rmdir "$LOCK" 2>/dev/null; fi
  sleep 5; waited=$((waited+5))
  [ $((waited % 60)) -eq 0 ] && echo "[typecheck] waiting for another typecheck to finish (${waited}s)"
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT
cd "$ROOT/$TARGET"
if [ "$TARGET" = "api" ]; then
  NODE_OPTIONS=--max-old-space-size=4096 npx tsc --noEmit -p tsconfig.json
else
  npx tsc -b
fi
