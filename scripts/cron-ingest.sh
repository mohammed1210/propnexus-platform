#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting ingestion…"
node -v && npm -v

# Ensure required Railway env vars exist
: "${SUPABASE_URL:?missing SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?missing SUPABASE_SERVICE_ROLE_KEY}"

# Run the root package script (works even if CWD isn’t repo root)
npm --prefix . run ingest:csv --silent

echo "[Cron] Done ✅"