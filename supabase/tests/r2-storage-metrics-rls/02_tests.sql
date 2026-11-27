-- After the migration: anon and non-admin users read nothing (no error); admins read everything;
-- only service_role writes.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\o /dev/null

create function pg_temp.ok(p boolean, p_msg text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAILED: %', p_msg; end if; end $$;
create function pg_temp.denied(p_sql text, p_msg text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAILED (statement succeeded): %', p_msg;
exception when insufficient_privilege then null;
end $$;

-- anon
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.ok((select count(*) from public.r2_storage_metrics) = 0, 'anon reads no rows, without error');
select pg_temp.denied($$insert into public.r2_storage_metrics (bucket_name) values ('x')$$, 'anon cannot insert');
select pg_temp.denied($$update public.r2_storage_metrics set object_count = 0$$, 'anon cannot update');
select pg_temp.denied($$delete from public.r2_storage_metrics$$, 'anon cannot delete');
reset role;

-- signed-in, not admin
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select pg_temp.ok((select count(*) from public.r2_storage_metrics) = 0, 'user reads no rows');
select pg_temp.denied($$insert into public.r2_storage_metrics (bucket_name) values ('x')$$, 'user cannot insert');
update public.r2_storage_metrics set object_count = 0;
delete from public.r2_storage_metrics;
reset role;
select pg_temp.ok((select sum(object_count) from public.r2_storage_metrics) = 3, 'user update/delete matched nothing');

-- admin: read only, as before
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.ok((select count(*) from public.r2_storage_metrics) = 2, 'admin reads every row');
select pg_temp.denied($$insert into public.r2_storage_metrics (bucket_name) values ('x')$$, 'admin cannot insert (service role only)');
reset role;

-- service_role (bypasses RLS)
set role service_role;
insert into public.r2_storage_metrics (bucket_name) values ('bucket-c');
update public.r2_storage_metrics set object_count = 3 where bucket_name = 'bucket-c';
delete from public.r2_storage_metrics where bucket_name = 'bucket-c';
reset role;

select pg_temp.ok(not exists (
  select 1 from pg_policies p, unnest(p.roles) r
  where p.tablename = 'r2_storage_metrics' and p.permissive = 'PERMISSIVE' and r in ('anon', 'authenticated', 'public')
  group by r, p.cmd having count(*) > 1), 'no overlapping permissive policies for anon/authenticated');
select pg_temp.ok(not exists (select 1 from pg_policies where tablename = 'r2_storage_metrics' and 'anon' = any(roles)), 'no anon policy');
select pg_temp.ok(not has_table_privilege('anon', 'public.r2_storage_metrics', 'INSERT'), 'anon lost insert grant');
select pg_temp.ok(has_table_privilege('anon', 'public.r2_storage_metrics', 'SELECT'), 'anon keeps select');
