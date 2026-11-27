-- One admin check in every RLS policy: (select internal.is_current_user_admin()).
--
-- 79 policies on 31 tables still spelled the check out inline:
--   exists (select 1 from users [u] where id = auth.uid() and role = 'admin')
-- which is exactly the body of internal.is_current_user_admin(). The newer policies (question
-- tables, interactive_sequences, lessons/learning_subjects reads, r2_storage_metrics) call the
-- function. This rewrites each listed policy's USING / WITH CHECK in place with ALTER POLICY,
-- replacing only that sub-expression: names, commands, roles and every other condition (e.g. the
-- published / own-attempt branches of "Questions read access") are untouched, so who can do what
-- does not change.
--
-- Why it matters: one definition of "admin" to change (if admin ever moves to app_metadata or a
-- permission, it's one function), and the function runs as definer, so the check no longer
-- depends on the users table's own RLS and runs once per statement under the (select ...) wrapper.
--
-- Checked on the live database (2026-11-27): exactly these 79 policies contain the inline check,
-- all in schema public, in two spellings (table name, or alias u); every occurrence matches the
-- pattern below. The block fails (and the transaction rolls back) if any listed policy doesn't
-- contain it, or if any policy outside public.users still does afterwards.
-- Rollback: rollback/20261127120000_admin_check_policies.down.sql puts the inline check back,
-- in each policy's original spelling.

begin;
set local lock_timeout = '5s';

do $$
declare
  admin_inline constant text :=
    '\(EXISTS \( SELECT 1\s+FROM users( u)?\s+WHERE \(\((users|u)\.id = \( SELECT auth\.uid\(\) AS uid\)\) AND \((users|u)\.role = ''admin''::user_role\)\)\)\)';
  admin_fn constant text := '( SELECT internal.is_current_user_admin() AS is_current_user_admin)';
  r record;
  new_qual text;
  new_check text;
  changed int := 0;
  leftover int;
begin
  for r in
    select p.tablename, p.policyname, p.qual, p.with_check
    from (values
    ('assays', 'assays_delete_admin'),
    ('assays', 'assays_insert_admin'),
    ('assays', 'assays_update_admin'),
    ('audio', 'Only admins can delete audio'),
    ('audio', 'Only admins can insert audio'),
    ('audio', 'Only admins can update audio'),
    ('authorities', 'authorities_delete_admin'),
    ('authorities', 'authorities_insert_admin'),
    ('authorities', 'authorities_update_admin'),
    ('axis_authority_ranks', 'axis_authority_ranks_delete_admin'),
    ('axis_authority_ranks', 'axis_authority_ranks_insert_admin'),
    ('axis_authority_ranks', 'axis_authority_ranks_update_admin'),
    ('categories', 'categories_delete_admin'),
    ('categories', 'categories_insert_admin'),
    ('categories', 'categories_update_admin'),
    ('classifications', 'classifications_delete_admin'),
    ('classifications', 'classifications_insert_admin'),
    ('classifications', 'classifications_update_admin'),
    ('documents', 'documents_select_admin'),
    ('entities', 'entities_delete_admin'),
    ('entities', 'entities_insert_admin'),
    ('entities', 'entities_update_admin'),
    ('entity_differentials', 'entity_differentials_delete_admin'),
    ('entity_differentials', 'entity_differentials_insert_admin'),
    ('entity_differentials', 'entity_differentials_update_admin'),
    ('entity_sites', 'entity_sites_delete_admin'),
    ('entity_sites', 'entity_sites_insert_admin'),
    ('entity_sites', 'entity_sites_update_admin'),
    ('entity_synonyms', 'entity_synonyms_delete_admin'),
    ('entity_synonyms', 'entity_synonyms_insert_admin'),
    ('entity_synonyms', 'entity_synonyms_update_admin'),
    ('genes', 'genes_delete_admin'),
    ('genes', 'genes_insert_admin'),
    ('genes', 'genes_update_admin'),
    ('heading_axis_map', 'heading_axis_map_delete_admin'),
    ('heading_axis_map', 'heading_axis_map_insert_admin'),
    ('heading_axis_map', 'heading_axis_map_update_admin'),
    ('images', 'Allow admins to delete images'),
    ('images', 'Allow admins to insert images'),
    ('images', 'Allow admins to update images'),
    ('learning_subjects', 'learning_subjects_delete_admin'),
    ('learning_subjects', 'learning_subjects_insert_admin'),
    ('learning_subjects', 'learning_subjects_update_admin'),
    ('lessons', 'lessons_delete_admin'),
    ('lessons', 'lessons_insert_admin'),
    ('lessons', 'lessons_update_admin'),
    ('marker_synonyms', 'marker_synonyms_delete_admin'),
    ('marker_synonyms', 'marker_synonyms_insert_admin'),
    ('marker_synonyms', 'marker_synonyms_update_admin'),
    ('markers', 'markers_delete_admin'),
    ('markers', 'markers_insert_admin'),
    ('markers', 'markers_update_admin'),
    ('monograph_axes', 'monograph_axes_delete_admin'),
    ('monograph_axes', 'monograph_axes_insert_admin'),
    ('monograph_axes', 'monograph_axes_update_admin'),
    ('passages', 'passages_select_admin'),
    ('polarity_cues', 'polarity_cues_delete_admin'),
    ('polarity_cues', 'polarity_cues_insert_admin'),
    ('polarity_cues', 'polarity_cues_update_admin'),
    ('predicates', 'predicates_delete_admin'),
    ('predicates', 'predicates_insert_admin'),
    ('predicates', 'predicates_update_admin'),
    ('question_analytics', 'question_analytics_admin_select'),
    ('question_options', 'Question options read access'),
    ('question_sets', 'question_sets_delete_admin'),
    ('questions', 'Questions read access'),
    ('sites', 'sites_delete_admin'),
    ('sites', 'sites_insert_admin'),
    ('sites', 'sites_update_admin'),
    ('sources', 'sources_delete_admin'),
    ('sources', 'sources_insert_admin'),
    ('sources', 'sources_update_admin'),
    ('surrogates', 'surrogates_delete_admin'),
    ('surrogates', 'surrogates_insert_admin'),
    ('surrogates', 'surrogates_update_admin'),
    ('svg_assets', 'svg_assets_delete_policy'),
    ('svg_assets', 'svg_assets_insert_policy'),
    ('svg_assets', 'svg_assets_update_policy'),
    ('tags', 'tags_delete_admin')
    ) as t(tablename, policyname)
    join pg_policies p on p.schemaname = 'public' and p.tablename = t.tablename and p.policyname = t.policyname
  loop
    new_qual := regexp_replace(r.qual, admin_inline, admin_fn, 'g');
    new_check := regexp_replace(r.with_check, admin_inline, admin_fn, 'g');
    if new_qual is not distinct from r.qual and new_check is not distinct from r.with_check then
      raise exception 'policy %.% has no inline admin check', r.tablename, r.policyname;
    end if;
    if new_qual is distinct from r.qual then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename, new_qual);
    end if;
    if new_check is distinct from r.with_check then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename, new_check);
    end if;
    changed := changed + 1;
  end loop;
  if changed <> 79 then
    raise exception 'expected to rewrite 79 policies, rewrote %', changed;
  end if;

  select count(*) into leftover from pg_policies
  where tablename <> 'users' and coalesce(qual, '') || ' ' || coalesce(with_check, '') ~ admin_inline;
  if leftover > 0 then
    raise exception '% policies still contain the inline admin check', leftover;
  end if;
end $$;

commit;
