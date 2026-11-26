#!/usr/bin/env bash
# Local test of the interactive_sequences RLS migration on plain Postgres 16.
# Usage: PGHOST=... PGUSER=postgres ./run.sh   (creates and drops database isr_test)
set -euo pipefail
TMPDIR_ISR="$(mktemp -d)"; trap 'rm -rf "$TMPDIR_ISR"' EXIT
here="$(cd "$(dirname "$0")" && pwd)"
migs="$here/../../../docs/lesson-studio/migrations"
mig="$migs/20261126120000_interactive_sequences_rls.sql"
down="$migs/rollback/20261126120000_interactive_sequences_rls.down.sql"
db=isr_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f "$here/00_live_schema.sql"
access() { run -At -c "select policyname||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'')
  from pg_policies where tablename = 'interactive_sequences' order by 1" -c "select grantee||' '||privilege_type
  from information_schema.role_table_grants where table_name = 'interactive_sequences' order by 1"; }
access > "$TMPDIR_ISR/before.txt"
run -f "$here/01_bug.sql" && echo "live state reproduces the anonymous-read failure"
run -f "$mig"
run -f "$mig" 2>/dev/null && { echo "migration should not apply twice"; exit 1; } || true
run -f "$here/02_tests.sql" && echo "access after the migration is as intended"
run -f "$down"
access > "$TMPDIR_ISR/after.txt"
diff -u "$TMPDIR_ISR/before.txt" "$TMPDIR_ISR/after.txt" && echo "rollback restores policies and grants exactly"
psql -q -d postgres -c "drop database $db"
