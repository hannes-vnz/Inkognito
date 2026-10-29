#!/usr/bin/env bash
# Testet die Supabase-Migrationen gegen ein lokales Postgres (ohne Supabase-CLI).
# Aufruf: PGHOST=… PGPORT=… scripts/test-db.sh   (Standard: lokaler Server, Benutzer postgres)
set -euo pipefail
cd "$(dirname "$0")/.."
DB="inkognito_test_$$"
export PGUSER="${PGUSER:-postgres}"
createdb "$DB"
trap 'dropdb --if-exists "$DB"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/stub_auth.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/friends_test.sql
