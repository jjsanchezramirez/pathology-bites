-- Ask Dr. Albright: questions asked by signed-out visitors, kept for quality control.
--
-- The homepage teaser (/api/public/ask-albright) used to keep no record of what
-- was asked, only counts and cost in ask_albright_anon_usage. This table keeps
-- every question that reached the model or the namesake check, what came of it
-- (answered, declined, clarified, not_found, failed), the answer the visitor saw
-- when there was one, and when. Nothing
-- that identifies the visitor is stored: no user id, no IP, no visitor cookie,
-- no usage bucket. Rows are kept indefinitely (owner's decision, 2026-11-28).
--
-- A separate table rather than a nullable user_id on ask_albright_history: that
-- table's rows belong to an account (cascade delete, per-user pruning to 100,
-- the user's own clear/feedback routes), and a null user_id would sit next to
-- code that is only correct because every query filters by user.
--
-- Access: service role only, same as ask_albright_anon_usage. Written by the
-- public route and read by admin tooling through the service-role client;
-- anon and authenticated get no grants and no policies.
--
-- Rollback: rollback/20261128030000_ask_albright_public_history.down.sql

begin;

create table public.ask_albright_public_history (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 1 and 300),
  -- answered: an answer; declined: out of scope; clarified: "which X do you
  -- mean?"; not_found: no passages; failed: upstream error. The last two are
  -- often the most useful to read, which is why they are kept too.
  outcome text not null
    check (outcome in ('answered', 'declined', 'clarified', 'not_found', 'failed')),
  -- The AskResult the visitor saw (answer, citations, tables, source, scope).
  -- Null for not_found and failed: there was no answer.
  result jsonb,
  created_at timestamptz not null default now()
);

alter table public.ask_albright_public_history
  add constraint ask_albright_public_history_result_matches_outcome
  check ((result is null) = (outcome in ('not_found', 'failed')));

create index ask_albright_public_history_recent
  on public.ask_albright_public_history (created_at desc);

alter table public.ask_albright_public_history enable row level security;

revoke all on public.ask_albright_public_history from public, anon, authenticated;
grant select, insert, delete on public.ask_albright_public_history to service_role;

comment on table public.ask_albright_public_history is
  'Ask Dr. Albright questions from signed-out visitors, for quality control. Anonymous: no user, IP or visitor id. Service role only.';

commit;
