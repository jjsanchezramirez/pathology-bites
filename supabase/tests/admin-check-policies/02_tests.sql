-- After the migration: every rewritten policy calls the shared admin check, and access is the
-- same as before for an admin, a signed-in non-admin, and the mixed read policies.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\o /dev/null
create function pg_temp.ok(p boolean, p_msg text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAILED: %', p_msg; end if; end $$;

select pg_temp.ok((select count(*) from pg_policies where tablename <> 'users'
  and coalesce(qual,'') || coalesce(with_check,'') ~* 'from users') = 0, 'no inline admin check left');
select pg_temp.ok((select count(*) from pg_policies where tablename <> 'users'
  and policyname <> 'lessons_select_authenticated'
  and coalesce(qual,'') || coalesce(with_check,'') ~ 'internal\.is_current_user_admin') = 79, '79 policies call the function');

-- admin writes and reads admin-only rows
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
insert into public.lessons values ('10000000-0000-0000-0000-000000000002', 'admin');
update public.lessons set note = 'edited' where id = '10000000-0000-0000-0000-000000000001';
delete from public.lessons where id = '10000000-0000-0000-0000-000000000002';
select pg_temp.ok((select count(*) from public.questions) = 2, 'admin reads draft questions');
reset role;
select pg_temp.ok((select note from public.lessons where id = '10000000-0000-0000-0000-000000000001') = 'edited', 'admin update applied');

-- signed-in non-admin: no writes, published questions only
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
do $$ begin
  insert into public.lessons values ('10000000-0000-0000-0000-000000000003', 'user');
  raise exception 'FAILED: non-admin insert succeeded';
exception when insufficient_privilege then null;
end $$;
update public.lessons set note = 'hacked';
select pg_temp.ok((select count(*) from public.questions) = 1, 'user reads published questions only');
reset role;
select pg_temp.ok((select count(*) from public.lessons where note = 'hacked') = 0, 'non-admin update matched nothing');
