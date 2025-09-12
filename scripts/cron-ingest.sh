#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting ingestion…"
node -v && npm -v

# Ensure Railway envs are present
: "${SUPABASE_URL:?missing SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

# Run the ingest (prints command + output)
set -x
npm run ingest:csv
set +x

echo "[Cron] Done ✅"