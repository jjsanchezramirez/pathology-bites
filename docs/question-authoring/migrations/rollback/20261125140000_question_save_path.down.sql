-- Rollback for 20261125140000_question_save_path.sql
--
-- Loses: questions.source / source_detail values, the question_versions.legacy flag, and the
-- bot registry. Snapshot rows written since the migration (update_type create, edit, status) are
-- KEPT; the old update_type check is restored NOT VALID so they stay while new rows are checked.
-- Run it before any app code that calls save_question or transition_question is deployed, or
-- roll that code back first.

begin;

set local lock_timeout = '5s';

drop trigger if exists questions_guard_direct_write on public.questions;
drop function if exists internal.guard_direct_question_write();
drop function if exists internal.auth_user_is_bot();
drop function if exists public.transition_question(uuid, uuid, text, uuid, text, text);
drop function if exists public.save_question(uuid, uuid, jsonb, text, text);
drop function if exists internal.last_review_editor(uuid);
drop function if exists internal.assert_valid_reviewer(uuid, uuid);
drop function if exists internal.question_actor(uuid);
drop function if exists internal.question_completeness_errors(uuid);
drop function if exists internal.question_snapshot(uuid);
drop table if exists internal.bot_accounts;

drop index if exists public.idx_question_versions_question_created;
alter table public.question_versions drop constraint if exists question_versions_update_type_check;
alter table public.question_versions
  add constraint question_versions_new_update_type_check
    check (update_type = any (array['initial'::text, 'patch'::text, 'minor'::text, 'major'::text]))
    not valid;
alter table public.question_versions drop column if exists legacy;

alter table public.questions drop constraint if exists questions_source_detail_object_check;
alter table public.questions drop constraint if exists questions_source_check;
alter table public.questions drop column if exists source_detail;
alter table public.questions drop column if exists source;

commit;
