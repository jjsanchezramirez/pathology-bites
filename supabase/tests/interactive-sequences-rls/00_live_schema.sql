-- The live state of public.interactive_sequences (2026-11-26) on plain Postgres: Supabase's
-- roles, auth.uid(), the users table with RLS that calls internal.is_current_user_admin()
-- (which anon may not execute), and the table's live grants and policies.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
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
create policy users_select on public.users for select to public
  using (id = (select auth.uid()) or (select internal.is_current_user_admin()));

create table public.interactive_sequences (
  id uuid primary key,
  title text not null,
  description text,
  sequence_data jsonb not null default '{}',
  status text not null default 'draft'
);
alter table public.interactive_sequences enable row level security;
grant all on public.interactive_sequences to anon, authenticated, service_role;

create policy "View interactive sequences" on public.interactive_sequences as permissive for select to public
  using (((status = 'published'::text) or (exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role))))));
create policy "Only admins can insert interactive sequences" on public.interactive_sequences as permissive for insert to authenticated
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));
create policy "Only admins can update interactive sequences" on public.interactive_sequences as permissive for update to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))))
  with check ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));
create policy "Only admins can delete interactive sequences" on public.interactive_sequences as permissive for delete to authenticated
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

insert into public.users values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'user');
insert into public.interactive_sequences (id, title, status) values
  ('10000000-0000-0000-0000-000000000001', 'Published', 'published'),
  ('10000000-0000-0000-0000-000000000002', 'Draft', 'draft');
