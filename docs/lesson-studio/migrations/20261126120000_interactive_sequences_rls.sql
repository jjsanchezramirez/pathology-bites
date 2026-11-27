-- Published lessons readable by anyone, signed in or not.
--
-- The old read policy was `to public using (status = 'published' or exists (select from users
-- where id = auth.uid() and role = 'admin'))`. For anon, the users subquery goes through the
-- users table's own RLS, which calls internal.is_current_user_admin(); anon may not execute
-- that function, so every anonymous read failed with 42501 "permission denied for function
-- is_current_user_admin", even for published rows. Embedded lessons (other sites, signed-out
-- visitors) and /api/public/lessons/[id] depend on that read.
--
-- After: anon reads published rows only and never touches users; signed-in users read
-- published rows, admins everything (the canonical `(select internal.is_current_user_admin())`
-- check, as on the question tables). Writes stay admin-only for signed-in users; anon, which
-- had no write policy, loses the unused write grants.
--
-- One policy per role per command, so no "multiple permissive policies" advisor warning.
-- Checked on the live database (2026-11-26): 4 rows; admin writes go through the cookie
-- (authenticated) client in /api/admin/interactive-sequences/*.
-- Rollback: rollback/20261126120000_interactive_sequences_rls.down.sql restores the exact
-- policies and grants that were live before.

begin;
set local lock_timeout = '5s';

drop policy "View interactive sequences" on public.interactive_sequences;
drop policy "Only admins can insert interactive sequences" on public.interactive_sequences;
drop policy "Only admins can update interactive sequences" on public.interactive_sequences;
drop policy "Only admins can delete interactive sequences" on public.interactive_sequences;

create policy interactive_sequences_select_anon on public.interactive_sequences
  for select to anon
  using (status = 'published');

create policy interactive_sequences_select_authenticated on public.interactive_sequences
  for select to authenticated
  using (status = 'published' or (select internal.is_current_user_admin()));

create policy interactive_sequences_insert_admin on public.interactive_sequences
  for insert to authenticated
  with check ((select internal.is_current_user_admin()));

create policy interactive_sequences_update_admin on public.interactive_sequences
  for update to authenticated
  using ((select internal.is_current_user_admin()))
  with check ((select internal.is_current_user_admin()));

create policy interactive_sequences_delete_admin on public.interactive_sequences
  for delete to authenticated
  using ((select internal.is_current_user_admin()));

revoke insert, update, delete, truncate, references, trigger
  on public.interactive_sequences from anon;

commit;
