-- The live state of public.learning_subjects and public.lessons (2026-11-26) on plain Postgres:
-- Supabase's roles, auth.uid()/auth.jwt(), the users table with its live RLS (which calls
-- internal.is_current_user_admin(), which anon may not execute), and the tables' live grants and
-- policies.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable
  as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create type public.user_role as enum ('admin', 'user');
create table public.users (id uuid primary key, role public.user_role not null default 'user');
grant select on public.users to anon, authenticated, service_role;

create schema internal;
grant usage on schema internal to anon, authenticated, service_role;
create function internal.is_current_user_admin() returns boolean language plpgsql security definer
  set search_path to 'public'
  as $$ begin return exists (select 1 from users where id = auth.uid() and role = 'admin'); end $$;
revoke execute on function internal.is_current_user_admin() from public;
grant execute on function internal.is_current_user_admin() to authenticated, service_role;

alter table public.users enable row level security;
create policy users_select_consolidated on public.users for select to public
  using ((((select auth.jwt()) ->> 'role') = 'service_role') or (select internal.is_current_user_admin()) or ((select auth.uid()) = id));

create table public.learning_subjects (
  id uuid primary key,
  title text not null,
  status text not null default 'draft'
);
create table public.lessons (
  id uuid primary key,
  subject_id uuid not null references public.learning_subjects (id),
  title text not null,
  status text not null default 'draft'
);
alter table public.learning_subjects enable row level security;
alter table public.lessons enable row level security;
grant all on public.learning_subjects, public.lessons to anon, authenticated, service_role;

create policy learning_subjects_select_consolidated on public.learning_subjects as permissive for select to public
  using (((status = 'published'::text) or (exists ( select 1 from users u where ((u.id = ( select auth.uid() as uid)) and (u.role = 'admin'::user_role))))));
create policy learning_subjects_insert_admin on public.learning_subjects as permissive for insert to authenticated
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));
create policy learning_subjects_update_admin on public.learning_subjects as permissive for update to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))))
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));
create policy learning_subjects_delete_admin on public.learning_subjects as permissive for delete to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

create policy lessons_select_consolidated on public.lessons as permissive for select to public
  using ((((status = 'published'::text) and (exists ( select 1 from learning_subjects ls where ((ls.id = lessons.subject_id) and (ls.status = 'published'::text))))) or (exists ( select 1 from users u where ((u.id = ( select auth.uid() as uid)) and (u.role = 'admin'::user_role))))));
create policy lessons_insert_admin on public.lessons as permissive for insert to authenticated
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));
create policy lessons_update_admin on public.lessons as permissive for update to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))))
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));
create policy lessons_delete_admin on public.lessons as permissive for delete to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

insert into public.users values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'user');
-- S1 published, S2 draft. L1 published in S1 (visible), L2 draft in S1, L3 published in draft S2.
insert into public.learning_subjects (id, title, status) values
  ('20000000-0000-0000-0000-000000000001', 'Published subject', 'published'),
  ('20000000-0000-0000-0000-000000000002', 'Draft subject', 'draft');
insert into public.lessons (id, subject_id, title, status) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Visible', 'published'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Draft lesson', 'draft'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'In draft subject', 'published');
