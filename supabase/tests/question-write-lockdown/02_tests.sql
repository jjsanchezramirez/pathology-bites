-- Behaviour after the lockdown: no direct writes from anon/authenticated, reads unchanged,
-- service role and the save path unaffected.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned

create function pg_temp.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected % but statement succeeded: %', p_code, p_sql;
exception when others then
  if sqlstate <> p_code then raise exception 'expected % got % (%) for: %', p_code, sqlstate, sqlerrm, p_sql; end if;
end $$;
create function pg_temp.ok(p boolean, p_msg text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAILED: %', p_msg; end if; end $$;

select pg_temp.ok((select count(*) from pg_policies where schemaname = 'public'
  and tablename in ('questions','question_tags','question_reviews') and cmd <> 'SELECT') = 0, 'write policies gone');
select pg_temp.ok(not has_table_privilege('authenticated', 'public.' || t, p), format('authenticated lost %s on %s', p, t))
  from unnest(array['questions','question_options','question_images','question_tags','question_reviews','question_versions']) t,
       unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;
select pg_temp.ok(not has_table_privilege('anon', 'public.questions', 'INSERT'), 'anon lost insert');
select pg_temp.ok(has_table_privilege(r, 'public.' || t, 'SELECT'), format('%s keeps select on %s', r, t))
  from unnest(array['anon','authenticated','service_role']) r,
       unnest(array['questions','question_options','question_images','question_tags','question_reviews','question_versions']) t;
select pg_temp.ok(has_table_privilege('service_role', 'public.questions', 'INSERT,UPDATE,DELETE'), 'service_role keeps writes');

-- an author (create_questions) and an admin, signed in, cannot write directly any more
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
select pg_temp.ok((select count(*) from questions) >= 5, 'author still reads questions');
select pg_temp.expect_error($$insert into questions (title, stem, teaching_point, created_by, updated_by, status) values ('x','s','tp','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000b1','draft')$$, '42501');
select pg_temp.expect_error($$update questions set stem = 'x' where id = '50000000-0000-0000-0000-000000000005'$$, '42501');
select pg_temp.expect_error($$insert into question_tags (question_id, tag_id) values ('50000000-0000-0000-0000-000000000005','40000000-0000-0000-0000-000000000001')$$, '42501');
select pg_temp.expect_error($$insert into question_options (question_id, text) values ('50000000-0000-0000-0000-000000000005','o')$$, '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select pg_temp.expect_error($$delete from questions where id = '50000000-0000-0000-0000-000000000004'$$, '42501');
select pg_temp.expect_error($$update questions set status = 'published' where id = '50000000-0000-0000-0000-000000000002'$$, '42501');
reset role;
set role anon;
select pg_temp.expect_error($$insert into question_reviews (question_id, reviewer_id, action) values ('50000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','approved')$$, '42501');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- the service role still writes (metadata routes), and the save path still works
set role service_role;
update questions set category_id = null where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.ok((select category_id is null from questions where id = '50000000-0000-0000-0000-000000000001'), 'service_role update works');
select save_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000005', '{"stem":"saved after lockdown"}', null, null);
reset role;
select pg_temp.ok((select stem from questions where id = '50000000-0000-0000-0000-000000000005') = 'saved after lockdown', 'save path works after lockdown');

\echo ALL TESTS PASSED
