-- Fixed ids so the tests can refer to them.
insert into public.users (id, email, status, user_type, role, permissions) values
 ('00000000-0000-0000-0000-00000000000a', 'admin@test', 'active', 'faculty', 'admin', '{}'),
 ('00000000-0000-0000-0000-0000000000b1', 'writer@test', 'active', 'faculty', 'user', '{create_questions}'),
 ('00000000-0000-0000-0000-0000000000b2', 'writer2@test', 'active', 'faculty', 'user', '{create_questions}'),
 ('00000000-0000-0000-0000-0000000000c1', 'reviewer@test', 'active', 'faculty', 'user', '{review_questions}'),
 ('00000000-0000-0000-0000-0000000000c2', 'both@test', 'active', 'faculty', 'user', '{create_questions,review_questions}'),
 ('00000000-0000-0000-0000-0000000000d1', 'student@test', 'active', 'student', 'user', '{}'),
 ('00000000-0000-0000-0000-0000000000d2', 'gone@test', 'suspended', 'student', 'user', '{create_questions}'),
 ('00000000-0000-0000-0000-0000000000e1', 'bot@test', 'active', 'other', 'user', '{create_questions}'),
 ('00000000-0000-0000-0000-0000000000e2', 'botrev@test', 'active', 'other', 'user', '{create_questions,review_questions}');

insert into public.categories (id, name) values ('10000000-0000-0000-0000-000000000001', 'GI'), ('10000000-0000-0000-0000-000000000002', 'Liver');
insert into public.question_sets (id, name, source_type, source_details) values
 ('20000000-0000-0000-0000-000000000001', 'Claude Opus 4.6', 'AI-Generated', '{}'),
 ('20000000-0000-0000-0000-000000000002', 'Llama 3.3 70B', 'AI-Generated', '{"provider":"llama"}'),
 ('20000000-0000-0000-0000-000000000003', 'Claude Sonnet 4', 'AI-Generated', '{}'),
 ('20000000-0000-0000-0000-000000000004', 'PathOutlines', 'Web Resource', '{}');
insert into public.images (id, url) values ('30000000-0000-0000-0000-000000000001', 'a'), ('30000000-0000-0000-0000-000000000002', 'b');
insert into public.tags (id, name) values ('40000000-0000-0000-0000-000000000001', 'barrett'), ('40000000-0000-0000-0000-000000000002', 'dysplasia');

-- Pre-existing questions (one per status) by the admin, as live data is.
insert into public.questions (id, title, stem, teaching_point, created_by, updated_by, status, question_set_id, category_id,
  reviewer_id, reviewer_feedback, published_at, updated_at, version_major, version_minor, version_patch) values
 ('50000000-0000-0000-0000-000000000001', 'Pub', 'stem', 'tp', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'published', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', null, '2026-04-01', '2026-04-02', 1, 0, 0),
 ('50000000-0000-0000-0000-000000000002', 'Draft', 'stem', '', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'draft', '20000000-0000-0000-0000-000000000002', null, null, null, null, '2026-04-02', 1, 0, 0),
 ('50000000-0000-0000-0000-000000000003', 'Flagged', 'stem', 'tp', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'flagged', '20000000-0000-0000-0000-000000000003', null, null, null, '2026-04-01', '2026-04-02', 1, 0, 2),
 ('50000000-0000-0000-0000-000000000004', 'Web', 'stem', 'tp', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'archived', '20000000-0000-0000-0000-000000000004', null, null, null, null, '2026-04-02', 1, 0, 0),
 ('50000000-0000-0000-0000-000000000005', 'Writer draft', 'stem', 'tp', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'draft', null, null, null, null, null, '2026-04-02', 1, 0, 0);

insert into public.question_options (id, question_id, text, is_correct, order_index) values
 ('60000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000001', 'A', true, 0),
 ('60000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000001', 'B', false, 1),
 ('60000000-0000-0000-0000-000000000013', '50000000-0000-0000-0000-000000000001', 'C', false, 2),
 ('60000000-0000-0000-0000-000000000031', '50000000-0000-0000-0000-000000000003', 'A', true, 0),
 ('60000000-0000-0000-0000-000000000032', '50000000-0000-0000-0000-000000000003', 'B', true, 1),
 ('60000000-0000-0000-0000-000000000051', '50000000-0000-0000-0000-000000000005', 'A', true, 0),
 ('60000000-0000-0000-0000-000000000052', '50000000-0000-0000-0000-000000000005', 'B', false, 1);
insert into public.question_flags (question_id, flagged_by) values ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000d1');
update public.questions set status = 'flagged' where id = '50000000-0000-0000-0000-000000000003';
alter table public.questions disable trigger questions_updated_by_trigger;
update public.questions set updated_at = '2026-04-02' where id = '50000000-0000-0000-0000-000000000003';
alter table public.questions enable trigger questions_updated_by_trigger;
insert into public.quiz_sessions (id) values ('70000000-0000-0000-0000-000000000001');
insert into public.quiz_attempts (quiz_session_id, question_id, selected_answer_id, first_answer_id) values
 ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000012', '60000000-0000-0000-0000-000000000013');
insert into public.question_versions (question_id, question_data, update_type, change_summary, changed_by) values
 ('50000000-0000-0000-0000-000000000001', '{"title":"Pub"}', 'initial', 'old', '00000000-0000-0000-0000-00000000000a'),
 ('50000000-0000-0000-0000-000000000003', '{"title":"Flagged"}', 'patch', 'old', '00000000-0000-0000-0000-00000000000a');
