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
