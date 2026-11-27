-- Rollback of 20261126140000_learning_modules_anon_read.sql: restores the policies and grants
-- exactly as they were live on 2026-11-26 (including the anonymous-read failure).
begin;
set local lock_timeout = '5s';

drop policy learning_subjects_select_anon on public.learning_subjects;
drop policy learning_subjects_select_authenticated on public.learning_subjects;
drop policy lessons_select_anon on public.lessons;
drop policy lessons_select_authenticated on public.lessons;

grant insert, update, delete, truncate, references, trigger
  on public.learning_subjects, public.lessons to anon;

create policy learning_subjects_select_consolidated on public.learning_subjects as permissive for select to public
  using (((status = 'published'::text) or (exists ( select 1 from users u where ((u.id = ( select auth.uid() as uid)) and (u.role = 'admin'::user_role))))));

create policy lessons_select_consolidated on public.lessons as permissive for select to public
  using ((((status = 'published'::text) and (exists ( select 1 from learning_subjects ls where ((ls.id = lessons.subject_id) and (ls.status = 'published'::text))))) or (exists ( select 1 from users u where ((u.id = ( select auth.uid() as uid)) and (u.role = 'admin'::user_role))))));

commit;
