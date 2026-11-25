-- Phase 1, step 3: question tables are written only through the save path.
--
-- Apply after 20261125140000_question_save_path.sql is live AND the site code that calls
-- save_question / transition_question (PR "Route every question write through the new save
-- path") is deployed. From then on the site writes question tables only with the service role,
-- so signed-in and anonymous clients lose every write privilege on them. Reads are unchanged:
-- SELECT grants and the read policies stay as they are.
--
-- Checked on the live database (2026-11-25):
--   * Functions that write these tables are SECURITY DEFINER (save_question, transition_question,
--     create_question_version_simplified, handle_deleted_question, update_question_flag_metadata)
--     or callable by service_role only (kg_merge_entity), so none of them depends on the
--     anon/authenticated grants removed here.
--   * The site's remaining client-side writes were the metadata routes (now service role) and an
--     unused browser createQuestion hook (removed in the same PR).
-- Rollback: rollback/20261125150000_question_write_lockdown.down.sql restores the exact policies
-- and grants that were live before.

begin;
set local lock_timeout = '5s';

drop policy "Questions insert access" on public.questions;
drop policy "Questions update access" on public.questions;
drop policy "Questions delete access" on public.questions;

drop policy question_tags_insert_creator on public.question_tags;
drop policy question_tags_update_creator on public.question_tags;
drop policy question_tags_delete_creator on public.question_tags;

drop policy question_reviews_insert_authorized on public.question_reviews;

revoke insert, update, delete, truncate, references, trigger
  on public.questions, public.question_options, public.question_images,
     public.question_tags, public.question_reviews, public.question_versions
  from anon, authenticated;

commit;
