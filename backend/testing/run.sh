#!/usr/bin/env bash
# One command to bring up the API test harness.
#   ./backend/testing/run.sh
set -euo pipefail

TESTING_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$TESTING_DIR")"
REPO_ROOT="$(dirname "$BACKEND_DIR")"

say() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mERROR:\033[0m %s\n' "$1" >&2; exit 1; }

# 1. Supabase --------------------------------------------------------------
say "Checking Supabase"
if ! command -v supabase >/dev/null 2>&1; then
  die "the supabase CLI is not on PATH"
fi
if supabase status --workdir "$REPO_ROOT" >/dev/null 2>&1; then
  echo "    already running"
else
  echo "    not running, starting it (first run pulls images, this takes a while)"
  supabase start --workdir "$REPO_ROOT"
fi

# 2. supabase-js browser bundle -------------------------------------------
say "Vendoring @supabase/supabase-js"
UMD="$REPO_ROOT/node_modules/@supabase/supabase-js/dist/umd/supabase.js"
if [ ! -f "$UMD" ]; then
  echo "    not installed, running npm install"
  (cd "$REPO_ROOT" && npm install)
fi
[ -f "$UMD" ] || die "could not find $UMD after npm install"
mkdir -p "$TESTING_DIR/vendor"
cp "$UMD" "$TESTING_DIR/vendor/supabase.js"
echo "    $(node -p "require('$REPO_ROOT/node_modules/@supabase/supabase-js/package.json').version" 2>/dev/null || echo ok)"

# 3. Env sanity ------------------------------------------------------------
say "Checking backend/.env"
[ -f "$BACKEND_DIR/.env" ] || die "backend/.env is missing — copy backend/example.env and fill it in"
for key in SUPABASE_URL SUPABASE_ANON_KEY TESTING_OIDC_PROVIDER; do
  grep -q "^${key}=." "$BACKEND_DIR/.env" || die "$key is missing or empty in backend/.env (see example.env)"
done

# 4. Backend ---------------------------------------------------------------
say "Harness will be at http://localhost:5267/testing/"
say "Starting backend (Ctrl-C to stop)"
# Env.Load() in Program.cs resolves .env relative to the working directory.
cd "$BACKEND_DIR"
ASPNETCORE_ENVIRONMENT=Development exec dotnet run
