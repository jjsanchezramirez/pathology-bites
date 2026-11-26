-- r2_storage_metrics: anonymous reads return nothing instead of erroring.
--
-- The old read policy was "Admins can read storage metrics" `to public using (exists (select
-- from users where id = auth.uid() and role = 'admin'))`. For anon, that subquery goes through
-- the users table's own RLS, which calls internal.is_current_user_admin(); anon may not execute
-- that function, so any anonymous read failed with 42501 "permission denied for function
-- is_current_user_admin" instead of returning no rows.
--
-- After: no anon read policy at all (admin-only table, so anon sees no rows and nothing errors);
-- signed-in admins read via the canonical `(select internal.is_current_user_admin())` check, the
-- same users lookup as before (security definer), so authenticated behaviour is unchanged. anon
-- keeps SELECT (so a stray read returns [] rather than "permission denied for table") and loses
-- the unused write grants. The service_role policies are untouched; service_role bypasses RLS.
--
-- The app reads and writes this table only with the service-role client
-- (src/shared/services/r2-storage-metrics.ts), so no app path changes.
-- Rollback: rollback/20261126140100_r2_storage_metrics_anon_read.down.sql restores the exact
-- policies and grants that were live before (2026-11-26).

begin;
set local lock_timeout = '5s';

drop policy "Admins can read storage metrics" on public.r2_storage_metrics;

create policy r2_storage_metrics_select_admin on public.r2_storage_metrics
  for select to authenticated
  using ((select internal.is_current_user_admin()));

revoke insert, update, delete, truncate, references, trigger
  on public.r2_storage_metrics from anon;

commit;
