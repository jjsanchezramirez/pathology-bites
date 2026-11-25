#!/usr/bin/env bash
# Local test of the question write lockdown on plain Postgres 16, on top of the save path.
# Usage: PGHOST=... PGUSER=postgres ./run.sh   (creates and drops database qwl_test)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
base="$here/../question-save-path"
migs="$here/../../../docs/question-authoring/migrations"
save="$migs/20261125140000_question_save_path.sql"
mig="$migs/20261125150000_question_write_lockdown.sql"
down="$migs/rollback/20261125150000_question_write_lockdown.down.sql"
db=qwl_test
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $db" -c "create database $db"
run() { psql -q -X -v ON_ERROR_STOP=1 -d "$db" "$@"; }
run -f "$base/00_stub_schema.sql"
run -f "$base/01_seed.sql"
run -f "$save"
run -f "$here/00_live_access.sql"
# The live write policies and grants, as recreated by the rollback.
run -f "$down"
# Before the lockdown an author can write directly (proves the policies are in place).
run -c "set role authenticated; select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
  update questions set stem = 'direct before lockdown' where id = '50000000-0000-0000-0000-000000000005';" >/dev/null
[ "$(run -At -c "select stem from questions where id = '50000000-0000-0000-0000-000000000005'")" = "direct before lockdown" ] \
  || { echo "direct write before lockdown should work"; exit 1; }
access() { run -At -c "select tablename||' '||policyname||' '||cmd||' '||array_to_string(roles,',')||' '||coalesce(qual,'')||' '||coalesce(with_check,'')
  from pg_policies where schemaname='public' order by 1" -c "select table_name||' '||grantee||' '||privilege_type
  from information_schema.role_table_grants where table_schema='public' and table_name like 'question%' order by 1"; }
access > /tmp/qwl_before.txt
run -f "$mig"
run -f "$mig" 2>/dev/null && { echo "lockdown should not apply twice"; exit 1; } || true
run -f "$here/02_tests.sql"
echo "--- rollback"
run -f "$down"
access > /tmp/qwl_after.txt
diff -u /tmp/qwl_before.txt /tmp/qwl_after.txt && echo "rollback restores policies and grants exactly"
psql -q -d postgres -c "drop database $db"
