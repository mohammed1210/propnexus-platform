#!/usr/bin/env bash
set -euo pipefail

#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting ingestion…"
node -v && npm -v

# fail fast if Railway envs aren’t present
: "${SUPABASE_URL:?missing SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

# run the root package script (works regardless of CWD)
npm --prefix . run ingest:csv --silent

echo "[Cron] Done ✅"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "[Cron] node/npm not found — skipping ingestion loop."
  sleep infinity
fi
