#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting ingestion…"
node -v && npm -v

# Ensure Railway env vars are present (these are set on your service)
: "${SUPABASE_URL:?missing SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

# Run the ingest (CSV path is inside the repo)
npm run ingest:csv --silent

echo "[Cron] Done ✅"