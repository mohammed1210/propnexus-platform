#!/usr/bin/env bash
set -euo pipefail

echo "[Cron] Starting Python ingestion runner…"

# Ensure we are at repo root (script lives in scripts/)
cd "$(dirname "$0")/.."

# Optional: create virtualenv if not already (Railway Nixpacks may handle deps)
if [ ! -d ".venv" ]; then
  python3 -m venv .venv || true
fi
source .venv/bin/activate || true

# Install backend deps if not present (idempotent; can be skipped in build stage)
if [ -f backend/requirements.txt ]; then
  pip install --disable-pip-version-check --no-cache-dir -r backend/requirements.txt >/dev/null 2>&1 || true
fi

# Run one cycle or continuous loop depending on INGEST_RUN_ONCE
python -m backend.tasks.ingestion_runner

# If the runner exits (e.g. RUN_ONCE), keep container alive for cron semantics
if [ "${INGEST_RUN_ONCE:-0}" = "1" ]; then
  echo "[Cron] Single ingestion cycle complete. Exiting.";
else
  echo "[Cron] Ingestion runner terminated unexpectedly; sleeping to prevent rapid restarts.";
  sleep 600
fi
