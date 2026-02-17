#!/usr/bin/env bash
set -e

if [ -z "$BACKEND_BASE_URL" ]; then
  echo "❌ BACKEND_BASE_URL not set"
  exit 1
fi

echo "[Cron] Starting ingestion via API endpoint..."

curl -s -X POST \
  "$BACKEND_BASE_URL/admin/run-ingestion" \
  -H "Authorization: Bearer $IMPORT_ADMIN_TOKEN" \
  -H "Content-Type: application/json"

echo "[Cron] Done."
