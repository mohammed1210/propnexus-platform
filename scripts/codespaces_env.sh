#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   source scripts/codespaces_env.sh [optional-env-file]
#
# Loads env vars commonly needed for curl-based verification in Codespaces/devcontainers.
# - Does NOT print secrets.
# - If an env file is provided, it will be sourced.
# - Otherwise, tries .env.codespaces then .env.local then .env (if present).

pick_env_file() {
  local candidate
  for candidate in "${1:-}" .env.codespaces .env.local .env; do
    if [[ -n "$candidate" && -f "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

ENV_FILE=""
if ENV_FILE="$(pick_env_file "${1:-}")"; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

# Convenience: allow storing admin token in a local file (ignored by git).
if [[ -z "${ADMIN_TOKEN:-}" && -f .admin_token ]]; then
  ADMIN_TOKEN="$(tr -d '\n' < .admin_token)"
  export ADMIN_TOKEN
fi

# Defaults (safe): allow BACKEND_URL to be overridden.
if [[ -z "${BACKEND_URL:-}" ]]; then
  export BACKEND_URL="http://localhost:8000"
fi

# Summary (no secrets)
echo "[codespaces_env] loaded: ${ENV_FILE:-<none>}"
echo "[codespaces_env] BACKEND_URL=${BACKEND_URL}"
echo "[codespaces_env] ADMIN_TOKEN=${ADMIN_TOKEN:+<set>}"
