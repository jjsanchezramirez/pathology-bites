-- Adds what the live database has on the question tables before the lockdown: row level
-- security, read policies, the permission helpers and a bypassrls service role. The write
-- policies themselves come from the lockdown rollback, which recreates them exactly as live.
alter role service_role bypassrls;
grant usage on schema auth to anon, authenticated, service_role;
create or replace function internal.has_permission(p text) returns boolean language sql stable
  as $$ select exists (select 1 from public.users u where u.id = auth.uid() and (u.role = 'admin' or p = any(u.permissions))) $$;
create or replace function internal.is_current_user_admin() returns boolean language sql stable
  as $$ select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin') $$;
do $$ declare t text; begin
  foreach t in array array['questions','question_options','question_images','question_tags','question_reviews','question_versions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
  end loop;
end $$;
