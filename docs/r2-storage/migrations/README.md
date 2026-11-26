# R2 storage migrations

SQL for the R2 storage metrics table (`r2_storage_metrics`, written and read by
`src/shared/services/r2-storage-metrics.ts` with the service-role client), kept here so it is
reviewed in pull requests. `supabase/migrations/` is gitignored in this repo, so these files are
applied by hand in the Supabase SQL editor (or with the Supabase MCP), each only after the
owner's yes.

Each migration has a rollback in `rollback/` and a local test under `supabase/tests/` that
reproduces the live state on plain Postgres 16, applies it, checks access, rolls it back and
diffs policies and grants against the starting state.

| File                                              | Test                                           | Apply when                      |
| ------------------------------------------------- | ---------------------------------------------- | ------------------------------- |
| `20261126140100_r2_storage_metrics_anon_read.sql` | `supabase/tests/r2-storage-metrics-rls/run.sh` | Any time; no app change needed. |
