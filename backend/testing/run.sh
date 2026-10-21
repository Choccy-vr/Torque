#!/usr/bin/env bash
# One command to bring up the API test harness.
#   ./backend/testing/run.sh
set -euo pipefail

TESTING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$TESTING_DIR")"
REPO_ROOT="$(dirname "$BACKEND_DIR")"

say() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }

# 1. Postgres --------------------------------------------------------------
say "Checking Postgres (compose service \"db\")"
command -v docker >/dev/null 2>&1 || die "docker is not on PATH"
docker compose -f "$REPO_ROOT/compose.yaml" up -d --wait db

# 2. Env sanity ------------------------------------------------------------
say "Checking backend/.env"
[ -f "$BACKEND_DIR/.env" ] || die "backend/.env is missing — copy backend/example.env and fill it in"
for key in DB_CONNECTION_STRING HCA_CLIENT_ID HCA_CLIENT_SECRET OAUTH_STATE_SECRET; do
  grep -q "^${key}=." "$BACKEND_DIR/.env" || die "$key is missing or empty in backend/.env (see example.env)"
done

# 3. Schema ----------------------------------------------------------------
say "Applying migrations"
(cd "$BACKEND_DIR" && dotnet ef database update)

# 4. Backend ---------------------------------------------------------------
say "Harness will be at http://localhost:5267/testing/"
say "Starting backend (Ctrl-C to stop)"
# Env.Load() in Program.cs resolves .env relative to the working directory.
cd "$BACKEND_DIR"
ASPNETCORE_ENVIRONMENT=Development exec dotnet run
