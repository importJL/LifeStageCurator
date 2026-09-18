#!/usr/bin/env bash
# Start the Next.js web app and the Python enrichment service together.
# One Ctrl-C stops both. Usage: npm run dev:all
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENRICHMENT_DIR="$ROOT/enrichment"
VENV="$ENRICHMENT_DIR/.venv"
ENRICHMENT_PORT="${ENRICHMENT_PORT:-8000}"

if [[ ! -x "$VENV/bin/uvicorn" ]]; then
  echo "Enrichment environment not found. Set it up once with:"
  echo "  cd enrichment && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'"
  exit 1
fi

if [[ ! -f "$ENRICHMENT_DIR/.env" ]]; then
  echo "! enrichment/.env not found — copy enrichment/.env.example to .env for real LLM calls."
fi

ENRICH_PID=""

cleanup() {
  if [[ -n "$ENRICH_PID" ]] && kill -0 "$ENRICH_PID" 2>/dev/null; then
    kill "$ENRICH_PID" 2>/dev/null || true
    wait "$ENRICH_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[enrichment] http://127.0.0.1:$ENRICHMENT_PORT"
( cd "$ENRICHMENT_DIR" && exec "$VENV/bin/uvicorn" app.main:app --reload --port "$ENRICHMENT_PORT" ) &
ENRICH_PID=$!

echo "[web] http://localhost:3000"
( cd "$ROOT" && exec npm run dev )
