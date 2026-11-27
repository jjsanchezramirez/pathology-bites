# Learning Modules migrations

SQL for Learning Modules (`/dashboard/learn`, `/admin/learn`; tables `learning_subjects`,
`lessons`), kept here so it is reviewed in pull requests. `supabase/migrations/` is gitignored in
this repo, so these files are applied by hand in the Supabase SQL editor (or with the Supabase
MCP), in filename order, each only after the owner's yes.

Each migration has a rollback in `rollback/` and a local test under `supabase/tests/` that
reproduces the live state on plain Postgres 16, applies it, checks access, rolls it back and
diffs policies and grants against the starting state.

| File                                            | Test                                         | Apply when                                                                       |
| ----------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| `20261126140000_learning_modules_anon_read.sql` | `supabase/tests/learning-modules-rls/run.sh` | Any time; no app change needed. Required before anything reads these signed out. |

## Live rehearsal

`supabase/tests/anon-read-rls-live/build.sh` prints one script (both migrations here and in
`docs/r2-storage/migrations/`) that runs on production inside a transaction ending in ROLLBACK:
every app activity on `learning_subjects`, `lessons`, `user_lesson_progress` and
`r2_storage_metrics`, as anon, user, staff, admin and service_role, before / after / rolled back.

Last run 2026-11-26 on production: **PASS**. 130 activities, 0 failing. 11 anon reads failed
before (42501) and all succeed after with exactly the intended rows. Every user, staff, admin and
service_role result is identical before and after. The rollback restored every result and the
exact policy and grant snapshot. Afterwards, no fixture rows and no policy changes remained.

**Applied to production 2026-11-26** (Supabase migrations `learning_modules_anon_read` and `r2_storage_metrics_anon_read`). Checked afterwards: anon reads published rows and 0 metrics without error, signed-in users and admins see the same rows as before, anon holds only SELECT, and the advisors show no new findings.
