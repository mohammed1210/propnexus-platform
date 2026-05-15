#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

service_name="${RAILWAY_SERVICE_NAME:-${RAILWAY_SERVICE:-${SERVICE_NAME:-}}}"
process_type="${PROCESS_TYPE:-}"

if [[ "${INGEST_WORKER:-}" == "1" || "$process_type" == "worker" || "$service_name" == "vivacious-embrace" || "$service_name" == *"ingest"* || "$service_name" == *"worker"* ]]; then
  export SCRAPER_MODE="${SCRAPER_MODE:-direct}"
  export INGEST_SOURCES="${INGEST_SOURCES:-zoopla,onthemarket,spareroom}"
  export INGEST_INTERVAL_SECONDS="${INGEST_INTERVAL_SECONDS:-900}"
  echo "[railway-start] service=$service_name process=$process_type command=python -m backend.tasks.ingestion_runner"
  exec python -m backend.tasks.ingestion_runner
fi

port="${PORT:-8080}"
echo "[railway-start] service=$service_name process=$process_type command=uvicorn backend.main:app --port $port"
exec uvicorn backend.main:app --host 0.0.0.0 --port "$port"
