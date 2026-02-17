#!/usr/bin/env bash
set -euo pipefail

# Thin wrapper to avoid drift.
# Canonical implementation lives at: backend/scripts/cron-ingest.sh

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

exec bash "$REPO_ROOT/backend/scripts/cron-ingest.sh" "$@"
