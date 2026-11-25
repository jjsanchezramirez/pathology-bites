#!/usr/bin/env bash
# Local test of the question save path migration on plain Postgres 16.
# Usage: PGHOST=... PGUSER=postgres ./run.sh   (creates and drops database qsp_test)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
mig="$here/../../../docs/question-authoring/migrations/20261125140000_question_save_path.sql"
down="$here/../../../docs/question-authoring/migrations/rollback/20261125140000_question_save_path.down.sql"
db=qsp_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f "$here/00_stub_schema.sql"
run -f "$here/01_seed.sql"
dump() { pg_dump -s -d "$db" --no-owner --no-privileges | grep -v -e '^--' -e '^\\restrict' -e '^\\unrestrict' | sed '/^$/d'; }
dump > /tmp/qsp_before.sql
run -f "$mig"
run -f "$mig" 2>/dev/null && { echo "migration should not apply twice"; exit 1; } || true
run -f "$here/02_tests.sql"
echo "--- rollback"
run -f "$down"
dump > /tmp/qsp_after.sql
if diff -u /tmp/qsp_before.sql /tmp/qsp_after.sql; then echo "rollback restores schema exactly"; else
  echo "schema diff after rollback (expected only: update_type check NOT VALID)"; fi
echo "--- re-apply after rollback"
run -f "$mig"
legacy=$(run -At -c "select count(*) from question_versions where legacy")
[ "$legacy" = 2 ] || { echo "re-apply marked $legacy rows legacy, expected 2"; exit 1; }
echo "re-apply keeps new snapshots non-legacy"
psql -q -d postgres -c "drop database $db"
