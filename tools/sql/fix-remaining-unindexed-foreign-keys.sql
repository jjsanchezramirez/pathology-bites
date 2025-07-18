-- Fix Remaining Unindexed Foreign Keys
-- Addresses the remaining Supabase linter warnings for foreign keys without covering indexes
-- Date: 2025-01-07

BEGIN;

-- 1. Add index for question_tags.tag_id foreign key
CREATE INDEX IF NOT EXISTS idx_question_tags_tag_id ON question_tags(tag_id);

-- 2. Add index for question_versions.changed_by foreign key
-- Note: The constraint name suggests this might be "question_versions_new_changed_by_fkey"
-- but we'll create the index for the changed_by column
CREATE INDEX IF NOT EXISTS idx_question_versions_changed_by ON question_versions(changed_by);

-- 3. Add index for questions.category_id foreign key
CREATE INDEX IF NOT EXISTS idx_questions_category_id ON questions(category_id);

-- 4. Add index for quiz_attempts.selected_answer_id foreign key
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_selected_answer_id ON quiz_attempts(selected_answer_id);

-- 5. Add index for sets.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_sets_created_by ON sets(created_by);

-- 6. Create some composite indexes for common query patterns involving these foreign keys

-- Question tags by question (for tag management)
CREATE INDEX IF NOT EXISTS idx_question_tags_question_id ON question_tags(question_id);

-- Questions by category and status (for category-based filtering)
CREATE INDEX IF NOT EXISTS idx_questions_category_status ON questions(category_id, status);

-- Quiz attempts by session and question (for quiz analytics)
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_question_id ON quiz_attempts(quiz_session_id, question_id);

-- Question versions by question and date (for version history)
CREATE INDEX IF NOT EXISTS idx_question_versions_question_date ON question_versions(question_id, created_at DESC);

-- Sets by creator and date (for user's created sets)
CREATE INDEX IF NOT EXISTS idx_sets_creator_date ON sets(created_by, created_at DESC);

-- 7. Verify all new foreign key indexes are created
DO $$
DECLARE
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  index_exists BOOLEAN;
BEGIN
  -- Check each required index
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_question_tags_tag_id'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_question_tags_tag_id');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_question_versions_changed_by'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_question_versions_changed_by');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_questions_category_id'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_questions_category_id');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_quiz_attempts_selected_answer_id'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_quiz_attempts_selected_answer_id');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_sets_created_by'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_sets_created_by');
  END IF;

  -- Report results
  IF array_length(missing_indexes, 1) > 0 THEN
    RAISE EXCEPTION 'Missing indexes: %', array_to_string(missing_indexes, ', ');
  ELSE
    RAISE NOTICE 'All remaining foreign key indexes created successfully';
  END IF;
END $$;

COMMIT;
