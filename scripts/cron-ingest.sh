#!/usr/bin/env bash
set -euo pipefail

#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting ingestion…"

# If Node isn’t present (Railway Python image), don’t crash the container.
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "[Cron] node/npm not found — skipping ingestion loop."
  # Keep the worker alive without doing anything
  sleep infinity
fi

# … your real ingestion steps go here …
# npm ci --omit=dev
# npm run scrape
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "[Cron] node/npm not found — skipping ingestion loop."
  sleep infinity
fi
