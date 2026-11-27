-- Rollback of 20261127120000_admin_check_policies.sql: puts the inline admin check back in the
-- same 79 policies, each in its original spelling (table name or alias u). Matches the policies
-- exactly as they were live on 2026-11-27.

begin;
set local lock_timeout = '5s';

do $$
declare
  admin_fn constant text := '\( SELECT internal\.is_current_user_admin\(\) AS is_current_user_admin\)';
  inline_users constant text := E'(EXISTS ( SELECT 1\n   FROM users\n  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ''admin''::user_role))))';
  inline_u constant text := E'(EXISTS ( SELECT 1\n   FROM users u\n  WHERE ((u.id = ( SELECT auth.uid() AS uid)) AND (u.role = ''admin''::user_role))))';
  r record;
  repl text;
  changed int := 0;
begin
  for r in
    select p.tablename, p.policyname, p.qual, p.with_check, t.alias
    from (values
    ('assays', 'assays_delete_admin', false),
    ('assays', 'assays_insert_admin', false),
    ('assays', 'assays_update_admin', false),
    ('audio', 'Only admins can delete audio', false),
    ('audio', 'Only admins can insert audio', false),
    ('audio', 'Only admins can update audio', false),
    ('authorities', 'authorities_delete_admin', true),
    ('authorities', 'authorities_insert_admin', true),
    ('authorities', 'authorities_update_admin', true),
    ('axis_authority_ranks', 'axis_authority_ranks_delete_admin', true),
    ('axis_authority_ranks', 'axis_authority_ranks_insert_admin', true),
    ('axis_authority_ranks', 'axis_authority_ranks_update_admin', true),
    ('categories', 'categories_delete_admin', false),
    ('categories', 'categories_insert_admin', false),
    ('categories', 'categories_update_admin', false),
    ('classifications', 'classifications_delete_admin', true),
    ('classifications', 'classifications_insert_admin', true),
    ('classifications', 'classifications_update_admin', true),
    ('documents', 'documents_select_admin', true),
    ('entities', 'entities_delete_admin', false),
    ('entities', 'entities_insert_admin', false),
    ('entities', 'entities_update_admin', false),
    ('entity_differentials', 'entity_differentials_delete_admin', false),
    ('entity_differentials', 'entity_differentials_insert_admin', false),
    ('entity_differentials', 'entity_differentials_update_admin', false),
    ('entity_sites', 'entity_sites_delete_admin', true),
    ('entity_sites', 'entity_sites_insert_admin', true),
    ('entity_sites', 'entity_sites_update_admin', true),
    ('entity_synonyms', 'entity_synonyms_delete_admin', false),
    ('entity_synonyms', 'entity_synonyms_insert_admin', false),
    ('entity_synonyms', 'entity_synonyms_update_admin', false),
    ('genes', 'genes_delete_admin', false),
    ('genes', 'genes_insert_admin', false),
    ('genes', 'genes_update_admin', false),
    ('heading_axis_map', 'heading_axis_map_delete_admin', true),
    ('heading_axis_map', 'heading_axis_map_insert_admin', true),
    ('heading_axis_map', 'heading_axis_map_update_admin', true),
    ('images', 'Allow admins to delete images', false),
    ('images', 'Allow admins to insert images', false),
    ('images', 'Allow admins to update images', false),
    ('learning_subjects', 'learning_subjects_delete_admin', false),
    ('learning_subjects', 'learning_subjects_insert_admin', false),
    ('learning_subjects', 'learning_subjects_update_admin', false),
    ('lessons', 'lessons_delete_admin', false),
    ('lessons', 'lessons_insert_admin', false),
    ('lessons', 'lessons_update_admin', false),
    ('marker_synonyms', 'marker_synonyms_delete_admin', false),
    ('marker_synonyms', 'marker_synonyms_insert_admin', false),
    ('marker_synonyms', 'marker_synonyms_update_admin', false),
    ('markers', 'markers_delete_admin', false),
    ('markers', 'markers_insert_admin', false),
    ('markers', 'markers_update_admin', false),
    ('monograph_axes', 'monograph_axes_delete_admin', true),
    ('monograph_axes', 'monograph_axes_insert_admin', true),
    ('monograph_axes', 'monograph_axes_update_admin', true),
    ('passages', 'passages_select_admin', true),
    ('polarity_cues', 'polarity_cues_delete_admin', true),
    ('polarity_cues', 'polarity_cues_insert_admin', true),
    ('polarity_cues', 'polarity_cues_update_admin', true),
    ('predicates', 'predicates_delete_admin', true),
    ('predicates', 'predicates_insert_admin', true),
    ('predicates', 'predicates_update_admin', true),
    ('question_analytics', 'question_analytics_admin_select', false),
    ('question_options', 'Question options read access', false),
    ('question_sets', 'question_sets_delete_admin', false),
    ('questions', 'Questions read access', false),
    ('sites', 'sites_delete_admin', true),
    ('sites', 'sites_insert_admin', true),
    ('sites', 'sites_update_admin', true),
    ('sources', 'sources_delete_admin', false),
    ('sources', 'sources_insert_admin', false),
    ('sources', 'sources_update_admin', false),
    ('surrogates', 'surrogates_delete_admin', false),
    ('surrogates', 'surrogates_insert_admin', false),
    ('surrogates', 'surrogates_update_admin', false),
    ('svg_assets', 'svg_assets_delete_policy', true),
    ('svg_assets', 'svg_assets_insert_policy', true),
    ('svg_assets', 'svg_assets_update_policy', true),
    ('tags', 'tags_delete_admin', false)
    ) as t(tablename, policyname, alias)
    join pg_policies p on p.schemaname = 'public' and p.tablename = t.tablename and p.policyname = t.policyname
  loop
    repl := case when r.alias then inline_u else inline_users end;
    if r.qual ~ admin_fn then
      execute format('alter policy %I on public.%I using (%s)', r.policyname, r.tablename,
        regexp_replace(r.qual, admin_fn, repl, 'g'));
    end if;
    if r.with_check ~ admin_fn then
      execute format('alter policy %I on public.%I with check (%s)', r.policyname, r.tablename,
        regexp_replace(r.with_check, admin_fn, repl, 'g'));
    end if;
    changed := changed + 1;
  end loop;
  if changed <> 79 then
    raise exception 'expected to restore 79 policies, found %', changed;
  end if;
end $$;

commit;
