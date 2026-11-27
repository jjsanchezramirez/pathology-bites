-- Learning Modules: published subjects and lessons readable signed out.
--
-- The old read policies were `to public` and ended in `or exists (select from users where
-- id = auth.uid() and role = 'admin')`. For anon, that subquery goes through the users table's
-- own RLS, which calls internal.is_current_user_admin(); anon may not execute that function, so
-- every anonymous read failed with 42501 "permission denied for function is_current_user_admin",
-- even for published rows. /dashboard/learn and its API routes run signed in today, so nothing
-- breaks yet; anything reading these tables signed out would.
--
-- After: anon reads published rows only and never touches users (a lesson also needs its subject
-- published, as before; that subquery goes through learning_subjects' anon policy, which allows
-- published subjects). Signed-in users read the same rows, admins everything, using the canonical
-- `(select internal.is_current_user_admin())` check. That function is the same users lookup
-- (security definer), so authenticated behaviour is unchanged. Write policies are untouched
-- (authenticated, admin only); anon, which had no write policy, loses the unused write grants.
--
-- One permissive policy per role per command, so no "multiple permissive policies" warning.
-- Checked on the live database (2026-11-26): 2 subjects, 2 lessons (draft and published).
-- Rollback: rollback/20261126140000_learning_modules_anon_read.down.sql restores the exact
-- policies and grants that were live before.

begin;
set local lock_timeout = '5s';

drop policy learning_subjects_select_consolidated on public.learning_subjects;

create policy learning_subjects_select_anon on public.learning_subjects
  for select to anon
  using (status = 'published');

create policy learning_subjects_select_authenticated on public.learning_subjects
  for select to authenticated
  using (status = 'published' or (select internal.is_current_user_admin()));

drop policy lessons_select_consolidated on public.lessons;

create policy lessons_select_anon on public.lessons
  for select to anon
  using (status = 'published' and exists (
    select 1 from public.learning_subjects ls
    where ls.id = lessons.subject_id and ls.status = 'published'));

create policy lessons_select_authenticated on public.lessons
  for select to authenticated
  using ((status = 'published' and exists (
      select 1 from public.learning_subjects ls
      where ls.id = lessons.subject_id and ls.status = 'published'))
    or (select internal.is_current_user_admin()));

revoke insert, update, delete, truncate, references, trigger
  on public.learning_subjects, public.lessons from anon;

commit;
