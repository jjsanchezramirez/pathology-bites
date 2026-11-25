-- Phase 1 of docs/question-authoring/plan.md: one atomic, audited save path for questions.
--
-- Adds:
--   1. questions.source / source_detail  (written by hand, AI-assisted, LLM batch, import)
--   2. question_versions.legacy + new snapshot kinds (create, edit, status)
--   3. internal.question_snapshot()       full after-save snapshot
--   4. internal.bot_accounts              registry of LLM batch bot users
--   5. public.save_question()             create or edit, atomic, snapshot on every save
--   6. public.transition_question()       submit, approve, reject, reassign, archive, restore
--
-- Both public functions are SECURITY DEFINER and executable by service_role only. The caller
-- (a Next.js route using the service-role client) passes the acting user explicitly, because
-- auth.uid() is NULL there. The functions check that user's role and permissions themselves.
--
-- Errors use custom SQLSTATEs so the app can map them to HTTP codes:
--   PBA01 forbidden (403)  PBN01 not found (404)  PBV01 invalid input (400)  PBC01 wrong state (409)
--
-- Rollback: supabase/migrations/rollback/20261125140000_question_save_path.down.sql

begin;

-- Fail fast rather than queue behind a long reader and block the site.
set local lock_timeout = '5s';

-- ---------------------------------------------------------------------------------------------
-- 1. Where each question came from
-- ---------------------------------------------------------------------------------------------
alter table public.questions
  add column source text not null default 'manual',
  add column source_detail jsonb not null default '{"basis": "default"}'::jsonb;

alter table public.questions
  add constraint questions_source_check
    check (source in ('manual', 'ai_assisted', 'llm_batch', 'import')),
  add constraint questions_source_detail_object_check
    check (jsonb_typeof(source_detail) = 'object');

comment on column public.questions.source is
  'How the question was written: manual (by hand), ai_assisted (in-site AI drafting), llm_batch (bot batch), import.';
comment on column public.questions.source_detail is
  'Free-form provenance details (model, batch id, bot label). backfilled=true marks a best guess made by migration 20261125140000.';

-- Best-guess backfill from the question set. Keep updated_at untouched: the backfill is not an edit.
alter table public.questions disable trigger questions_updated_by_trigger;

update public.questions q
set source = case when s.name = 'Claude Opus 4.6' then 'llm_batch' else 'ai_assisted' end,
    source_detail = jsonb_build_object(
      'backfilled', true,
      'basis', 'question_set',
      'question_set', s.name,
      'confidence', case
        when s.name = 'Claude Opus 4.6' then 'medium'
        when s.source_details ? 'provider' then 'medium'
        else 'low'
      end)
from public.question_sets s
where s.id = q.question_set_id
  and s.source_type = 'AI-Generated';

update public.questions
set source_detail = jsonb_build_object('backfilled', true, 'basis', 'default', 'confidence', 'low')
where source_detail = '{"basis": "default"}'::jsonb;

alter table public.questions enable trigger questions_updated_by_trigger;

-- ---------------------------------------------------------------------------------------------
-- 2. Version history: mark the old rows, allow the new snapshot kinds
-- ---------------------------------------------------------------------------------------------
alter table public.question_versions
  add column legacy boolean not null default false;

comment on column public.question_versions.legacy is
  'True for rows written before full after-save snapshots (inconsistent partial shapes). Phase 2 backfills them.';

alter table public.question_versions drop constraint question_versions_new_update_type_check;
alter table public.question_versions
  add constraint question_versions_update_type_check
    check (update_type in ('initial', 'patch', 'minor', 'major', 'create', 'edit', 'status'));

-- Only rows that predate full snapshots (safe to re-run after a rollback).
update public.question_versions set legacy = true
where coalesce(question_data->>'snapshot_format', '0') <> '2';

create index if not exists idx_question_versions_question_created
  on public.question_versions (question_id, created_at desc);

-- ---------------------------------------------------------------------------------------------
-- 3. Full snapshot of a question as it stands
-- ---------------------------------------------------------------------------------------------
create or replace function internal.question_snapshot(p_question_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'snapshot_format', 2,
    'id', q.id,
    'title', q.title,
    'stem', q.stem,
    'teaching_point', q.teaching_point,
    'question_references', q.question_references,
    'difficulty', q.difficulty,
    'lesson', q.lesson,
    'topic', q.topic,
    'status', q.status,
    'source', q.source,
    'source_detail', q.source_detail,
    'category_id', q.category_id,
    'question_set_id', q.question_set_id,
    'entity_id', q.entity_id,
    'reviewer_id', q.reviewer_id,
    'reviewer_feedback', q.reviewer_feedback,
    'published_at', q.published_at,
    'anki_card_id', q.anki_card_id,
    'anki_deck_name', q.anki_deck_name,
    'created_by', q.created_by,
    'updated_by', q.updated_by,
    'version', jsonb_build_object(
      'major', q.version_major, 'minor', q.version_minor, 'patch', q.version_patch),
    'question_options', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', o.id,
          'text', o.text,
          'is_correct', o.is_correct,
          'explanation', o.explanation,
          'order_index', o.order_index)
        order by o.order_index, o.id)
      from public.question_options o
      where o.question_id = q.id), '[]'::jsonb),
    'question_images', coalesce((
      select jsonb_agg(jsonb_build_object(
          'image_id', i.image_id,
          'question_section', i.question_section,
          'order_index', i.order_index)
        order by i.question_section, i.order_index, i.image_id)
      from public.question_images i
      where i.question_id = q.id), '[]'::jsonb),
    'tag_ids', coalesce((
      select jsonb_agg(t.tag_id order by t.tag_id)
      from public.question_tags t
      where t.question_id = q.id), '[]'::jsonb),
    'tags', coalesce((
      select jsonb_agg(jsonb_build_object('id', tg.id, 'name', tg.name) order by tg.name)
      from public.question_tags t
      join public.tags tg on tg.id = t.tag_id
      where t.question_id = q.id), '[]'::jsonb)
  )
  from public.questions q
  where q.id = p_question_id;
$$;

revoke all on function internal.question_snapshot(uuid) from public, anon, authenticated;

-- What a question still needs before it can go to review or be published.
create or replace function internal.question_completeness_errors(p_question_id uuid)
returns text[]
language sql
stable
set search_path = ''
as $$
  select array_remove(array[
    case when coalesce(btrim(q.title), '') = '' then 'title is empty' end,
    case when coalesce(btrim(q.stem), '') = '' then 'stem is empty' end,
    case when coalesce(btrim(q.teaching_point), '') = '' then 'teaching point is empty' end,
    case when (select count(*) from public.question_options o where o.question_id = q.id) < 2
      then 'needs at least two answer options' end,
    case when (select count(*) from public.question_options o
               where o.question_id = q.id and coalesce(btrim(o.text), '') = '') > 0
      then 'an answer option has no text' end,
    case when (select count(*) from public.question_options o
               where o.question_id = q.id and o.is_correct) <> 1
      then 'needs exactly one correct answer' end
  ], null)
  from public.questions q
  where q.id = p_question_id;
$$;

revoke all on function internal.question_completeness_errors(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. Bot accounts (LLM batch writers)
-- ---------------------------------------------------------------------------------------------
create table internal.bot_accounts (
  user_id uuid primary key references public.users (id) on delete cascade,
  label text not null check (btrim(label) <> ''),
  created_at timestamptz not null default now()
);

comment on table internal.bot_accounts is
  'Users that write LLM batches. A bot needs create_questions; save_question forces source=llm_batch and draft status for it, and it can make no review transitions.';

alter table internal.bot_accounts enable row level security;
revoke all on table internal.bot_accounts from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Shared checks
-- ---------------------------------------------------------------------------------------------
-- Returns (is_admin, can_create, can_review, is_bot). Raises PBA01 for an unknown or inactive user.
create or replace function internal.question_actor(
  p_actor uuid,
  out is_admin boolean,
  out can_create boolean,
  out can_review boolean,
  out is_bot boolean)
language plpgsql
stable
set search_path = ''
as $$
begin
  select u.role = 'admin'::public.user_role,
         u.role = 'admin'::public.user_role or 'create_questions' = any (u.permissions),
         u.role = 'admin'::public.user_role or 'review_questions' = any (u.permissions)
    into is_admin, can_create, can_review
  from public.users u
  where u.id = p_actor
    and u.status = 'active'::public.user_status
    and u.deleted_at is null;

  if not found then
    raise exception using errcode = 'PBA01', message = 'Unknown or inactive user';
  end if;

  is_bot := exists (select 1 from internal.bot_accounts b where b.user_id = p_actor);
end;
$$;

revoke all on function internal.question_actor(uuid) from public, anon, authenticated;

-- A reviewer must hold review_questions, be active, not be a bot, and not be the question's
-- author unless the reviewer is an admin (there is a single admin for now; see plan Phase 5).
create or replace function internal.assert_valid_reviewer(p_reviewer uuid, p_author uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_is_admin boolean;
  v_can_review boolean;
begin
  if p_reviewer is null then
    raise exception using errcode = 'PBV01', message = 'A reviewer is required';
  end if;

  select u.role = 'admin'::public.user_role,
         u.role = 'admin'::public.user_role or 'review_questions' = any (u.permissions)
    into v_is_admin, v_can_review
  from public.users u
  where u.id = p_reviewer
    and u.status = 'active'::public.user_status
    and u.deleted_at is null;

  if not found or not v_can_review
     or exists (select 1 from internal.bot_accounts b where b.user_id = p_reviewer) then
    raise exception using errcode = 'PBV01', message = 'Selected user is not a reviewer';
  end if;

  if p_reviewer = p_author and not v_is_admin then
    raise exception using errcode = 'PBV01', message = 'An author cannot review their own question';
  end if;
end;
$$;

revoke all on function internal.assert_valid_reviewer(uuid, uuid) from public, anon, authenticated;

-- Who made the live edit (minor or major) that sent a question back to review, if any.
-- That person may not review it, however the reviewer was chosen.
create or replace function internal.last_review_editor(p_question_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select v.changed_by
  from public.question_versions v
  where v.question_id = p_question_id
    and not v.legacy
    and v.update_type in ('minor', 'major')
  order by v.created_at desc
  limit 1
$$;

revoke all on function internal.last_review_editor(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. save_question: create (p_question_id null) or edit, then snapshot the result
-- ---------------------------------------------------------------------------------------------
-- p_payload keys (all optional on edit; title and stem required on create):
--   title, stem, teaching_point, question_references, difficulty, lesson, topic,
--   question_set_id, category_id, anki_card_id, anki_deck_name,
--   source, source_detail          (source required on create unless the actor is a bot;
--                                   on edit only an admin may change them)
--   reviewer_id                    (only with a minor or major edit of a live question)
--   options  [{id?, text, is_correct?, explanation?}]   replaces the set, kept in array order
--   images   [{image_id, question_section, order_index?}] replaces the set
--   tag_ids  [uuid]                                       replaces the set
-- p_update_type: patch | minor | major, only for live (published or flagged) questions;
--   defaults to patch there. A minor or major edit sends the question back to review.
create or replace function public.save_question(
  p_actor uuid,
  p_question_id uuid,
  p_payload jsonb,
  p_change_summary text default null,
  p_update_type text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  q public.questions%rowtype;
  v_id uuid;
  v_creating boolean := p_question_id is null;
  v_live boolean := false;
  v_kind text;
  v_unknown text[];
  v_errors text[];
  v_source text;
  v_source_detail jsonb;
  v_reviewer uuid;
  v_opt jsonb;
  v_opt_id uuid;
  v_idx int := 0;
  v_keep uuid[] := '{}';
  v_version_id uuid;
begin
  if p_actor is null then
    raise exception using errcode = 'PBA01', message = 'No acting user';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = 'PBV01', message = 'Payload must be a JSON object';
  end if;

  select array_agg(k order by k) into v_unknown
  from jsonb_object_keys(p_payload) k
  where k not in ('title', 'stem', 'teaching_point', 'question_references', 'difficulty',
                  'lesson', 'topic', 'question_set_id', 'category_id', 'anki_card_id',
                  'anki_deck_name', 'source', 'source_detail', 'reviewer_id',
                  'options', 'images', 'tag_ids');
  if v_unknown is not null then
    raise exception using errcode = 'PBV01',
      message = 'Unknown fields: ' || array_to_string(v_unknown, ', ');
  end if;

  if p_payload ? 'difficulty' and p_payload->>'difficulty' is not null
     and p_payload->>'difficulty' not in ('easy', 'medium', 'hard') then
    raise exception using errcode = 'PBV01', message = 'difficulty must be easy, medium or hard';
  end if;
  if p_payload ? 'title' and coalesce(btrim(p_payload->>'title'), '') = '' then
    raise exception using errcode = 'PBV01', message = 'title cannot be empty';
  end if;
  if p_payload ? 'stem' and coalesce(btrim(p_payload->>'stem'), '') = '' then
    raise exception using errcode = 'PBV01', message = 'stem cannot be empty';
  end if;
  if p_payload ? 'source_detail' and jsonb_typeof(p_payload->'source_detail') <> 'object' then
    raise exception using errcode = 'PBV01', message = 'source_detail must be an object';
  end if;
  if p_payload ? 'options' and jsonb_typeof(p_payload->'options') <> 'array' then
    raise exception using errcode = 'PBV01', message = 'options must be an array';
  end if;
  if p_payload ? 'images' and jsonb_typeof(p_payload->'images') <> 'array' then
    raise exception using errcode = 'PBV01', message = 'images must be an array';
  end if;
  if p_payload ? 'tag_ids' and jsonb_typeof(p_payload->'tag_ids') <> 'array' then
    raise exception using errcode = 'PBV01', message = 'tag_ids must be an array';
  end if;

  select * into v_actor from internal.question_actor(p_actor);

  if v_creating then
    -- ----- create -----------------------------------------------------------------------
    if not v_actor.can_create then
      raise exception using errcode = 'PBA01', message = 'Requires the create_questions permission';
    end if;
    if not (p_payload ? 'title') or not (p_payload ? 'stem') then
      raise exception using errcode = 'PBV01', message = 'title and stem are required';
    end if;
    if p_payload ? 'reviewer_id' then
      raise exception using errcode = 'PBV01',
        message = 'A new question starts as a draft; submit it for review to set a reviewer';
    end if;

    v_source_detail := coalesce(p_payload->'source_detail', '{}'::jsonb);
    if v_actor.is_bot then
      v_source := 'llm_batch';
      v_source_detail := v_source_detail || jsonb_build_object(
        'bot', (select b.label from internal.bot_accounts b where b.user_id = p_actor));
    else
      v_source := p_payload->>'source';
      if v_source is null then
        raise exception using errcode = 'PBV01',
          message = 'source is required (manual, ai_assisted, llm_batch or import)';
      end if;
    end if;
    if v_source not in ('manual', 'ai_assisted', 'llm_batch', 'import') then
      raise exception using errcode = 'PBV01',
        message = 'source must be manual, ai_assisted, llm_batch or import';
    end if;

    insert into public.questions (
      title, stem, teaching_point, question_references, difficulty, lesson, topic,
      question_set_id, category_id, anki_card_id, anki_deck_name,
      status, source, source_detail, created_by, updated_by,
      version_major, version_minor, version_patch)
    values (
      p_payload->>'title',
      p_payload->>'stem',
      coalesce(p_payload->>'teaching_point', ''),
      p_payload->>'question_references',
      (p_payload->>'difficulty')::public.difficulty_level,
      p_payload->>'lesson',
      p_payload->>'topic',
      (p_payload->>'question_set_id')::uuid,
      (p_payload->>'category_id')::uuid,
      p_payload->>'anki_card_id',
      p_payload->>'anki_deck_name',
      'draft', v_source, v_source_detail, p_actor, p_actor,
      1, 0, 0)
    returning * into q;

    v_id := q.id;
    v_kind := 'create';
  else
    -- ----- edit -------------------------------------------------------------------------
    select * into q from public.questions where id = p_question_id for update;
    if not found then
      raise exception using errcode = 'PBN01', message = 'Question not found';
    end if;
    v_id := q.id;
    v_live := q.status in ('published', 'flagged');

    if v_actor.is_bot then
      if q.created_by <> p_actor or q.status <> 'draft' then
        raise exception using errcode = 'PBA01', message = 'A bot can only edit its own drafts';
      end if;
    end if;

    if v_live then
      v_kind := coalesce(p_update_type, 'patch');
      if v_kind not in ('patch', 'minor', 'major') then
        raise exception using errcode = 'PBV01', message = 'update type must be patch, minor or major';
      end if;
    else
      v_kind := 'edit';
    end if;

    -- Who may edit (mirrors can-edit-question.ts)
    if not v_actor.is_admin then
      if q.status = 'published' then
        if v_kind = 'patch' then
          if not ((v_actor.can_create and q.created_by = p_actor) or v_actor.can_review) then
            raise exception using errcode = 'PBA01',
              message = 'Only the author or a reviewer can make patch edits to a published question';
          end if;
        elsif not v_actor.can_create then
          raise exception using errcode = 'PBA01',
            message = 'Only question writers can make minor or major edits to a published question';
        end if;
      elsif q.status = 'pending_review' then
        if not ((v_actor.can_review and q.reviewer_id = p_actor)
                or (v_actor.can_create and q.created_by = p_actor)) then
          raise exception using errcode = 'PBA01',
            message = 'You can only edit questions you created or are assigned to review';
        end if;
      elsif not (v_actor.can_create and q.created_by = p_actor) then
        raise exception using errcode = 'PBA01', message = 'You can only edit questions you created';
      end if;
    end if;

    if (p_payload ? 'source' or p_payload ? 'source_detail') and not v_actor.is_admin then
      raise exception using errcode = 'PBA01', message = 'Only an admin can change where a question came from';
    end if;
    if p_payload ? 'source'
       and p_payload->>'source' not in ('manual', 'ai_assisted', 'llm_batch', 'import') then
      raise exception using errcode = 'PBV01',
        message = 'source must be manual, ai_assisted, llm_batch or import';
    end if;
    if p_payload ? 'reviewer_id' and not (v_live and v_kind in ('minor', 'major')) then
      raise exception using errcode = 'PBV01',
        message = 'Set the reviewer by submitting for review or reassigning';
    end if;

    update public.questions set
      title = case when p_payload ? 'title' then p_payload->>'title' else title end,
      stem = case when p_payload ? 'stem' then p_payload->>'stem' else stem end,
      teaching_point = case when p_payload ? 'teaching_point'
        then coalesce(p_payload->>'teaching_point', '') else teaching_point end,
      question_references = case when p_payload ? 'question_references'
        then p_payload->>'question_references' else question_references end,
      difficulty = case when p_payload ? 'difficulty'
        then (p_payload->>'difficulty')::public.difficulty_level else difficulty end,
      lesson = case when p_payload ? 'lesson' then p_payload->>'lesson' else lesson end,
      topic = case when p_payload ? 'topic' then p_payload->>'topic' else topic end,
      question_set_id = case when p_payload ? 'question_set_id'
        then (p_payload->>'question_set_id')::uuid else question_set_id end,
      category_id = case when p_payload ? 'category_id'
        then (p_payload->>'category_id')::uuid else category_id end,
      anki_card_id = case when p_payload ? 'anki_card_id'
        then p_payload->>'anki_card_id' else anki_card_id end,
      anki_deck_name = case when p_payload ? 'anki_deck_name'
        then p_payload->>'anki_deck_name' else anki_deck_name end,
      source = case when p_payload ? 'source' then p_payload->>'source' else source end,
      source_detail = case when p_payload ? 'source_detail'
        then p_payload->'source_detail' else source_detail end,
      updated_by = p_actor,
      updated_at = now()
    where id = v_id;
  end if;

  -- ----- answer options: replace the set, keeping ids that are sent back -----------------
  if p_payload ? 'options' then
    if (select count(*) from jsonb_array_elements(p_payload->'options') e
        where e ? 'id' and e->>'id' is not null)
       <> (select count(distinct e->>'id') from jsonb_array_elements(p_payload->'options') e
           where e ? 'id' and e->>'id' is not null) then
      raise exception using errcode = 'PBV01', message = 'An answer option appears twice';
    end if;

    for v_opt in select e from jsonb_array_elements(p_payload->'options') e loop
      if jsonb_typeof(v_opt) <> 'object' or jsonb_typeof(v_opt->'text') is distinct from 'string' then
        raise exception using errcode = 'PBV01', message = 'Each answer option needs text';
      end if;

      if v_opt->>'id' is not null then
        v_opt_id := (v_opt->>'id')::uuid;
        update public.question_options set
          text = v_opt->>'text',
          is_correct = coalesce((v_opt->>'is_correct')::boolean, false),
          explanation = nullif(v_opt->>'explanation', ''),
          order_index = v_idx,
          updated_at = now()
        where id = v_opt_id and question_id = v_id;
        if not found then
          raise exception using errcode = 'PBV01', message = 'An answer option does not belong to this question';
        end if;
      else
        insert into public.question_options (question_id, text, is_correct, explanation, order_index)
        values (v_id, v_opt->>'text', coalesce((v_opt->>'is_correct')::boolean, false),
                nullif(v_opt->>'explanation', ''), v_idx)
        returning id into v_opt_id;
      end if;

      v_keep := v_keep || v_opt_id;
      v_idx := v_idx + 1;
    end loop;

    if exists (
      select 1 from public.question_options o
      where o.question_id = v_id and not (o.id = any (v_keep))
        and exists (select 1 from public.quiz_attempts a
                    where a.selected_answer_id = o.id or a.first_answer_id = o.id)) then
      raise exception using errcode = 'PBV01',
        message = 'Students have already answered an option you removed; edit its text instead of removing it';
    end if;

    delete from public.question_options
    where question_id = v_id and not (id = any (v_keep));
  end if;

  -- ----- images: replace the set ---------------------------------------------------------
  if p_payload ? 'images' then
    delete from public.question_images where question_id = v_id;
    insert into public.question_images (question_id, image_id, question_section, order_index)
    select v_id,
           (e->>'image_id')::uuid,
           e->>'question_section',
           coalesce((e->>'order_index')::int, (n - 1)::int)
    from jsonb_array_elements(p_payload->'images') with ordinality as t(e, n);
  end if;

  -- ----- tags: replace the set -----------------------------------------------------------
  if p_payload ? 'tag_ids' then
    delete from public.question_tags where question_id = v_id;
    insert into public.question_tags (question_id, tag_id)
    select distinct v_id, (t.value)::uuid
    from jsonb_array_elements_text(p_payload->'tag_ids') t
    where t.value is not null and btrim(t.value) <> '';
  end if;

  -- ----- live questions and bot batches must stay complete -------------------------------
  if v_live or v_actor.is_bot then
    v_errors := internal.question_completeness_errors(v_id);
    if cardinality(v_errors) > 0 then
      raise exception using errcode = 'PBV01',
        message = 'Question is incomplete: ' || array_to_string(v_errors, '; ');
    end if;
  end if;

  -- ----- version bump for live questions -------------------------------------------------
  if v_live then
    if v_kind in ('minor', 'major') then
      v_reviewer := coalesce((p_payload->>'reviewer_id')::uuid, q.reviewer_id);
      if v_reviewer is null then
        raise exception using errcode = 'PBV01',
          message = 'A minor or major edit needs a reviewer; make a patch edit or choose a reviewer';
      end if;
      perform internal.assert_valid_reviewer(v_reviewer, q.created_by);
      if v_reviewer = p_actor and not v_actor.is_admin then
        raise exception using errcode = 'PBV01',
          message = 'You cannot review your own edit; choose another reviewer';
      end if;
    end if;

    update public.questions set
      version_major = case when v_kind = 'major' then version_major + 1 else version_major end,
      version_minor = case when v_kind = 'major' then 0
                           when v_kind = 'minor' then version_minor + 1 else version_minor end,
      version_patch = case when v_kind = 'patch' then version_patch + 1 else 0 end,
      status = case when v_kind in ('minor', 'major') then 'pending_review'::public.question_status
                    else status end,
      reviewer_id = case when v_kind in ('minor', 'major') then v_reviewer else reviewer_id end
    where id = v_id;
  end if;

  -- ----- snapshot the result -------------------------------------------------------------
  select * into q from public.questions where id = v_id;

  insert into public.question_versions (
    question_id, question_data, update_type, change_summary, changed_by,
    version_major, version_minor, version_patch, legacy)
  values (
    v_id, internal.question_snapshot(v_id), v_kind,
    coalesce(nullif(btrim(p_change_summary), ''),
             case v_kind when 'create' then 'Created' when 'edit' then 'Edited'
                         else initcap(v_kind) || ' edit' end),
    p_actor, q.version_major, q.version_minor, q.version_patch, false)
  returning id into v_version_id;

  return jsonb_build_object(
    'question_id', v_id,
    'status', q.status,
    'reviewer_id', q.reviewer_id,
    'created_by', q.created_by,
    'title', q.title,
    'update_type', v_kind,
    'version', jsonb_build_object(
      'major', q.version_major, 'minor', q.version_minor, 'patch', q.version_patch),
    'version_id', v_version_id);
end;
$$;

revoke all on function public.save_question(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.save_question(uuid, uuid, jsonb, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. transition_question: review workflow and retirement
-- ---------------------------------------------------------------------------------------------
-- p_action:
--   submit    draft|rejected -> pending_review   admin or author; needs p_reviewer_id
--   approve   pending_review -> published        admin, or assigned reviewer who is not the author
--             draft|rejected -> published        admin only (direct publish)
--   reject    pending_review -> rejected         admin, or assigned reviewer who is not the author
--             published|flagged -> rejected      admin only; needs p_feedback
--   reassign  pending_review, new reviewer       admin or author; needs p_reviewer_id
--   archive   any other status -> archived       admin; the author for draft or rejected
--   restore   archived -> draft                  admin or author
-- Bots can make no transitions. Submit and approve require a complete question.
create or replace function public.transition_question(
  p_actor uuid,
  p_question_id uuid,
  p_action text,
  p_reviewer_id uuid default null,
  p_feedback text default null,
  p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor record;
  q public.questions%rowtype;
  v_prev public.question_status;
  v_errors text[];
  v_is_author boolean;
  v_kind text := 'status';
  v_summary text;
  v_version_id uuid;
begin
  if p_actor is null then
    raise exception using errcode = 'PBA01', message = 'No acting user';
  end if;
  if p_action is null or p_action not in ('submit', 'approve', 'reject', 'reassign', 'archive', 'restore') then
    raise exception using errcode = 'PBV01', message = 'Unknown action';
  end if;

  select * into v_actor from internal.question_actor(p_actor);
  if v_actor.is_bot then
    raise exception using errcode = 'PBA01', message = 'A bot cannot change review status';
  end if;

  select * into q from public.questions where id = p_question_id for update;
  if not found then
    raise exception using errcode = 'PBN01', message = 'Question not found';
  end if;
  v_prev := q.status;
  v_is_author := q.created_by = p_actor and v_actor.can_create;

  if p_action = 'submit' then
    if q.status not in ('draft', 'rejected') then
      raise exception using errcode = 'PBC01', message = 'Only drafts and rejected questions can be submitted';
    end if;
    if not (v_actor.is_admin or v_is_author) then
      raise exception using errcode = 'PBA01', message = 'Only the author or an admin can submit this question';
    end if;
    perform internal.assert_valid_reviewer(p_reviewer_id, q.created_by);
    v_errors := internal.question_completeness_errors(q.id);
    if cardinality(v_errors) > 0 then
      raise exception using errcode = 'PBV01',
        message = 'Question is incomplete: ' || array_to_string(v_errors, '; ');
    end if;

    update public.questions
    set status = 'pending_review', reviewer_id = p_reviewer_id, reviewer_feedback = null,
        updated_by = p_actor, updated_at = now()
    where id = q.id;

    if v_prev = 'rejected' and coalesce(btrim(p_notes), '') <> '' then
      insert into public.question_reviews (question_id, reviewer_id, action, feedback, changes_made)
      values (q.id, p_actor, 'resubmitted', null, jsonb_build_object(
        'resubmission_notes', btrim(p_notes),
        'timestamp', now(),
        'previous_status', 'rejected',
        'new_status', 'pending_review'));
    end if;
    v_summary := 'Submitted for review';

  elsif p_action = 'approve' then
    if q.status = 'pending_review' then
      if not (v_actor.is_admin
              or (v_actor.can_review and q.reviewer_id = p_actor and q.created_by <> p_actor)) then
        raise exception using errcode = 'PBA01',
          message = 'Only the assigned reviewer (not the author) or an admin can approve';
      end if;
      if not v_actor.is_admin and internal.last_review_editor(q.id) = p_actor then
        raise exception using errcode = 'PBA01', message = 'You cannot approve your own edit';
      end if;
    elsif q.status in ('draft', 'rejected') then
      if not v_actor.is_admin then
        raise exception using errcode = 'PBA01', message = 'Only an admin can publish without review';
      end if;
    else
      raise exception using errcode = 'PBC01', message = 'This question cannot be approved from its current status';
    end if;
    v_errors := internal.question_completeness_errors(q.id);
    if cardinality(v_errors) > 0 then
      raise exception using errcode = 'PBV01',
        message = 'Question is incomplete: ' || array_to_string(v_errors, '; ');
    end if;

    if q.published_at is null then
      v_kind := 'initial';
    end if;

    update public.questions
    set status = 'published',
        published_at = coalesce(published_at, now()),
        reviewer_id = case when v_prev = 'pending_review' then reviewer_id else p_actor end,
        updated_by = p_actor, updated_at = now()
    where id = q.id;

    insert into public.question_reviews (question_id, reviewer_id, action, feedback)
    values (q.id, p_actor, 'approved', nullif(btrim(p_feedback), ''));
    v_summary := case when v_kind = 'initial' then 'Initial publication' else 'Approved' end;

  elsif p_action = 'reject' then
    if coalesce(btrim(p_feedback), '') = '' then
      raise exception using errcode = 'PBV01', message = 'Feedback is required to reject';
    end if;
    if q.status = 'pending_review' then
      if not (v_actor.is_admin
              or (v_actor.can_review and q.reviewer_id = p_actor and q.created_by <> p_actor)) then
        raise exception using errcode = 'PBA01',
          message = 'Only the assigned reviewer (not the author) or an admin can reject';
      end if;
    elsif q.status in ('published', 'flagged') then
      if not v_actor.is_admin then
        raise exception using errcode = 'PBA01', message = 'Only an admin can send a live question back';
      end if;
    else
      raise exception using errcode = 'PBC01', message = 'This question cannot be rejected from its current status';
    end if;

    update public.questions
    set status = 'rejected', reviewer_feedback = btrim(p_feedback),
        updated_by = p_actor, updated_at = now()
    where id = q.id;

    insert into public.question_reviews (question_id, reviewer_id, action, feedback)
    values (q.id, p_actor, 'rejected', btrim(p_feedback));
    v_summary := 'Rejected';

  elsif p_action = 'reassign' then
    if q.status <> 'pending_review' then
      raise exception using errcode = 'PBC01', message = 'Only questions in review can be reassigned';
    end if;
    if not (v_actor.is_admin or v_is_author) then
      raise exception using errcode = 'PBA01', message = 'Only the author or an admin can reassign this question';
    end if;
    perform internal.assert_valid_reviewer(p_reviewer_id, q.created_by);
    if p_reviewer_id = internal.last_review_editor(q.id)
       and not exists (select 1 from public.users u where u.id = p_reviewer_id and u.role = 'admin'::public.user_role) then
      raise exception using errcode = 'PBV01', message = 'The person who made this edit cannot review it';
    end if;

    update public.questions
    set reviewer_id = p_reviewer_id, updated_by = p_actor, updated_at = now()
    where id = q.id;
    v_summary := 'Reviewer reassigned';

  elsif p_action = 'archive' then
    if q.status = 'archived' then
      raise exception using errcode = 'PBC01', message = 'Question is already archived';
    end if;
    if not (v_actor.is_admin or (v_is_author and q.status in ('draft', 'rejected'))) then
      raise exception using errcode = 'PBA01',
        message = 'Only an admin, or the author of a draft or rejected question, can archive it';
    end if;

    update public.questions
    set status = 'archived', updated_by = p_actor, updated_at = now()
    where id = q.id;
    v_summary := 'Archived';

  else -- restore
    if q.status <> 'archived' then
      raise exception using errcode = 'PBC01', message = 'Only archived questions can be restored';
    end if;
    if not (v_actor.is_admin or v_is_author) then
      raise exception using errcode = 'PBA01', message = 'Only the author or an admin can restore this question';
    end if;

    update public.questions
    set status = 'draft', updated_by = p_actor, updated_at = now()
    where id = q.id;
    v_summary := 'Restored as a draft';
  end if;

  select * into q from public.questions where id = p_question_id;

  insert into public.question_versions (
    question_id, question_data, update_type, change_summary, changed_by,
    version_major, version_minor, version_patch, legacy)
  values (
    q.id, internal.question_snapshot(q.id), v_kind,
    coalesce(nullif(btrim(p_notes), ''), v_summary),
    p_actor, q.version_major, q.version_minor, q.version_patch, false)
  returning id into v_version_id;

  return jsonb_build_object(
    'question_id', q.id,
    'action', p_action,
    'previous_status', v_prev,
    'status', q.status,
    'reviewer_id', q.reviewer_id,
    'created_by', q.created_by,
    'title', q.title,
    'version_id', v_version_id);
end;
$$;

revoke all on function public.transition_question(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.transition_question(uuid, uuid, text, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------
-- 10. Direct writes from the browser (anon/authenticated through PostgREST)
-- ---------------------------------------------------------------------------------------------
-- The API routes write through save_question/transition_question as service_role. RLS still
-- lets signed-in writers insert and edit their own drafts directly; until those policies are
-- removed (plan PR 3), keep source honest there and keep bot accounts out entirely.
create or replace function internal.auth_user_is_bot()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from internal.bot_accounts b where b.user_id = (select auth.uid()));
$$;

revoke all on function internal.auth_user_is_bot() from public, anon;
grant execute on function internal.auth_user_is_bot() to authenticated;

create or replace function internal.guard_direct_question_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if internal.auth_user_is_bot() then
    raise exception using errcode = 'PBA01',
      message = 'Bot accounts write questions through the API only';
  end if;

  if tg_op = 'INSERT' then
    new.source := 'manual';
    new.source_detail := jsonb_build_object('basis', 'direct');
  elsif new.source is distinct from old.source
        or new.source_detail is distinct from old.source_detail then
    raise exception using errcode = 'PBA01',
      message = 'Only an admin can change where a question came from';
  end if;
  return new;
end;
$$;

revoke all on function internal.guard_direct_question_write() from public, anon, authenticated;

create trigger questions_guard_direct_write
  before insert or update on public.questions
  for each row execute function internal.guard_direct_question_write();

commit;
