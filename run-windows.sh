#!/usr/bin/env bash
# One-command start. Reads DEMO_MODE from the environment (live|record|offline).
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d .venv ]; then
  python -m venv .venv
fi
source .venv/Scripts/activate
pip install -q -r requirements.txt

echo "DEMO_MODE=${DEMO_MODE:-live}"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
