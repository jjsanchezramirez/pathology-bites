-- Rollback of 20261126120000_interactive_sequences_rls.sql: restores the policies and grants
-- exactly as they were live on 2026-11-26 (including the anonymous-read failure).
begin;
set local lock_timeout = '5s';

drop policy interactive_sequences_select_anon on public.interactive_sequences;
drop policy interactive_sequences_select_authenticated on public.interactive_sequences;
drop policy interactive_sequences_insert_admin on public.interactive_sequences;
drop policy interactive_sequences_update_admin on public.interactive_sequences;
drop policy interactive_sequences_delete_admin on public.interactive_sequences;

grant insert, update, delete, truncate, references, trigger
  on public.interactive_sequences to anon;

create policy "View interactive sequences" on public.interactive_sequences as permissive for select to public
  using (((status = 'published'::text) or (exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role))))));

create policy "Only admins can insert interactive sequences" on public.interactive_sequences as permissive for insert to authenticated
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

create policy "Only admins can update interactive sequences" on public.interactive_sequences as permissive for update to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))))
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

create policy "Only admins can delete interactive sequences" on public.interactive_sequences as permissive for delete to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

commit;
