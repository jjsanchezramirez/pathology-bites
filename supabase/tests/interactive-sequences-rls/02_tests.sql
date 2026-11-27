-- After the migration: anon reads published only; signed-in users read published; admins read
-- and write everything; nobody else writes.
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
select pg_temp.ok((select count(*) from public.interactive_sequences) = 1, 'anon sees the published row only');
select pg_temp.ok((select title from public.interactive_sequences) = 'Published', 'anon sees Published');
select pg_temp.denied($$insert into public.interactive_sequences (id, title) values (gen_random_uuid(), 'x')$$, 'anon cannot insert');
select pg_temp.denied($$update public.interactive_sequences set title = 'x'$$, 'anon cannot update');
select pg_temp.denied($$delete from public.interactive_sequences$$, 'anon cannot delete');
reset role;

-- signed-in, not admin
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select pg_temp.ok((select count(*) from public.interactive_sequences) = 1, 'user sees the published row only');
select pg_temp.denied($$insert into public.interactive_sequences (id, title) values (gen_random_uuid(), 'x')$$, 'user cannot insert');
update public.interactive_sequences set title = 'hacked';
delete from public.interactive_sequences;
reset role;
select pg_temp.ok((select count(*) from public.interactive_sequences where title = 'hacked') = 0, 'user update matched nothing');
select pg_temp.ok((select count(*) from public.interactive_sequences) = 2, 'user delete matched nothing');

-- admin
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.ok((select count(*) from public.interactive_sequences) = 2, 'admin sees drafts too');
insert into public.interactive_sequences (id, title) values ('10000000-0000-0000-0000-000000000003', 'New');
update public.interactive_sequences set status = 'published' where id = '10000000-0000-0000-0000-000000000003';
delete from public.interactive_sequences where id = '10000000-0000-0000-0000-000000000003';
select pg_temp.ok((select count(*) from public.interactive_sequences) = 2, 'admin insert/update/delete work');
reset role;

-- one permissive policy per role and command
select pg_temp.ok(not exists (
  select 1 from pg_policies p, unnest(p.roles) r
  where p.tablename = 'interactive_sequences' and p.permissive = 'PERMISSIVE'
  group by r, p.cmd having count(*) > 1), 'no overlapping permissive policies');
select pg_temp.ok(not has_table_privilege('anon', 'public.interactive_sequences', 'INSERT'), 'anon lost insert grant');
select pg_temp.ok(has_table_privilege('anon', 'public.interactive_sequences', 'SELECT'), 'anon keeps select');
select pg_temp.ok(has_table_privilege('authenticated', 'public.interactive_sequences', 'INSERT,UPDATE,DELETE'), 'authenticated keeps writes');
