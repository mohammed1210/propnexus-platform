#!/usr/bin/env bash
set -euo pipefail

BACKEND_URL="${BACKEND_URL:-${BACKEND_BASE_URL:-https://propnexus-backend-production.up.railway.app}}"
TOKEN_FILE="${TOKEN_FILE:-.admin_token}"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "Token file not found: $TOKEN_FILE" >&2
  echo "Create one (no newline preferred): echo -n '...token...' > .admin_token" >&2
  exit 1
fi

ADMIN_TOKEN="$(cat "$TOKEN_FILE" | tr -d '\r\n')"
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "Admin token is empty (file: $TOKEN_FILE)" >&2
  exit 1
fi

PAYLOAD="${PAYLOAD:-{"location":"Manchester","mode":"scraperapi","limit":5}}"

call() {
  local label="$1"
  shift

  local tmp
  tmp="$(mktemp)"
  local code

  echo "==> $label"
  code=$(curl -sS -o "$tmp" -w "%{http_code}" \
    -X POST "$BACKEND_URL/admin/run-ingestion" \
    -H "Content-Type: application/json" \
    "$@" \
    --data "$PAYLOAD" \
  )

  cat "$tmp"
  echo
  rm -f "$tmp"

  if [[ "$code" -lt 200 || "$code" -ge 300 ]]; then
    echo "Request failed: HTTP $code" >&2
    exit 1
  fi
}

call "Auth via X-Admin-Token" \
  -H "X-Admin-Token: $ADMIN_TOKEN"

call "Auth via Authorization: Bearer" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo "OK"
