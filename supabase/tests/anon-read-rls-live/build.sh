#!/usr/bin/env bash
# Builds the live rehearsal for the anon-read RLS migrations (Learning Modules + r2_storage_metrics)
# into one SQL script, printed to stdout. Paste it into the Supabase SQL editor or run it with the
# Supabase MCP `execute_sql`. It runs entirely inside one transaction and ENDS IN ROLLBACK, so
# nothing persists; it takes brief locks on lessons, learning_subjects and r2_storage_metrics.
#
# What it does, on the real schema with real users:
#   1. creates fixture subjects/lessons/progress/metrics rows (every published/draft combination);
#   2. runs every activity the app performs on these tables (plus every write a role must NOT be
#      able to do) as anon, a signed-in user, a staff user, an admin and service_role -> "before";
#   3. applies both migrations                                                    -> "after";
#   4. applies both rollbacks                                                     -> "rolled_back";
#   5. returns one row per activity: before / after / expected / rolled_back and a verdict, plus a
#      summary row. Pass = every after matches expected, every non-anon after equals before, every
#      rolled_back equals before, and the policy+grant snapshot after rollback equals the original.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$here/../../.."
body() { grep -viE '^\s*(begin|commit);\s*$' "$1"; }
sed -n '1,/^-- @@MIGRATE@@/p' "$here/rehearsal.sql"
body "$root/docs/learning-modules/migrations/20261126140000_learning_modules_anon_read.sql"
body "$root/docs/r2-storage/migrations/20261126140100_r2_storage_metrics_anon_read.sql"
sed -n '/^-- @@MIGRATE@@/,/^-- @@ROLLBACK@@/p' "$here/rehearsal.sql" | sed '1d'
body "$root/docs/learning-modules/migrations/rollback/20261126140000_learning_modules_anon_read.down.sql"
body "$root/docs/r2-storage/migrations/rollback/20261126140100_r2_storage_metrics_anon_read.down.sql"
sed -n '/^-- @@ROLLBACK@@/,$p' "$here/rehearsal.sql" | sed '1d'
