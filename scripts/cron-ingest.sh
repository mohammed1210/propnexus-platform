#!/bin/bash
set -e

echo "[Cron] Starting ingestion..."
npm run ingest:csv
echo "[Cron] Done ✅"