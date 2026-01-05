#!/usr/bin/env bash
set -euo pipefail

echo "== Frontend =="
npm --prefix frontend ci
npm --prefix frontend run build

echo "== Backend =="
python -m pip install -r backend/requirements.txt

echo "== Pre-commit (check) =="
pre-commit run --all-files --show-diff-on-failure
