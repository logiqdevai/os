#!/usr/bin/env bash
# Dev runner for heavy parallel editing on Windows (nest --watch never settles when many files change).
# Every few seconds: if src/ changed and has been quiet for QUIET seconds, run an SWC build and restart the API.
# The previous API instance keeps serving until the new build is ready.
cd "$(dirname "$0")/.."
QUIET=${QUIET:-6}
PID=""
last_built=""

stamp() { find src -type f -name '*.ts' -newer .dev-stamp 2>/dev/null | head -1; }

free_port() {
  powershell -NoProfile -Command "\$p=(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique; foreach(\$i in \$p){ Stop-Process -Id \$i -Force -ErrorAction SilentlyContinue }" >/dev/null 2>&1
}

build_and_start() {
  echo "[dev] building $(date +%T)"
  touch .dev-stamp
  if npx nest build >/tmp/lq-build.log 2>&1; then
    free_port
    [ -n "$PID" ] && kill "$PID" 2>/dev/null
    npx dotenv run -f .env.staging -- node dist/main.js 2>&1 | grep --line-buffered -E "ERROR|Error|started|EADDRINUSE|Exception" &
    PID=$!
    echo "[dev] started $(date +%T)"
  else
    echo "[dev] build failed:"; tail -20 /tmp/lq-build.log
  fi
}

build_and_start
while true; do
  sleep 3
  if [ -n "$(stamp)" ]; then
    newest=$(find src -type f -name '*.ts' -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)
    now=$(date +%s)
    if [ $((now - newest)) -ge "$QUIET" ]; then build_and_start; fi
  fi
  # restart if the API process died
  if ! curl -s -m 2 -o /dev/null localhost:3000/health; then
    sleep 5
    curl -s -m 2 -o /dev/null localhost:3000/health || build_and_start
  fi
done
