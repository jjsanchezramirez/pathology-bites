-- After the migration: anon and signed-in users read published subjects and published lessons in
-- published subjects; admins read and write everything; nobody else writes.
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
select pg_temp.ok((select array_agg(title) from public.learning_subjects) = '{"Published subject"}', 'anon sees the published subject only');
select pg_temp.ok((select array_agg(title) from public.lessons) = '{Visible}', 'anon sees the published lesson in a published subject only');
select pg_temp.denied($$insert into public.learning_subjects (id, title) values (gen_random_uuid(), 'x')$$, 'anon cannot insert subjects');
select pg_temp.denied($$update public.learning_subjects set title = 'x'$$, 'anon cannot update subjects');
select pg_temp.denied($$delete from public.learning_subjects$$, 'anon cannot delete subjects');
select pg_temp.denied($$insert into public.lessons (id, subject_id, title) values (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'x')$$, 'anon cannot insert lessons');
select pg_temp.denied($$update public.lessons set title = 'x'$$, 'anon cannot update lessons');
select pg_temp.denied($$delete from public.lessons$$, 'anon cannot delete lessons');
reset role;

-- signed-in, not admin
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select pg_temp.ok((select array_agg(title) from public.learning_subjects) = '{"Published subject"}', 'user sees the published subject only');
select pg_temp.ok((select array_agg(title) from public.lessons) = '{Visible}', 'user sees the published lesson only');
select pg_temp.denied($$insert into public.lessons (id, subject_id, title) values (gen_random_uuid(), '20000000-0000-0000-0000-000000000001', 'x')$$, 'user cannot insert lessons');
select pg_temp.denied($$insert into public.learning_subjects (id, title) values (gen_random_uuid(), 'x')$$, 'user cannot insert subjects');
update public.lessons set title = 'hacked';
update public.learning_subjects set title = 'hacked';
delete from public.lessons;
reset role;
select pg_temp.ok((select count(*) from public.lessons where title = 'hacked') + (select count(*) from public.learning_subjects where title = 'hacked') = 0, 'user updates matched nothing');
select pg_temp.ok((select count(*) from public.lessons) = 3, 'user delete matched nothing');

-- admin
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select pg_temp.ok((select count(*) from public.learning_subjects) = 2, 'admin sees draft subjects too');
select pg_temp.ok((select count(*) from public.lessons) = 3, 'admin sees every lesson');
insert into public.learning_subjects (id, title) values ('20000000-0000-0000-0000-000000000009', 'New');
insert into public.lessons (id, subject_id, title) values ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000009', 'New');
update public.lessons set status = 'published' where id = '30000000-0000-0000-0000-000000000009';
update public.learning_subjects set status = 'published' where id = '20000000-0000-0000-0000-000000000009';
delete from public.lessons where id = '30000000-0000-0000-0000-000000000009';
delete from public.learning_subjects where id = '20000000-0000-0000-0000-000000000009';
select pg_temp.ok((select count(*) from public.lessons) = 3 and (select count(*) from public.learning_subjects) = 2, 'admin insert/update/delete work');
reset role;

-- one permissive policy per role and command; grants
select pg_temp.ok(not exists (
  select 1 from pg_policies p, unnest(p.roles) r
  where p.tablename in ('learning_subjects', 'lessons') and p.permissive = 'PERMISSIVE'
  group by p.tablename, r, p.cmd having count(*) > 1), 'no overlapping permissive policies');
select pg_temp.ok(not exists (
  select 1 from pg_policies where tablename in ('learning_subjects', 'lessons') and 'public' = any(roles)), 'no policy left on public');
select pg_temp.ok(not has_table_privilege('anon', 'public.lessons', 'INSERT')
  and not has_table_privilege('anon', 'public.learning_subjects', 'UPDATE'), 'anon lost write grants');
select pg_temp.ok(has_table_privilege('anon', 'public.lessons', 'SELECT')
  and has_table_privilege('anon', 'public.learning_subjects', 'SELECT'), 'anon keeps select');
select pg_temp.ok(has_table_privilege('authenticated', 'public.lessons', 'INSERT,UPDATE,DELETE')
  and has_table_privilege('authenticated', 'public.learning_subjects', 'INSERT,UPDATE,DELETE'), 'authenticated keeps writes');
