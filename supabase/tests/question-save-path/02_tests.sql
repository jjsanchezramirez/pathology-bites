-- Behaviour tests for save_question / transition_question. Run after the migration.
\set ON_ERROR_STOP on
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned

create function pg_temp.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected % but statement succeeded: %', p_code, p_sql;
exception when others then
  if sqlstate <> p_code then
    raise exception 'expected % got % (%) for: %', p_code, sqlstate, sqlerrm, p_sql;
  end if;
end $$;

create function pg_temp.ok(p boolean, p_msg text) returns void language plpgsql as $$
begin if p is not true then raise exception 'FAILED: %', p_msg; end if; end $$;

-- ids
\set admin '''00000000-0000-0000-0000-00000000000a'''
\set writer '''00000000-0000-0000-0000-0000000000b1'''
\set writer2 '''00000000-0000-0000-0000-0000000000b2'''
\set reviewer '''00000000-0000-0000-0000-0000000000c1'''
\set both '''00000000-0000-0000-0000-0000000000c2'''
\set student '''00000000-0000-0000-0000-0000000000d1'''
\set gone '''00000000-0000-0000-0000-0000000000d2'''
\set bot '''00000000-0000-0000-0000-0000000000e1'''
\set botrev '''00000000-0000-0000-0000-0000000000e2'''
\set pub '''50000000-0000-0000-0000-000000000001'''
\set draft '''50000000-0000-0000-0000-000000000002'''
\set flagged '''50000000-0000-0000-0000-000000000003'''
\set archived '''50000000-0000-0000-0000-000000000004'''
\set wdraft '''50000000-0000-0000-0000-000000000005'''

insert into internal.bot_accounts (user_id, label) values (:bot, 'batch-bot'), (:botrev, 'bot-with-review');

-- ===== migration effects ======================================================================
select pg_temp.ok((select source from questions where id = :pub) = 'llm_batch', 'Opus set -> llm_batch');
select pg_temp.ok((select source_detail->>'confidence' from questions where id = :pub) = 'medium', 'Opus confidence medium');
select pg_temp.ok((select source from questions where id = :draft) = 'ai_assisted', 'Llama set -> ai_assisted');
select pg_temp.ok((select source_detail->>'confidence' from questions where id = :draft) = 'medium', 'provider set medium');
select pg_temp.ok((select source_detail->>'confidence' from questions where id = :flagged) = 'low', 'Sonnet low');
select pg_temp.ok((select source from questions where id = :archived) = 'manual', 'web set -> manual default');
select pg_temp.ok((select source_detail->>'basis' from questions where id = :wdraft) = 'default', 'no set -> default basis');
select pg_temp.ok((select column_default from information_schema.columns where table_name = 'questions' and column_name = 'source_detail') like '%basis%default%', 'source_detail default marks unlabelled rows');
select pg_temp.ok((select bool_and(updated_at = '2026-04-02') from questions), 'backfill left updated_at alone');
select pg_temp.ok((select bool_and(legacy) from question_versions) and (select count(*) from question_versions) = 2, 'old versions legacy');

-- grants: only service_role can execute; anon/authenticated cannot, nor read the bot registry
select pg_temp.ok(not has_function_privilege('authenticated', 'public.save_question(uuid,uuid,jsonb,text,text)', 'execute'), 'authenticated cannot save');
select pg_temp.ok(not has_function_privilege('anon', 'public.save_question(uuid,uuid,jsonb,text,text)', 'execute'), 'anon cannot save');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.transition_question(uuid,uuid,text,uuid,text,text)', 'execute'), 'authenticated cannot transition');
select pg_temp.ok(has_function_privilege('service_role', 'public.transition_question(uuid,uuid,text,uuid,text,text)', 'execute'), 'service_role can transition');
select pg_temp.ok(not has_function_privilege('authenticated', 'internal.question_snapshot(uuid)', 'execute'), 'snapshot not callable');
select pg_temp.ok(not has_table_privilege('authenticated', 'internal.bot_accounts', 'select'), 'bot registry hidden');

-- ===== create =================================================================================
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000d1', null, '{"title":"t","stem":"s","source":"manual"}')$$, 'PBA01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000d2', null, '{"title":"t","stem":"s","source":"manual"}')$$, 'PBA01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', null, '{"title":"t","stem":"s"}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', null, '{"title":"t","stem":"s","source":"web"}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', null, '{"title":"t","stem":"s","source":"manual","status":"published"}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', null, '{"title":" ","stem":"s","source":"manual"}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', null, '{"title":"t","stem":"s","source":"manual","reviewer_id":"00000000-0000-0000-0000-0000000000c1"}')$$, 'PBV01');

-- writer creates an incomplete draft: allowed, snapshot written
create temp table r as select save_question(:writer, null,
  '{"title":"New","stem":"S","source":"ai_assisted","source_detail":{"model":"x"},"difficulty":"easy",
    "category_id":"10000000-0000-0000-0000-000000000001",
    "options":[{"text":"A","is_correct":true,"explanation":"why"},{"text":"B"}],
    "images":[{"image_id":"30000000-0000-0000-0000-000000000001","question_section":"stem"}],
    "tag_ids":["40000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000001"]}', 'first draft') as j;
select (j->>'question_id') as newq from r \gset
select pg_temp.ok((select status from questions where id = :'newq') = 'draft', 'new is draft');
select pg_temp.ok((select source from questions where id = :'newq') = 'ai_assisted', 'source kept');
select pg_temp.ok((select created_by from questions where id = :'newq') = :writer, 'credited to writer');
select pg_temp.ok((select count(*) from question_options where question_id = :'newq') = 2, '2 options');
select pg_temp.ok((select count(*) from question_tags where question_id = :'newq') = 1, 'tags deduped');
select pg_temp.ok((select count(*) from question_versions where question_id = :'newq' and update_type = 'create' and not legacy) = 1, 'create snapshot');
select pg_temp.ok((select question_data->'question_options'->0->>'explanation' from question_versions where question_id = :'newq') = 'why', 'snapshot has explanations');
select pg_temp.ok((select jsonb_array_length(question_data->'tags') from question_versions where question_id = :'newq') = 1, 'snapshot has tags');
select pg_temp.ok((select question_data->>'source' from question_versions where question_id = :'newq') = 'ai_assisted', 'snapshot has source');
select pg_temp.ok((select change_summary from question_versions where question_id = :'newq') = 'first draft', 'summary kept');

-- atomic: a bad image id rolls back the whole create
select count(*) as before_q from questions \gset
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', null, '{"title":"t","stem":"s","source":"manual","images":[{"image_id":"30000000-0000-0000-0000-00000000dead","question_section":"stem"}]}')$$, '23503');
select pg_temp.ok((select count(*) from questions) = :before_q, 'failed create left nothing');

-- ===== bot ====================================================================================
-- incomplete batch question refused
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000e1', null, '{"title":"t","stem":"s","options":[{"text":"A","is_correct":true}]}')$$, 'PBV01');
create temp table rb as select save_question(:bot, null,
  '{"title":"Bot q","stem":"S","teaching_point":"TP","source":"manual","source_detail":{"batch":"b1"},
    "options":[{"text":"A","is_correct":true},{"text":"B"},{"text":"C"}]}') as j;
select (j->>'question_id') as botq from rb \gset
select pg_temp.ok((select source from questions where id = :'botq') = 'llm_batch', 'bot source forced');
select pg_temp.ok((select source_detail->>'bot' from questions where id = :'botq') = 'batch-bot', 'bot label recorded');
select pg_temp.ok((select source_detail->>'batch' from questions where id = :'botq') = 'b1', 'batch detail kept');
select pg_temp.ok((select status from questions where id = :'botq') = 'draft', 'bot draft');
-- bot can edit own draft, not others, and makes no transitions
select save_question(:bot, :'botq', '{"stem":"S2"}');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-000000000005', '{"stem":"x"}')$$, 'PBA01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000e1', '50000000-0000-0000-0000-000000000001', '{"stem":"x"}')$$, 'PBA01');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000e1', %L, 'submit', '00000000-0000-0000-0000-0000000000c1')$$, :'botq'), 'PBA01');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000e1', %L, 'archive')$$, :'botq'), 'PBA01');
-- a bot cannot be a reviewer even with review_questions
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-00000000000a', %L, 'submit', '00000000-0000-0000-0000-0000000000e2')$$, :'botq'), 'PBV01');
-- bot cannot change source on edit
select pg_temp.expect_error(format($$select save_question('00000000-0000-0000-0000-0000000000e1', %L, '{"source":"manual"}')$$, :'botq'), 'PBA01');

-- ===== edit permissions (mirror can-edit-question.ts) ==========================================
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b2', '50000000-0000-0000-0000-000000000005', '{"stem":"x"}')$$, 'PBA01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-000000000005', '{"stem":"x"}')$$, 'PBA01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000005', '{"source":"import"}')$$, 'PBA01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000005', '{"reviewer_id":"00000000-0000-0000-0000-0000000000c1"}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-0000000000ff', '{"stem":"x"}')$$, 'PBN01');
select save_question(:writer, :wdraft, '{"stem":"edited","tag_ids":["40000000-0000-0000-0000-000000000002"]}', null, 'major');
select pg_temp.ok((select version_major from questions where id = :wdraft) = 1, 'draft edit does not bump version');
select pg_temp.ok((select update_type from question_versions where question_id = :wdraft order by created_at desc limit 1) = 'edit', 'draft edit snapshot kind');
-- options: keep ids, add, remove, foreign id refused
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000005', '{"options":[{"id":"60000000-0000-0000-0000-000000000011","text":"x"}]}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000005', '{"options":[{"id":"60000000-0000-0000-0000-000000000051","text":"x"},{"id":"60000000-0000-0000-0000-000000000051","text":"y"}]}')$$, 'PBV01');
select save_question(:writer, :wdraft, '{"options":[{"id":"60000000-0000-0000-0000-000000000052","text":"B2","is_correct":true},{"text":"C"}]}');
select pg_temp.ok((select string_agg(text || ':' || is_correct || ':' || order_index, ',' order by order_index) from question_options where question_id = :wdraft) = 'B2:true:0,C:false:1', 'options replaced in order');
select pg_temp.ok(not exists (select 1 from question_options where id = '60000000-0000-0000-0000-000000000051'), 'removed option deleted');

-- ===== published edits ========================================================================
-- patch by a reviewer (not author) allowed; writer2 (not author) patch refused
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b2', '50000000-0000-0000-0000-000000000001', '{"stem":"x"}', null, 'patch')$$, 'PBA01');
select save_question(:reviewer, :pub, '{"stem":"typo fixed"}', 'typo', 'patch');
select pg_temp.ok((select version_patch from questions where id = :pub) = 1 and (select status from questions where id = :pub) = 'published', 'patch bump, stays live');
select pg_temp.ok((select (question_data->'version'->>'patch')::int from question_versions where question_id = :pub and not legacy order by created_at desc limit 1) = 1, 'snapshot is after-save');
-- removing an option students answered is refused (selected and first answer)
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', '{"options":[{"id":"60000000-0000-0000-0000-000000000011","text":"A","is_correct":true},{"id":"60000000-0000-0000-0000-000000000012","text":"B"}]}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', '{"options":[{"id":"60000000-0000-0000-0000-000000000011","text":"A","is_correct":true},{"id":"60000000-0000-0000-0000-000000000013","text":"C"}]}')$$, 'PBV01');
-- live question must stay complete
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', '{"teaching_point":""}')$$, 'PBV01');
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', '{"stem":"x"}', null, 'huge')$$, 'PBV01');
-- minor edit needs a valid reviewer and sends the question to review
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000001', '{"stem":"x","reviewer_id":"00000000-0000-0000-0000-0000000000d1"}', null, 'minor')$$, 'PBV01');
select save_question(:writer, :pub, '{"stem":"reworded","reviewer_id":"00000000-0000-0000-0000-0000000000c1"}', 'reword', 'minor');
select pg_temp.ok((select status::text || version_major || version_minor || version_patch from questions where id = :pub) = 'pending_review110', 'minor -> 1.1.0 in review');
select pg_temp.ok((select reviewer_id from questions where id = :pub) = :reviewer, 'reviewer set');

-- ===== flagged ================================================================================
-- flagged question with two correct answers: edit must fix it
select pg_temp.expect_error($$select save_question('00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000003', '{"stem":"x"}')$$, 'PBV01');
select save_question(:admin, :flagged, '{"options":[{"id":"60000000-0000-0000-0000-000000000031","text":"A","is_correct":true},{"id":"60000000-0000-0000-0000-000000000032","text":"B","is_correct":false}]}', 'fix key');
select pg_temp.ok((select status::text || version_patch from questions where id = :flagged) = 'flagged3', 'flagged patch keeps status, bumps');

-- ===== transitions ============================================================================
-- approve by the assigned reviewer
select pg_temp.expect_error($$select transition_question('00000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-000000000001', 'approve')$$, 'PBA01');
select transition_question(:reviewer, :pub, 'approve');
select pg_temp.ok((select status from questions where id = :pub) = 'published', 'approved');
select pg_temp.ok((select update_type from question_versions where question_id = :pub order by created_at desc limit 1) = 'status', 'republish is a status snapshot');
select pg_temp.ok((select count(*) from question_reviews where question_id = :pub and action = 'approved') = 1, 'approved review row');

-- submit: incomplete refused, self-review refused for non-admins, unknown reviewer refused
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000b1', %L, 'submit', '00000000-0000-0000-0000-0000000000c1')$$, :'newq'), 'PBV01');
select save_question(:writer, :'newq', '{"teaching_point":"tp"}');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000b1', %L, 'submit', null)$$, :'newq'), 'PBV01');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000b2', %L, 'submit', '00000000-0000-0000-0000-0000000000c1')$$, :'newq'), 'PBA01');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000c2', %L, 'submit', '00000000-0000-0000-0000-0000000000c2')$$, :'newq'), 'PBA01');
select transition_question(:writer, :'newq', 'submit', :both);
select pg_temp.ok((select status from questions where id = :'newq') = 'pending_review', 'submitted');
-- reviewer edits while in review (assigned) ok; other reviewer not
select save_question(:both, :'newq', '{"stem":"reviewer tweak"}');
select pg_temp.expect_error(format($$select save_question('00000000-0000-0000-0000-0000000000c1', %L, '{"stem":"x"}')$$, :'newq'), 'PBA01');
-- reassign
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000b1', %L, 'reassign', '00000000-0000-0000-0000-0000000000b1')$$, :'newq'), 'PBV01');
select transition_question(:writer, :'newq', 'reassign', :reviewer);
-- reject needs feedback; then resubmit with notes writes a resubmitted row
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000c1', %L, 'reject', null, '  ')$$, :'newq'), 'PBV01');
select transition_question(:reviewer, :'newq', 'reject', null, 'needs a citation');
select pg_temp.ok((select reviewer_feedback from questions where id = :'newq') = 'needs a citation', 'feedback stored');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000c1', %L, 'approve')$$, :'newq'), 'PBA01');
select transition_question(:writer, :'newq', 'submit', :reviewer, null, 'added citation');
select pg_temp.ok((select count(*) from question_reviews where question_id = :'newq' and action = 'resubmitted') = 1, 'resubmitted row');
select pg_temp.ok((select reviewer_feedback from questions where id = :'newq') is null, 'feedback cleared');
select transition_question(:reviewer, :'newq', 'approve');
select pg_temp.ok((select update_type from question_versions where question_id = :'newq' order by created_at desc limit 1) = 'initial', 'first publish is initial');

-- admin fast path: publish own draft directly after completing it; self-review allowed for admin
select pg_temp.expect_error($$select transition_question('00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', 'approve')$$, 'PBV01');
select save_question(:admin, :draft, '{"teaching_point":"tp","options":[{"text":"A","is_correct":true},{"text":"B"}]}');
select transition_question(:admin, :draft, 'submit', :admin);
select transition_question(:admin, :draft, 'approve');
select pg_temp.ok((select status from questions where id = :draft) = 'published', 'admin self-review publish');
select pg_temp.expect_error($$select transition_question('00000000-0000-0000-0000-0000000000c2', '50000000-0000-0000-0000-000000000005', 'approve')$$, 'PBA01');

-- reject live: admin only
select pg_temp.expect_error($$select transition_question('00000000-0000-0000-0000-0000000000c1', '50000000-0000-0000-0000-000000000001', 'reject', null, 'pull')$$, 'PBA01');

-- archive / restore: never deletes; author only for own draft
select pg_temp.expect_error($$select transition_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000001', 'archive')$$, 'PBA01');
select transition_question(:writer, :wdraft, 'archive', null, null, 'duplicate');
select pg_temp.ok((select status from questions where id = :wdraft) = 'archived', 'archived');
select pg_temp.ok((select change_summary from question_versions where question_id = :wdraft order by created_at desc limit 1) = 'duplicate', 'archive note');
select pg_temp.expect_error($$select transition_question('00000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000005', 'archive')$$, 'PBC01');
select transition_question(:writer, :wdraft, 'restore');
select pg_temp.ok((select status from questions where id = :wdraft) = 'draft', 'restored to draft');
select transition_question(:admin, :pub, 'archive');
select pg_temp.ok((select count(*) from quiz_attempts where question_id = :pub) = 1, 'attempts kept on archive');
select pg_temp.expect_error($$select transition_question('00000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001', 'fly')$$, 'PBV01');

-- ===== audit follow-ups ========================================================================
-- null and empty tag ids are skipped, not a crash
create temp table r2 as select save_question(:admin, null, '{"title":"Audit q","stem":"s","teaching_point":"tp","source":"manual",
    "options":[{"text":"A","is_correct":true},{"text":"B"}],
    "tag_ids":[null,"","40000000-0000-0000-0000-000000000001"]}') as j;
select (j->>'question_id') as aq from r2 \gset
select pg_temp.ok((select count(*) from question_tags where question_id = :'aq') = 1, 'null/empty tag ids skipped');

-- admin direct publish from draft (no submit), credited as reviewer
select transition_question(:admin, :'aq', 'approve');
select pg_temp.ok((select status = 'published' and reviewer_id = :admin from questions where id = :'aq'), 'admin direct publish');
select pg_temp.ok(exists (select 1 from question_reviews where question_id = :'aq' and action = 'approved'), 'direct publish writes review row');
select published_at as aq_pub from questions where id = :'aq' \gset

-- a non-admin cannot review their own minor edit (named, or inherited as the current reviewer)
update questions set reviewer_id = :both where id = :'aq';
select pg_temp.expect_error(format($$select save_question('00000000-0000-0000-0000-0000000000c2', %L, '{"stem":"s2"}', null, 'minor')$$, :'aq'), 'PBV01');
select pg_temp.expect_error(format($$select save_question('00000000-0000-0000-0000-0000000000c2', %L, '{"stem":"s2","reviewer_id":"00000000-0000-0000-0000-0000000000c2"}', null, 'minor')$$, :'aq'), 'PBV01');

-- the person who made a minor edit cannot review it, even if reassigned to them later
select save_question(:both, :'aq', '{"stem":"edited by both","reviewer_id":"00000000-0000-0000-0000-0000000000c1"}', null, 'minor');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-00000000000a', %L, 'reassign', '00000000-0000-0000-0000-0000000000c2')$$, :'aq'), 'PBV01');
update questions set reviewer_id = :both where id = :'aq';
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000c2', %L, 'approve')$$, :'aq'), 'PBA01');
select transition_question(:admin, :'aq', 'reassign', :reviewer);
select transition_question(:reviewer, :'aq', 'approve');
-- once that review is over, the earlier editor may review a later round
select pg_temp.ok(internal.last_review_editor(:'aq') is null, 'edit stops counting after its review ends');

-- minor edit then re-approval keeps the first publication date
select pg_sleep(0.01);
select save_question(:admin, :'aq', '{"stem":"s3","reviewer_id":"00000000-0000-0000-0000-0000000000c1"}', null, 'minor');
select pg_temp.ok((select status from questions where id = :'aq') = 'pending_review', 'minor edit back to review');
select transition_question(:reviewer, :'aq', 'approve');
select pg_temp.ok((select published_at from questions where id = :'aq') = :'aq_pub'::timestamptz, 're-approval keeps published_at');
select pg_temp.ok((select update_type from question_versions where question_id = :'aq' order by created_at desc limit 1) = 'status', 're-approval snapshot is status');

-- major edit resets minor and patch
select save_question(:admin, :'aq', '{"stem":"s4","reviewer_id":"00000000-0000-0000-0000-0000000000c1"}', null, 'major');
select pg_temp.ok((select version_major = 2 and version_minor = 0 and version_patch = 0 from questions where id = :'aq'), 'major bump');
select transition_question(:reviewer, :'aq', 'approve');

-- admin sends a published question back
select transition_question(:admin, :'aq', 'reject', null, 'needs a better image');
select pg_temp.ok((select status from questions where id = :'aq') = 'rejected', 'admin rejects live question');

-- restore refused for someone who is not the author
select transition_question(:writer, :wdraft, 'archive');
select pg_temp.expect_error(format($$select transition_question('00000000-0000-0000-0000-0000000000b2', %L, 'restore')$$, :wdraft), 'PBA01');
select transition_question(:writer, :wdraft, 'restore');

-- direct writes from the browser: source forced on insert, frozen on update, bots refused
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
insert into questions (title, stem, teaching_point, created_by, updated_by, status, source, source_detail)
values ('direct', 's', 'tp', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b1', 'draft', 'llm_batch', '{"model":"x"}');
select pg_temp.ok((select source = 'manual' and source_detail = '{"basis":"direct"}' from questions where title = 'direct'), 'direct insert labelled');
update questions set stem = 's2' where title = 'direct';
select pg_temp.expect_error($$update questions set source = 'import' where title = 'direct'$$, 'PBA01');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', false);
select pg_temp.expect_error($$insert into questions (title, stem, teaching_point, created_by, updated_by, status) values ('botdirect', 's', 'tp', '00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e1', 'draft')$$, 'PBA01');
reset role;
select set_config('request.jwt.claim.sub', '', false);

-- every non-legacy snapshot is a full format-2 snapshot
select pg_temp.ok((select bool_and((question_data->>'snapshot_format')::int = 2 and question_data ? 'tags' and question_data ? 'reviewer_id') from question_versions where not legacy), 'all new snapshots full');
select pg_temp.ok((select count(*) from question_versions where legacy) = 2, 'legacy rows untouched');

\echo ALL TESTS PASSED
