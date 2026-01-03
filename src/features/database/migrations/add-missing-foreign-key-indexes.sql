-- ============================================================================
-- ADD MISSING FOREIGN KEY INDEXES
-- Date: 2026-01-03
-- Purpose: Add indexes to foreign key columns for better JOIN performance
-- Issue: INFO-level warnings from Supabase linter (9 unindexed foreign keys)
-- ============================================================================

-- These indexes improve performance when:
-- 1. Joining tables on foreign key relationships
-- 2. Deleting parent records (CASCADE operations)
-- 3. Updating parent primary keys (rare but possible)
-- 4. Enforcing referential integrity checks

-- ============================================================================
-- TABLE: learning_modules
-- ============================================================================

-- Add index for reviewed_by foreign key
CREATE INDEX IF NOT EXISTS idx_learning_modules_reviewed_by 
ON public.learning_modules(reviewed_by);

COMMENT ON INDEX idx_learning_modules_reviewed_by IS 
'Improves JOIN performance with users table and CASCADE delete operations';

-- ============================================================================
-- TABLE: learning_path_modules
-- ============================================================================

-- Add index for learning_path_id foreign key
CREATE INDEX IF NOT EXISTS idx_learning_path_modules_learning_path_id 
ON public.learning_path_modules(learning_path_id);

COMMENT ON INDEX idx_learning_path_modules_learning_path_id IS 
'Improves JOIN performance with learning_paths table and CASCADE operations';

-- ============================================================================
-- TABLE: learning_paths
-- ============================================================================

-- Add index for thumbnail_image_id foreign key
CREATE INDEX IF NOT EXISTS idx_learning_paths_thumbnail_image_id 
ON public.learning_paths(thumbnail_image_id);

COMMENT ON INDEX idx_learning_paths_thumbnail_image_id IS 
'Improves JOIN performance with images table';

-- ============================================================================
-- TABLE: module_attempts
-- ============================================================================

-- Add index for learning_path_id foreign key
CREATE INDEX IF NOT EXISTS idx_module_attempts_learning_path_id 
ON public.module_attempts(learning_path_id);

COMMENT ON INDEX idx_module_attempts_learning_path_id IS 
'Improves JOIN performance with learning_paths table';

-- ============================================================================
-- TABLE: module_sessions
-- ============================================================================

-- Add index for learning_path_id foreign key
CREATE INDEX IF NOT EXISTS idx_module_sessions_learning_path_id 
ON public.module_sessions(learning_path_id);

COMMENT ON INDEX idx_module_sessions_learning_path_id IS 
'Improves JOIN performance with learning_paths table';

-- ============================================================================
-- TABLE: question_versions
-- ============================================================================

-- Add index for question_id foreign key (referenced as new_question_id in constraint)
CREATE INDEX IF NOT EXISTS idx_question_versions_question_id 
ON public.question_versions(question_id);

COMMENT ON INDEX idx_question_versions_question_id IS 
'Improves JOIN performance with questions table and version history queries';

-- ============================================================================
-- TABLE: questions
-- ============================================================================

-- Add index for category_id foreign key
CREATE INDEX IF NOT EXISTS idx_questions_category_id 
ON public.questions(category_id);

COMMENT ON INDEX idx_questions_category_id IS 
'Improves JOIN performance with categories table and category-based queries';

-- ============================================================================
-- TABLE: user_learning
-- ============================================================================

-- Add index for learning_path_id foreign key
CREATE INDEX IF NOT EXISTS idx_user_learning_learning_path_id 
ON public.user_learning(learning_path_id);

COMMENT ON INDEX idx_user_learning_learning_path_id IS 
'Improves JOIN performance with learning_paths table';

-- Add index for current_module_id foreign key
CREATE INDEX IF NOT EXISTS idx_user_learning_current_module_id 
ON public.user_learning(current_module_id);

COMMENT ON INDEX idx_user_learning_current_module_id IS 
'Improves JOIN performance with learning_modules table for current module lookups';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this query to verify all foreign keys now have covering indexes:
-- 
-- SELECT 
--   tc.table_name,
--   tc.constraint_name,
--   kcu.column_name,
--   CASE 
--     WHEN i.indexname IS NOT NULL THEN 'INDEXED ✓'
--     ELSE 'MISSING INDEX ✗'
--   END as index_status
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- LEFT JOIN pg_indexes i
--   ON i.tablename = tc.table_name
--   AND i.indexdef LIKE '%' || kcu.column_name || '%'
-- WHERE tc.constraint_type = 'FOREIGN KEY'
-- AND tc.table_schema = 'public'
-- ORDER BY tc.table_name, tc.constraint_name;

