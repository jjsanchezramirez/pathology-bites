-- Minimal local copy of the live schema the migration touches (Supabase project, Nov 25 2026).
-- Only for testing on a plain Postgres 16. Column lists, constraints and triggers match live.
create extension if not exists "uuid-ossp";
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
exception when duplicate_object then null; end $$;

create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema internal;
grant usage on schema internal to authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

create type public.question_status as enum ('draft','pending_review','flagged','archived','rejected','published');
create type public.difficulty_level as enum ('easy','medium','hard');
create type public.user_role as enum ('admin','user');
create type public.user_status as enum ('active','inactive','suspended','deleted');
create type public.user_type as enum ('student','resident','faculty','other','fellow','attending');

create table public.users (
  id uuid primary key default uuid_generate_v4(), email varchar(255) not null,
  first_name varchar(100), last_name varchar(100),
  created_at timestamptz default current_timestamp, updated_at timestamptz default current_timestamp,
  institution text, status public.user_status not null, user_type public.user_type not null,
  role public.user_role not null default 'user', deleted_at timestamptz,
  permissions text[] not null default '{}');
create table public.categories (id uuid primary key default uuid_generate_v4(), name varchar(100) not null,
  parent_id uuid, level int not null default 1, created_at timestamptz default current_timestamp,
  color varchar(50), short_form varchar(20));
create table public.entities (id uuid primary key default gen_random_uuid());
create table public.question_sets (id uuid primary key default gen_random_uuid(), name varchar(255) not null,
  description text, source_type varchar(50) not null, source_details jsonb default '{}',
  is_active boolean default true, created_by uuid, created_at timestamp default now(),
  updated_at timestamp default now(), short_form varchar(20));
create table public.images (id uuid primary key default uuid_generate_v4(), url text not null);
create table public.tags (id uuid primary key default uuid_generate_v4(), name varchar(50) not null unique,
  created_at timestamptz default current_timestamp);
create table public.questions (
  id uuid primary key default uuid_generate_v4(), title text not null, stem text not null,
  teaching_point text not null, question_references text, created_by uuid not null,
  created_at timestamptz default current_timestamp, updated_at timestamptz default current_timestamp,
  question_set_id uuid references public.question_sets(id), category_id uuid references public.categories(id),
  updated_by uuid not null, status public.question_status, difficulty public.difficulty_level,
  reviewer_id uuid, reviewer_feedback text, published_at timestamptz,
  version_major int default 1, version_minor int default 0, version_patch int default 0,
  anki_card_id text, anki_deck_name varchar(100), lesson text, topic text,
  entity_id uuid references public.entities(id),
  constraint check_pending_has_reviewer check (status <> 'pending_review' or reviewer_id is not null),
  constraint check_rejected_has_feedback check (status <> 'rejected' or (reviewer_feedback is not null and reviewer_feedback <> '')),
  constraint questions_created_by_fkey foreign key (created_by) references public.users(id) on delete set null,
  constraint questions_updated_by_fkey foreign key (updated_by) references public.users(id) on delete set null,
  constraint questions_reviewer_id_fkey foreign key (reviewer_id) references public.users(id) on delete set null);
create table public.question_options (id uuid primary key default uuid_generate_v4(),
  question_id uuid not null references public.questions(id) on delete cascade, text text not null,
  is_correct boolean not null default false, explanation text, order_index int not null default 0,
  created_at timestamptz default current_timestamp, updated_at timestamptz default current_timestamp);
create table public.question_images (question_id uuid not null references public.questions(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade, question_section varchar(20) not null,
  order_index int not null default 0, primary key (question_id, image_id, question_section),
  constraint question_images_question_section_check check (question_section in ('stem','explanation','question')));
create table public.question_tags (question_id uuid not null references public.questions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade, primary key (question_id, tag_id));
create table public.question_versions (id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade, question_data jsonb not null,
  update_type text, change_summary text, changed_by uuid not null references public.users(id) on delete set null,
  created_at timestamptz default now(), version_major int default 1, version_minor int default 0, version_patch int default 0,
  constraint question_versions_new_update_type_check check (update_type = any (array['initial','patch','minor','major'])));
create table public.question_reviews (id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reviewer_id uuid not null references public.users(id) on delete cascade, action text not null,
  feedback text, changes_made jsonb, created_at timestamptz default now(),
  constraint question_reviews_action_check check (action in ('approved','rejected','request_changes','resubmitted')));
create table public.quiz_sessions (id uuid primary key default gen_random_uuid());
create table public.quiz_attempts (id uuid primary key default gen_random_uuid(),
  quiz_session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  selected_answer_id uuid references public.question_options(id), first_answer_id uuid references public.question_options(id),
  is_correct boolean, attempted_at timestamptz not null default now());
create table public.question_flags (id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade, flagged_by uuid not null,
  flag_type text not null default 'other', status text not null default 'open');
create table public.question_analytics (question_id uuid);
create table public.system_stats (key text primary key, value bigint, last_updated timestamptz);

create function public.update_questions_updated_by() returns trigger language plpgsql security definer set search_path = '' as $$
begin if new.updated_by is null then new.updated_by = coalesce(auth.uid(), old.updated_by); end if; new.updated_at = now(); return new; end; $$;
create trigger questions_updated_by_trigger before update on public.questions for each row execute function public.update_questions_updated_by();

create function public.handle_deleted_question() returns trigger language plpgsql security definer set search_path = 'public' as $$
begin delete from quiz_attempts where question_id = old.id; delete from question_analytics where question_id = old.id;
delete from question_flags where question_id = old.id; delete from question_images where question_id = old.id;
delete from question_tags where question_id = old.id; delete from question_versions where question_id = old.id; return old; end; $$;
create trigger questions_delete_cleanup_trigger before delete on public.questions for each row execute function public.handle_deleted_question();

create function public.update_question_flag_metadata() returns trigger language plpgsql security definer set search_path = '' as $$
declare n int; s text; begin
select count(*) into n from public.question_flags where question_id = coalesce(new.question_id, old.question_id) and status = 'open';
select status into s from public.questions where id = coalesce(new.question_id, old.question_id);
if n > 0 then if s = 'published' then update public.questions set status = 'flagged' where id = coalesce(new.question_id, old.question_id); end if;
else if s = 'flagged' then update public.questions set status = 'published' where id = coalesce(new.question_id, old.question_id); end if; end if;
return coalesce(new, old); end; $$;
create trigger trigger_update_question_flag_metadata after insert or delete or update on public.question_flags for each row execute function public.update_question_flag_metadata();

-- Supabase grants every table to anon/authenticated by default; mirror that.
grant all on all tables in schema public to anon, authenticated, service_role;
-- Supabase default privileges also grant EXECUTE on new public functions to anon/authenticated.
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
alter default privileges in schema internal grant execute on functions to authenticated, service_role;
alter default privileges in schema internal grant all on tables to authenticated, service_role;
