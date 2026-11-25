-- Rollback of 20261125150000_question_write_lockdown.sql: restores the policies and grants
-- exactly as they were live on 2026-11-25.
begin;
set local lock_timeout = '5s';

grant insert, update, delete, truncate, references, trigger
  on public.questions, public.question_options, public.question_images,
     public.question_tags, public.question_reviews, public.question_versions
  to anon, authenticated;

create policy "Questions delete access" on public.questions as permissive for delete to public
  using ((exists ( select 1 from users where ((users.id = ( select auth.uid() as uid)) and (users.role = 'admin'::user_role)))));

create policy "Questions insert access" on public.questions as permissive for insert to authenticated
  with check ((( select internal.is_current_user_admin() as is_current_user_admin) or ((created_by = ( select auth.uid() as uid)) and ( select internal.has_permission('create_questions'::text) as has_permission))));

create policy "Questions update access" on public.questions as permissive for update to authenticated
  using ((( select internal.is_current_user_admin() as is_current_user_admin) or ((created_by = ( select auth.uid() as uid)) and (status = any (array['draft'::question_status, 'rejected'::question_status])) and ( select internal.has_permission('create_questions'::text) as has_permission)) or ((reviewer_id = ( select auth.uid() as uid)) and (status = 'pending_review'::question_status) and ( select internal.has_permission('review_questions'::text) as has_permission))))
  with check ((( select internal.is_current_user_admin() as is_current_user_admin) or ((created_by = ( select auth.uid() as uid)) and ((status = any (array['draft'::question_status, 'rejected'::question_status])) or ((status = 'pending_review'::question_status) and (reviewer_id is not null) and (reviewer_id <> ( select auth.uid() as uid)))) and ( select internal.has_permission('create_questions'::text) as has_permission)) or ((reviewer_id = ( select auth.uid() as uid)) and (created_by <> ( select auth.uid() as uid)) and (status = any (array['pending_review'::question_status, 'published'::question_status, 'rejected'::question_status])) and ( select internal.has_permission('review_questions'::text) as has_permission))));

create policy question_tags_delete_creator on public.question_tags as permissive for delete to authenticated
  using ((( select internal.has_permission('review_questions'::text) as has_permission) or (exists ( select 1 from questions q where ((q.id = question_tags.question_id) and (q.created_by = ( select auth.uid() as uid)))))));

create policy question_tags_insert_creator on public.question_tags as permissive for insert to authenticated
  with check ((( select internal.has_permission('review_questions'::text) as has_permission) or (exists ( select 1 from questions q where ((q.id = question_tags.question_id) and (q.created_by = ( select auth.uid() as uid)))))));

create policy question_tags_update_creator on public.question_tags as permissive for update to authenticated
  using ((( select internal.has_permission('review_questions'::text) as has_permission) or (exists ( select 1 from questions q where ((q.id = question_tags.question_id) and (q.created_by = ( select auth.uid() as uid)))))))
  with check ((( select internal.has_permission('review_questions'::text) as has_permission) or (exists ( select 1 from questions q where ((q.id = question_tags.question_id) and (q.created_by = ( select auth.uid() as uid)))))));

create policy question_reviews_insert_authorized on public.question_reviews as permissive for insert to authenticated
  with check ((((reviewer_id = ( select auth.uid() as uid)) and ( select internal.has_permission('review_questions'::text) as has_permission)) or ((action = 'resubmitted'::text) and (reviewer_id = ( select auth.uid() as uid)) and ( select internal.has_permission('create_questions'::text) as has_permission) and (exists ( select 1 from questions q where ((q.id = question_reviews.question_id) and (q.created_by = ( select auth.uid() as uid))))))));

commit;
