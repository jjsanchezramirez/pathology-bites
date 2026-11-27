-- Rollback of 20261126140100_r2_storage_metrics_anon_read.sql: restores the policies and grants
-- exactly as they were live on 2026-11-26 (including the anonymous-read failure).
begin;
set local lock_timeout = '5s';

drop policy r2_storage_metrics_select_admin on public.r2_storage_metrics;

grant insert, update, delete, truncate, references, trigger
  on public.r2_storage_metrics to anon;

create policy "Admins can read storage metrics" on public.r2_storage_metrics as permissive for select to public
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

commit;
