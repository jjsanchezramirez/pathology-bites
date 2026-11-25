# Question authoring migrations

SQL for the question authoring plan (`../plan.md`), kept here so it is reviewed in pull requests.
`supabase/migrations/` is gitignored in this repo, so these files are applied by hand in the
Supabase SQL editor (or with the Supabase MCP), in filename order, each only after the owner's yes.

Each migration has a rollback in `rollback/`, and a local test under `supabase/tests/`
(`question-save-path/run.sh`, `question-write-lockdown/run.sh`) that applies it, checks its
behaviour, rolls it back and re-applies it on a plain Postgres 16.

| File                                         | Apply when                                                |
| -------------------------------------------- | --------------------------------------------------------- |
| `20261125140000_question_save_path.sql`      | First. The current site keeps working on it.              |
| `20261125150000_question_write_lockdown.sql` | After the site code that calls the save path is deployed. |
