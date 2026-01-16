#!/usr/bin/env bash
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$REPO/frontend"
BACKEND="$REPO/backend"
PY="$REPO/.venv/bin/python"

print_help() {
	local commit_sha
	commit_sha=""
	if command -v git >/dev/null 2>&1; then
		commit_sha="$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || true)"
	fi

	cat <<EOF
PropNexus: Sprint Runner

Repo: ${commit_sha:-unknown}

Usage:
  ./sprint-runner.sh
  ./sprint-runner.sh --help

What it runs:
  0) Repo status: git status + last commit
  1) Frontend: lint, type-check, test, build
  2) Backend: pytest (skips known network/integration-dependent tests)

Backend full integration tests (ONLY when env is set):
  export BACKEND_URL='https://<your-backend>'
  export SUPABASE_URL='https://<project>.supabase.co'
  export SUPABASE_SERVICE_ROLE_KEY='...'
  $PY -m pytest -q $BACKEND/tests

Billing keyword search (no ripgrep required):
  grep -RIn -E --exclude-dir node_modules --exclude-dir .next --exclude-dir .venv \
    "MRR|ARR|stripe|checkout|portal|subscription|price_" .
EOF
}

case "${1:-}" in
	-h|--help|help)
		print_help
		exit 0
		;;
	"")
		;;
	*)
		echo "ERROR: Unknown argument: $1" >&2
		print_help >&2
		exit 2
		;;
esac

if [[ ! -d "$FRONTEND" ]]; then
	echo "ERROR: frontend folder not found at: $FRONTEND" >&2
	exit 1
fi

if [[ ! -d "$BACKEND" ]]; then
	echo "ERROR: backend folder not found at: $BACKEND" >&2
	exit 1
fi

if ! command -v git >/dev/null 2>&1; then
	echo "ERROR: git not found on PATH" >&2
	exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
	echo "ERROR: npm not found on PATH" >&2
	exit 1
fi

if [[ ! -x "$PY" ]]; then
	echo "ERROR: Expected Python venv not found at: $REPO/.venv/bin/python" >&2
	echo "Create it with:" >&2
	echo "  cd $REPO" >&2
	echo "  python3 -m venv .venv" >&2
	echo "  . .venv/bin/activate" >&2
	echo "  pip install -r backend/requirements.txt" >&2
	exit 1
fi

echo "=============================="
echo "PropNexus: Sprint Runner"
echo "=============================="

echo ""
echo "0) Repo status"
git -C "$REPO" status -sb
git -C "$REPO" log -1 --oneline

echo ""
echo "1) Frontend checks"
npm --prefix "$FRONTEND" run -s lint
npm --prefix "$FRONTEND" run -s type-check
npm --prefix "$FRONTEND" run -s test
npm --prefix "$FRONTEND" run -s build

echo ""
echo "2) Backend tests (skip integration/network)"
# These failures are almost always because BACKEND_URL / SUPABASE env isn't set.
# We skip them by excluding common integration markers and known network-dependent tests.
"$PY" -m pytest -q "$BACKEND/tests" -k "not properties_api_returns_rows and not stripe_webhook_endpoint_reachable and not required_columns_exist"

echo ""
echo "3) To run full integration tests (ONLY when env is set)"
echo "export BACKEND_URL='https://<your-backend>'"
echo "export SUPABASE_URL='https://<project>.supabase.co'"
echo "export SUPABASE_SERVICE_ROLE_KEY='...'"
echo "$PY -m pytest -q $BACKEND/tests"

echo ""
echo "4) Billing keyword search (no ripgrep required)"
echo "grep -RIn -E --exclude-dir node_modules --exclude-dir .next --exclude-dir .venv \"MRR|ARR|stripe|checkout|portal|subscription|price_\" ."
