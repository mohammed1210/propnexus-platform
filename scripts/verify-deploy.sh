#!/usr/bin/env bash
set -euo pipefail

API_BASE=${1:-${API_BASE:-}}

if [[ -z "${API_BASE}" ]]; then
  echo "Usage: $0 <api-base-url>" >&2
  echo "Tip: This should be your BACKEND base URL (Railway/Render). If you pass a Vercel URL, this script will try /api/* fallbacks." >&2
  exit 1
fi

# Trim trailing slash for consistent URL joining
API_BASE="${API_BASE%/}"

# Curl defaults (fast fail, but with enough info to debug)
CURL_COMMON=(-sS --connect-timeout 10 --max-time 30)

echo "Verifying PropNexus API at ${API_BASE}"
echo "----------------------------------------"

curl_request() {
  local method="$1"
  local url="$2"
  local data="${3:-}"

  if [[ "$method" == "GET" ]]; then
    curl "${CURL_COMMON[@]}" -w $'\nHTTPSTATUS:%{http_code}\nCONTENTTYPE:%{content_type}\n' "$url"
  else
    curl "${CURL_COMMON[@]}" -w $'\nHTTPSTATUS:%{http_code}\nCONTENTTYPE:%{content_type}\n' \
      -H 'Content-Type: application/json' \
      -d "$data" \
      -X "$method" \
      "$url"
  fi
}

curl_check() {
  local method="$1"
  local endpoint="$2"
  local expected="$3"
  local data="${4:-}"

  local url="${API_BASE}${endpoint}"
  echo
  echo "=== ${method} ${url}"

  local response body status ctype
  response="$(curl_request "$method" "$url" "$data")"

  body="$(echo "$response" | sed -n '1,/^HTTPSTATUS:/p' | sed '$d')"
  status="$(echo "$response" | awk -F: '/^HTTPSTATUS:/ {print $2}' | tr -d '\r')"
  ctype="$(echo "$response" | awk -F: '/^CONTENTTYPE:/ {print $2}' | tr -d '\r')"

  echo "Status: ${status}"
  echo "Content-Type: ${ctype:-unknown}"
  echo "Body (first 300 chars): ${body:0:300}"

  if [[ "$status" -ne "$expected" ]]; then
    echo "❌ Expected ${expected}, got ${status}"
    return 1
  fi

  return 0
}

looks_like_frontend_404() {
  local body="$1"
  # Common signals you hit Vercel/HTML page instead of API
  if echo "$body" | grep -qiE '<!doctype html|<html|next\.js|Application not found|vercel'; then
    return 0
  fi
  return 1
}

# ---- Resolve whether routes are at root (/health) or under /api (/api/health) ----
HEALTH_PATH="/health"
PROPERTIES_PATH="/properties"
OFFMARKET_PATH="/off-market/generate-off-market"

# Try /health first
echo
echo "Resolving API route prefix..."
raw="$(curl_request "GET" "${API_BASE}/health")"
body="$(echo "$raw" | sed -n '1,/^HTTPSTATUS:/p' | sed '$d')"
status="$(echo "$raw" | awk -F: '/^HTTPSTATUS:/ {print $2}' | tr -d '\r')"

if [[ "$status" == "200" ]]; then
  echo "✅ Using root API paths (e.g. /health, /properties)"
else
  # If 404 and HTML-ish, try /api/health (common when API is behind Next.js)
  if [[ "$status" == "404" ]] && looks_like_frontend_404 "$body"; then
    echo "ℹ️  /health returned HTML/404 — this looks like a FRONTEND URL. Trying /api/health..."
  else
    echo "ℹ️  /health not OK (status ${status}). Trying /api/health as fallback..."
  fi

  raw2="$(curl_request "GET" "${API_BASE}/api/health")"
  body2="$(echo "$raw2" | sed -n '1,/^HTTPSTATUS:/p' | sed '$d')"
  status2="$(echo "$raw2" | awk -F: '/^HTTPSTATUS:/ {print $2}' | tr -d '\r')"

  if [[ "$status2" == "200" ]]; then
    HEALTH_PATH="/api/health"
    PROPERTIES_PATH="/api/properties"
    OFFMARKET_PATH="/api/off-market/generate-off-market"
    echo "✅ Using /api-prefixed paths (e.g. /api/health, /api/properties)"
  else
    echo "❌ Could not reach a working health endpoint."
    echo "Tried:"
    echo " - ${API_BASE}/health (status ${status})"
    echo " - ${API_BASE}/api/health (status ${status2})"
    echo
    echo "Most likely fix:"
    echo " - Set API_BASE to your BACKEND URL (Railway/Render), not the Vercel frontend URL."
    exit 1
  fi
fi

# ---- Now run actual checks using resolved paths ----
curl_check GET "${HEALTH_PATH}" 200

# Properties endpoint
curl_check GET "${PROPERTIES_PATH}" 200

# Off-market endpoint (expects POST)
payload='{"location":"RG1","budget":200000,"count":1}'
curl_check POST "${OFFMARKET_PATH}" 200 "$payload"

echo
echo "✅ All checks passed."
