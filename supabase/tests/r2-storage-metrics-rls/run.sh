#!/usr/bin/env bash
# Local test of the r2_storage_metrics anon-read RLS migration on plain Postgres 16.
# Usage: PGHOST=... PGUSER=postgres ./run.sh   (creates and drops database r2m_rls_test)
set -euo pipefail
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
here="$(cd "$(dirname "$0")" && pwd)"
migs="$here/../../../docs/r2-storage/migrations"
mig="$migs/20261126140100_r2_storage_metrics_anon_read.sql"
down="$migs/rollback/20261126140100_r2_storage_metrics_anon_read.down.sql"
db=r2m_rls_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f "$here/00_live_schema.sql"
access() { run -At -c "select tablename||' '||policyname||' '||permissive||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'')
  from pg_policies where tablename = 'r2_storage_metrics' order by tablename, policyname" -c "select table_name||' '||grantee||' '||privilege_type
  from information_schema.role_table_grants where table_name = 'r2_storage_metrics' order by 1"; }
access > "$tmp/before.txt"
run -f "$here/01_bug.sql" && echo "live state reproduces the anonymous-read failure"
run -f "$mig"
run -f "$mig" 2>/dev/null && { echo "migration should not apply twice"; exit 1; } || true
run -f "$here/02_tests.sql" && echo "access after the migration is as intended"
run -f "$down"
access > "$tmp/after.txt"
diff -u "$tmp/before.txt" "$tmp/after.txt" && echo "rollback restores policies and grants exactly"
run -f "$here/01_bug.sql" && echo "rolled-back state reproduces the failure again"
psql -q -d postgres -c "drop database $db"
