-- The live state of public.r2_storage_metrics (2026-11-26) on plain Postgres: Supabase's roles,
-- auth.uid()/auth.jwt(), the users table with its live RLS (which calls
-- internal.is_current_user_admin(), which anon may not execute), and the table's live grants and
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

create table public.r2_storage_metrics (
  bucket_name text primary key,
  total_size_bytes bigint not null default 0,
  object_count integer not null default 0
);
alter table public.r2_storage_metrics enable row level security;
grant all on public.r2_storage_metrics to anon, authenticated, service_role;

create policy "Admins can read storage metrics" on public.r2_storage_metrics as permissive for select to public
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));
create policy "Service role can delete storage metrics" on public.r2_storage_metrics as permissive for delete to service_role using (true);
create policy "Service role can modify storage metrics" on public.r2_storage_metrics as permissive for insert to service_role with check (true);
create policy "Service role can update storage metrics" on public.r2_storage_metrics as permissive for update to service_role using (true);
create policy "Service role full access to storage metrics" on public.r2_storage_metrics as permissive for all to service_role using (true) with check (true);

insert into public.users values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'user');
insert into public.r2_storage_metrics (bucket_name, total_size_bytes, object_count) values
  ('bucket-a', 100, 1), ('bucket-b', 200, 2);
