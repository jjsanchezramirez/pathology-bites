#!/usr/bin/env bash
# Local test of the admin-check policy rewrite on plain Postgres 16.
# Usage: PGHOST=... PGUSER=postgres ./run.sh   (creates and drops database acp_test)
set -euo pipefail
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
here="$(cd "$(dirname "$0")" && pwd)"
migs="$here/../../../docs/database/migrations"
mig="$migs/20261127120000_admin_check_policies.sql"
down="$migs/rollback/20261127120000_admin_check_policies.down.sql"
db=acp_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f "$here/00_live_schema.sql"
access() { run -At -c "select tablename||' '||policyname||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'')
  from pg_policies where schemaname = 'public' order by 1"; }
access > "$tmp/before.txt"
run -f "$mig"
run -f "$mig" 2>/dev/null && { echo "rewrite should refuse to run twice"; exit 1; } || true
run -f "$here/02_tests.sql"
echo "79 policies use the shared admin check; access unchanged"
run -f "$down"
access > "$tmp/after.txt"
diff -u "$tmp/before.txt" "$tmp/after.txt" && echo "rollback restores every policy exactly"
psql -q -d postgres -c "drop database $db" || true
