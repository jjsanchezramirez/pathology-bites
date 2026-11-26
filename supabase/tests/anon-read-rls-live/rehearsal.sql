-- Live rehearsal of the anon-read RLS migrations. Do not run this file directly: ./build.sh splices
-- the migrations and rollbacks in at the markers below. Everything runs in one transaction that
-- ends in ROLLBACK.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ---------------------------------------------------------------------------------------------
-- Context: real identities and fixtures (fixtures are rolled back with everything else).
-- ---------------------------------------------------------------------------------------------
create temp table ctx (k text primary key, v text) on commit drop;
insert into ctx values
  ('S_PUB',   'f0000000-0000-4000-8000-0000000000a1'),
  ('S_DRAFT', 'f0000000-0000-4000-8000-0000000000a2'),
  ('S_PUB_SLUG',   'rls-rehearsal-pub'),
  ('S_DRAFT_SLUG', 'rls-rehearsal-draft'),
  ('L_PP',  'f0000000-0000-4000-8000-0000000000b1'),  -- published lesson, published subject
  ('L_PP2', 'f0000000-0000-4000-8000-0000000000b2'),  -- published lesson, published subject
  ('L_DP',  'f0000000-0000-4000-8000-0000000000b3'),  -- draft lesson, published subject
  ('L_PD',  'f0000000-0000-4000-8000-0000000000b4'),  -- published lesson, draft subject
  ('L_DD',  'f0000000-0000-4000-8000-0000000000b5'),  -- draft lesson, draft subject
  ('R2B',   'rls-rehearsal-bucket'),
  ('CAT',   (select id::text from public.categories order by id limit 1)),
  ('ADMIN', (select id::text from public.users where role = 'admin' order by created_at limit 1)),
  ('USER',  (select id::text from public.users where role = 'user' order by created_at limit 1)),
  ('STAFF', (select id::text from public.users where role = 'user' order by created_at offset 1 limit 1));
do $$ begin
  if exists (select 1 from ctx where v is null) then raise exception 'rehearsal context incomplete'; end if;
end $$;

insert into public.learning_subjects (id, title, slug, category_id, status, sort_order)
select (select v from ctx where k = 'S_PUB')::uuid, 'RLS rehearsal (published)', 'rls-rehearsal-pub',
       (select v from ctx where k = 'CAT')::uuid, 'published', 9001
union all
select (select v from ctx where k = 'S_DRAFT')::uuid, 'RLS rehearsal (draft)', 'rls-rehearsal-draft',
       (select v from ctx where k = 'CAT')::uuid, 'draft', 9002;
insert into public.lessons (id, subject_id, title, slug, status, sort_order)
select (select v from ctx where k = l.k)::uuid, (select v from ctx where k = l.s)::uuid,
       'RLS rehearsal ' || l.k, 'rls-rehearsal-' || lower(l.k), l.status, l.ord
from (values ('L_PP', 'S_PUB', 'published', 1), ('L_PP2', 'S_PUB', 'published', 2),
             ('L_DP', 'S_PUB', 'draft', 3), ('L_PD', 'S_DRAFT', 'published', 1),
             ('L_DD', 'S_DRAFT', 'draft', 2)) l(k, s, status, ord);
-- every signed-in actor already has progress on L_PP (so update/upsert have a row to hit)
insert into public.user_lesson_progress (user_id, lesson_id)
select (select v from ctx where k = a)::uuid, (select v from ctx where k = 'L_PP')::uuid
from unnest(array['USER', 'STAFF', 'ADMIN']) a;
insert into public.r2_storage_metrics (bucket_name, total_size_bytes, object_count)
values ('rls-rehearsal-bucket', 100, 1);

-- ---------------------------------------------------------------------------------------------
-- Actors: what PostgREST does for each request (role + JWT claims).
-- ---------------------------------------------------------------------------------------------
create temp table actors (actor text primary key, role text, sub text, perms text[], other text) on commit drop;
insert into actors values
  ('anon',    'anon',          null,                                   '{}', null),
  ('user',    'authenticated', (select v from ctx where k = 'USER'),  '{}', (select v from ctx where k = 'ADMIN')),
  ('staff',   'authenticated', (select v from ctx where k = 'STAFF'), '{create_questions,review_questions}', (select v from ctx where k = 'USER')),
  ('admin',   'authenticated', (select v from ctx where k = 'ADMIN'), '{create_questions,review_questions}', (select v from ctx where k = 'USER')),
  ('service', 'service_role',  null,                                   '{}', null);

-- ---------------------------------------------------------------------------------------------
-- Activities. q runs as the actor. e is the expected result:
--   '=<text>'  literal;   'Q'  q itself run as postgres (sees everything: right for admin and
--   service reads);   'SAME'  only required to equal the "before" result;   otherwise SQL run as
--   postgres. {ME} is the actor's user id, {OTHER} another user's, {NEW} a fresh uuid.
-- ---------------------------------------------------------------------------------------------
create temp table templates (actors text[], name text, q text, e text) on commit drop;

-- What visible means for anyone who is not an admin.
create temp table vis (k text primary key, sql text) on commit drop;
insert into vis values
  ('lesson', $v$l.status = 'published' and exists (select 1 from public.learning_subjects s2 where s2.id = l.subject_id and s2.status = 'published')$v$);

insert into templates values
-- ===== Reads the app performs (user routes; anon = signed-out reads of the same data) =====
(array['anon','user','staff'], 'subjects: list (count)',
  $q$select count(*)::text from public.learning_subjects$q$,
  $e$select count(*)::text from public.learning_subjects where status = 'published'$e$),
(array['admin','service'], 'subjects: list (count)',
  $q$select count(*)::text from public.learning_subjects$q$, 'Q'),
(array['anon','user','staff'], 'subjects: /api/user/learn/subjects (published, lessons!inner)',
  $q$select coalesce(string_agg(s.id::text, ',' order by s.sort_order, s.id), '') from public.learning_subjects s
     where s.status = 'published' and exists (select 1 from public.lessons l where l.subject_id = s.id)$q$,
  $e$select coalesce(string_agg(s.id::text, ',' order by s.sort_order, s.id), '') from public.learning_subjects s
     where s.status = 'published' and exists (select 1 from public.lessons l where l.subject_id = s.id and @LESSON_VIS@)$e$),
(array['admin'], 'subjects: /api/user/learn/subjects (published, lessons!inner)',
  $q$select coalesce(string_agg(s.id::text, ',' order by s.sort_order, s.id), '') from public.learning_subjects s
     where s.status = 'published' and exists (select 1 from public.lessons l where l.subject_id = s.id)$q$, 'Q'),
(array['anon','user','staff','admin'], 'subjects: /subjects/[slug] published subject found',
  $q$select count(*)::text from public.learning_subjects where slug = '{S_PUB_SLUG}' and status = 'published'$q$, '=1'),
(array['anon','user','staff'], 'subjects: /subjects/[slug] embedded lessons',
  $q$select coalesce(string_agg(l.id::text, ',' order by l.sort_order), '') from public.learning_subjects s
     left join public.lessons l on l.subject_id = s.id where s.slug = '{S_PUB_SLUG}' and s.status = 'published'$q$,
  '={L_PP},{L_PP2}'),
(array['admin'], 'subjects: /subjects/[slug] embedded lessons',
  $q$select coalesce(string_agg(l.id::text, ',' order by l.sort_order), '') from public.learning_subjects s
     left join public.lessons l on l.subject_id = s.id where s.slug = '{S_PUB_SLUG}' and s.status = 'published'$q$,
  '={L_PP},{L_PP2},{L_DP}'),
(array['anon','user','staff'], 'subjects: draft subject hidden',
  $q$select count(*)::text from public.learning_subjects where id = '{S_DRAFT}'$q$, '=0'),
(array['admin','service'], 'subjects: draft subject visible',
  $q$select count(*)::text from public.learning_subjects where id = '{S_DRAFT}'$q$, '=1'),
(array['anon','user','staff'], 'lessons: list (count)',
  $q$select count(*)::text from public.lessons$q$,
  $e$select count(*)::text from public.lessons l where @LESSON_VIS@$e$),
(array['admin','service'], 'lessons: list (count)',
  $q$select count(*)::text from public.lessons$q$, 'Q'),
(array['anon','user','staff','admin','service'], 'lessons: /lessons/[id] published lesson + subject embed',
  $q$select coalesce((select l.id || ':' || coalesce(s.status, 'null') from public.lessons l
     left join public.learning_subjects s on s.id = l.subject_id where l.id = '{L_PP}' and l.status = 'published'), 'none')$q$,
  '={L_PP}:published'),
(array['anon','user','staff'], 'lessons: draft lesson in published subject hidden',
  $q$select count(*)::text from public.lessons where id = '{L_DP}'$q$, '=0'),
(array['anon','user','staff'], 'lessons: published lesson in draft subject hidden',
  $q$select count(*)::text from public.lessons where id = '{L_PD}'$q$, '=0'),
(array['anon','user','staff'], 'lessons: draft lesson in draft subject hidden',
  $q$select count(*)::text from public.lessons where id = '{L_DD}'$q$, '=0'),
(array['admin','service'], 'lessons: every fixture lesson visible with subject',
  $q$select string_agg(l.id || ':' || l.status || ':' || coalesce(s.status, 'null'), ',' order by l.id) from public.lessons l
     left join public.learning_subjects s on s.id = l.subject_id where l.id in ('{L_PP}','{L_PP2}','{L_DP}','{L_PD}','{L_DD}')$q$, 'Q'),
(array['anon','user','staff'], 'lessons: /lessons/[id] prev/next siblings',
  $q$select coalesce(string_agg(id::text, ',' order by sort_order), '') from public.lessons where subject_id = '{S_PUB}' and status = 'published'$q$,
  '={L_PP},{L_PP2}'),
(array['admin'], 'lessons: /lessons/[id] prev/next siblings',
  $q$select coalesce(string_agg(id::text, ',' order by sort_order), '') from public.lessons where subject_id = '{S_PUB}' and status = 'published'$q$,
  '={L_PP},{L_PP2}'),

-- ===== Admin reads (/api/admin/learn/*) =====
(array['admin'], 'admin: subjects list with category + lessons embeds',
  $q$select string_agg(s.id::text || ':' || coalesce(c.name, '') || ':' || (select count(*) from public.lessons l where l.subject_id = s.id), ',' order by s.sort_order, s.id)
     from public.learning_subjects s left join public.categories c on c.id = s.category_id$q$, 'Q'),
(array['admin'], 'admin: lessons list with subject embed',
  $q$select string_agg(l.id::text || ':' || coalesce(s.slug, ''), ',' order by l.sort_order, l.id)
     from public.lessons l left join public.learning_subjects s on s.id = l.subject_id$q$, 'Q'),
(array['admin'], 'admin: draft lesson by id with subject embed',
  $q$select coalesce((select l.id || ':' || s.slug from public.lessons l left join public.learning_subjects s on s.id = l.subject_id where l.id = '{L_DD}'), 'none')$q$,
  '={L_DD}:rls-rehearsal-draft'),

-- ===== Writes on learning_subjects =====
(array['admin'], 'write: insert subject',
  $q$with x as (insert into public.learning_subjects (id, title, slug, category_id, status) values ('{NEW}', 'x', 'rls-rehearsal-{NEW}', '{CAT}', 'draft') returning 1) select count(*)::text from x$q$, '=1'),
(array['admin'], 'write: update subjects (published + draft)',
  $q$with x as (update public.learning_subjects set title = title || ' ', status = status where id in ('{S_PUB}','{S_DRAFT}') returning 1) select count(*)::text from x$q$, '=2'),
(array['admin'], 'write: publish a draft subject',
  $q$with x as (update public.learning_subjects set status = 'published' where id = '{S_DRAFT}' returning 1) select count(*)::text from x$q$, '=1'),
(array['admin'], 'write: delete subjects (cascades lessons + progress)',
  $q$with x as (delete from public.learning_subjects where id in ('{S_PUB}','{S_DRAFT}') returning 1) select count(*)::text from x$q$, '=2'),
(array['user','staff'], 'write: insert subject (denied)',
  $q$with x as (insert into public.learning_subjects (id, title, slug, category_id, status) values ('{NEW}', 'x', 'rls-rehearsal-{NEW}', '{CAT}', 'draft') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['user','staff'], 'write: update subjects (matches nothing)',
  $q$with x as (update public.learning_subjects set title = title || ' ' where id in ('{S_PUB}','{S_DRAFT}') returning 1) select count(*)::text from x$q$, '=0'),
(array['user','staff'], 'write: delete subjects (matches nothing)',
  $q$with x as (delete from public.learning_subjects where id in ('{S_PUB}','{S_DRAFT}') returning 1) select count(*)::text from x$q$, '=0'),
(array['anon'], 'write: insert subject (denied)',
  $q$with x as (insert into public.learning_subjects (id, title, slug, category_id, status) values ('{NEW}', 'x', 'rls-rehearsal-{NEW}', '{CAT}', 'draft') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['anon'], 'write: update subjects (denied)',
  $q$with x as (update public.learning_subjects set title = title || ' ' where id in ('{S_PUB}','{S_DRAFT}') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['anon'], 'write: delete subjects (denied)',
  $q$with x as (delete from public.learning_subjects where id in ('{S_PUB}','{S_DRAFT}') returning 1) select count(*)::text from x$q$, '=ERR 42501'),

-- ===== Writes on lessons =====
(array['admin'], 'write: insert lesson',
  $q$with x as (insert into public.lessons (id, subject_id, title, slug, status) values ('{NEW}', '{S_DRAFT}', 'x', 'rls-rehearsal-{NEW}', 'draft') returning 1) select count(*)::text from x$q$, '=1'),
(array['admin'], 'write: update lessons (all four states)',
  $q$with x as (update public.lessons set title = title || ' ' where id in ('{L_PP}','{L_DP}','{L_PD}','{L_DD}') returning 1) select count(*)::text from x$q$, '=4'),
(array['admin'], 'write: publish a draft lesson',
  $q$with x as (update public.lessons set status = 'published' where id = '{L_DP}' returning 1) select count(*)::text from x$q$, '=1'),
(array['admin'], 'write: delete lessons (all four states)',
  $q$with x as (delete from public.lessons where id in ('{L_PP}','{L_DP}','{L_PD}','{L_DD}') returning 1) select count(*)::text from x$q$, '=4'),
(array['user','staff'], 'write: insert lesson (denied)',
  $q$with x as (insert into public.lessons (id, subject_id, title, slug, status) values ('{NEW}', '{S_PUB}', 'x', 'rls-rehearsal-{NEW}', 'published') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['user','staff'], 'write: update lessons (matches nothing)',
  $q$with x as (update public.lessons set title = title || ' ' where id in ('{L_PP}','{L_DP}','{L_PD}','{L_DD}') returning 1) select count(*)::text from x$q$, '=0'),
(array['user','staff'], 'write: delete lessons (matches nothing)',
  $q$with x as (delete from public.lessons where id in ('{L_PP}','{L_DP}','{L_PD}','{L_DD}') returning 1) select count(*)::text from x$q$, '=0'),
(array['anon'], 'write: insert lesson (denied)',
  $q$with x as (insert into public.lessons (id, subject_id, title, slug, status) values ('{NEW}', '{S_PUB}', 'x', 'rls-rehearsal-{NEW}', 'published') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['anon'], 'write: update lessons (denied)',
  $q$with x as (update public.lessons set title = title || ' ' where id = '{L_PP}' returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['anon'], 'write: delete lessons (denied)',
  $q$with x as (delete from public.lessons where id = '{L_PP}' returning 1) select count(*)::text from x$q$, '=ERR 42501'),

-- ===== user_lesson_progress (dashboard/learn; FK to lessons) =====
(array['user','staff','admin'], 'progress: read own',
  $q$select count(*)::text from public.user_lesson_progress where user_id = '{ME}'$q$,
  $e$select count(*)::text from public.user_lesson_progress where user_id = '{ME}'$e$),
(array['user','staff','admin'], 'progress: read all (only own visible)',
  $q$select count(*)::text from public.user_lesson_progress$q$,
  $e$select count(*)::text from public.user_lesson_progress where user_id = '{ME}'$e$),
(array['user','staff','admin'], 'progress: first visit inserts row',
  $q$with x as (insert into public.user_lesson_progress (user_id, lesson_id) values ('{ME}', '{L_PP2}') returning 1) select count(*)::text from x$q$, '=1'),
(array['user','staff','admin'], 'progress: revisit updates last_accessed_at',
  $q$with x as (update public.user_lesson_progress set last_accessed_at = now() where user_id = '{ME}' and lesson_id = '{L_PP}' returning 1) select count(*)::text from x$q$, '=1'),
(array['user','staff','admin'], 'progress: complete lesson (upsert)',
  $q$with x as (insert into public.user_lesson_progress (user_id, lesson_id, completed_at, quiz_score) values ('{ME}', '{L_PP}', now(), 90)
     on conflict (user_id, lesson_id) do update set completed_at = excluded.completed_at, quiz_score = excluded.quiz_score returning 1) select count(*)::text from x$q$, '=1'),
(array['user','staff','admin'], 'progress: insert for another user (denied)',
  $q$with x as (insert into public.user_lesson_progress (user_id, lesson_id) values ('{OTHER}', '{L_PP2}') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['user','staff','admin'], 'progress: update another user (matches nothing)',
  $q$with x as (update public.user_lesson_progress set quiz_score = 0 where user_id = '{OTHER}' returning 1) select count(*)::text from x$q$, '=0'),
(array['anon'], 'progress: read', $q$select count(*)::text from public.user_lesson_progress$q$, 'SAME'),
(array['anon'], 'progress: insert',
  $q$with x as (insert into public.user_lesson_progress (user_id, lesson_id) values ('{OTHER_ANY}', '{L_PP2}') returning 1) select count(*)::text from x$q$, 'SAME'),

-- ===== r2_storage_metrics (admin dashboard reads via service role) =====
(array['anon','user','staff'], 'r2: read metrics (nothing visible)',
  $q$select count(*)::text from public.r2_storage_metrics$q$, '=0'),
(array['admin','service'], 'r2: read metrics',
  $q$select count(*)::text from public.r2_storage_metrics$q$, 'Q'),
(array['service'], 'r2: getCachedStorageMetrics query',
  $q$select string_agg(bucket_name || ':' || total_size_bytes || ':' || object_count, ',' order by bucket_name) from public.r2_storage_metrics$q$, 'Q'),
(array['service'], 'r2: insert', $q$with x as (insert into public.r2_storage_metrics (bucket_name) values ('rls-rehearsal-{NEW}') returning 1) select count(*)::text from x$q$, '=1'),
(array['service'], 'r2: update', $q$with x as (update public.r2_storage_metrics set object_count = object_count + 1 where bucket_name = '{R2B}' returning 1) select count(*)::text from x$q$, '=1'),
(array['service'], 'r2: delete', $q$with x as (delete from public.r2_storage_metrics where bucket_name = '{R2B}' returning 1) select count(*)::text from x$q$, '=1'),
(array['service'], 'r2: rpc increment_r2_metrics', $q$select 'ok' from (select public.increment_r2_metrics('{R2B}', 10)) x$q$, '=ok'),
(array['service'], 'r2: rpc decrement_r2_metrics', $q$select 'ok' from (select public.decrement_r2_metrics('{R2B}', 10)) x$q$, '=ok'),
(array['admin','user','staff'], 'r2: insert (denied)', $q$with x as (insert into public.r2_storage_metrics (bucket_name) values ('rls-rehearsal-{NEW}') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['admin','user','staff'], 'r2: update (matches nothing)', $q$with x as (update public.r2_storage_metrics set object_count = 0 where bucket_name = '{R2B}' returning 1) select count(*)::text from x$q$, '=0'),
(array['admin','user','staff'], 'r2: delete (matches nothing)', $q$with x as (delete from public.r2_storage_metrics where bucket_name = '{R2B}' returning 1) select count(*)::text from x$q$, '=0'),
(array['anon'], 'r2: insert (denied)', $q$with x as (insert into public.r2_storage_metrics (bucket_name) values ('rls-rehearsal-{NEW}') returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['anon'], 'r2: update (denied)', $q$with x as (update public.r2_storage_metrics set object_count = 0 where bucket_name = '{R2B}' returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['anon'], 'r2: delete (denied)', $q$with x as (delete from public.r2_storage_metrics where bucket_name = '{R2B}' returning 1) select count(*)::text from x$q$, '=ERR 42501'),
(array['anon','user','staff','admin'], 'r2: rpc increment_r2_metrics (denied)', $q$select 'ok' from (select public.increment_r2_metrics('{R2B}', 10)) x$q$, '=ERR 42501'),
(array['anon','user','staff','admin'], 'r2: rpc decrement_r2_metrics (denied)', $q$select 'ok' from (select public.decrement_r2_metrics('{R2B}', 10)) x$q$, '=ERR 42501');

create temp table acts on commit drop as
select row_number() over (order by a.actor, t.name) id, a.actor, t.name, t.q, t.e
from templates t cross join unnest(t.actors) a(actor);

create function pg_temp.fill(p_text text, p_actor text) returns text language plpgsql as $$
declare r text := p_text; c record; a record;
begin
  select * into a from actors where actor = p_actor;
  r := replace(r, '@LESSON_VIS@', (select sql from vis where k = 'lesson'));
  r := replace(r, '{ME}', coalesce(a.sub, '00000000-0000-0000-0000-000000000000'));
  r := replace(r, '{OTHER}', coalesce(a.other, '00000000-0000-0000-0000-000000000000'));
  r := replace(r, '{OTHER_ANY}', (select v from ctx where k = 'USER'));
  r := replace(r, '{NEW}', gen_random_uuid()::text);
  for c in select k, v from ctx order by length(k) desc loop r := replace(r, '{' || c.k || '}', c.v); end loop;
  return r;
end $$;

-- Run one activity as an actor, inside a subtransaction that is always rolled back.
create function pg_temp.act(p_actor text, p_sql text) returns text language plpgsql as $$
declare a record; r text; v_sql text;
begin
  select * into a from actors where actor = p_actor;
  v_sql := pg_temp.fill(p_sql, p_actor);  -- built as postgres; the actor cannot read ctx/actors
  begin
    perform set_config('request.jwt.claims', json_build_object(
      'sub', a.sub, 'role', a.role,
      'app_metadata', json_build_object('role', case p_actor when 'admin' then 'admin' else 'user' end, 'permissions', a.perms))::text, true);
    perform set_config('request.jwt.claim.sub', coalesce(a.sub, ''), true);
    perform set_config('request.jwt.claim.role', a.role, true);
    execute format('set local role %I', a.role);
    execute v_sql into r;
    raise exception using errcode = 'PTRBK', message = coalesce(r, '<null>');
  exception when others then
    if sqlstate = 'PTRBK' then return sqlerrm; end if;
    return 'ERR ' || sqlstate;
  end;
end $$;

create function pg_temp.expected(p_actor text, p_q text, p_e text) returns text language plpgsql as $$
declare r text;
begin
  if p_e = 'SAME' then return null; end if;
  if left(p_e, 1) = '=' then return pg_temp.fill(substr(p_e, 2), p_actor); end if;
  execute pg_temp.fill(case when p_e = 'Q' then p_q else p_e end, p_actor) into r;
  return coalesce(r, '<null>');
end $$;

create temp table results (id bigint primary key, actor text, name text, expected text,
  before text, after text, rolled_back text) on commit drop;
insert into results (id, actor, name, expected, before)
select id, actor, name, pg_temp.expected(actor, q, e), pg_temp.act(actor, q) from acts;

create temp table access_snapshot (phase text, line text) on commit drop;
insert into access_snapshot
select 'before', tablename || ' ' || policyname || ' ' || permissive || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
from pg_policies where schemaname = 'public' and tablename in ('lessons', 'learning_subjects', 'r2_storage_metrics')
union all
select 'before', table_name || ' ' || grantee || ' ' || privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('lessons', 'learning_subjects', 'r2_storage_metrics');

-- @@MIGRATE@@
update results r set after = pg_temp.act(a.actor, a.q) from acts a where a.id = r.id;

-- @@ROLLBACK@@
update results r set rolled_back = pg_temp.act(a.actor, a.q) from acts a where a.id = r.id;

insert into access_snapshot
select 'rolled_back', tablename || ' ' || policyname || ' ' || permissive || ' ' || cmd || ' ' || array_to_string(roles, ',') || ' ' || coalesce(qual, '') || ' ' || coalesce(with_check, '')
from pg_policies where schemaname = 'public' and tablename in ('lessons', 'learning_subjects', 'r2_storage_metrics')
union all
select 'rolled_back', table_name || ' ' || grantee || ' ' || privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('lessons', 'learning_subjects', 'r2_storage_metrics');

create temp table report on commit drop as
select r.*,
  case
    when r.expected is not null and r.after is distinct from r.expected then 'FAIL: after != expected'
    when r.actor <> 'anon' and r.after is distinct from r.before then 'FAIL: non-anon behaviour changed'
    when r.expected is null and r.after is distinct from r.before then 'FAIL: changed'
    when r.rolled_back is distinct from r.before then 'FAIL: rollback differs'
    else 'ok'
  end verdict
from results r;

select verdict, actor, name, expected, before, after, rolled_back from (
  select 0 ord, (select case when count(*) filter (where verdict <> 'ok') = 0 and snapshot_ok then 'PASS' else 'FAIL' end from report) verdict,
    'SUMMARY' actor,
    (select count(*) || ' activities, ' || count(*) filter (where verdict <> 'ok') || ' failing; anon reads failing before: '
       || count(*) filter (where actor = 'anon' and before = 'ERR 42501' and name not like 'write:%' and name not like 'r2: %' and name not like 'progress:%')
       || '; policy+grant snapshot restored by rollback: ' || snapshot_ok from report) name,
    null expected, null before, null after, null rolled_back
  from (select not exists (
          (select line from access_snapshot where phase = 'before' except select line from access_snapshot where phase = 'rolled_back')
          union all
          (select line from access_snapshot where phase = 'rolled_back' except select line from access_snapshot where phase = 'before'))
        snapshot_ok) s
  union all
  select 1, verdict, actor, name, expected, before, after, rolled_back from report
) x order by ord, verdict <> 'ok' desc, actor, name;

rollback;
