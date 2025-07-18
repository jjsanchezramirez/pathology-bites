-- Optimize Quiz Attempts Performance for Scale
-- This migration addresses the critical performance bottleneck in the quiz options API
-- by denormalizing category_id into quiz_attempts table and adding optimized indexes

BEGIN;

-- Step 1: Add category_id and user_id columns to quiz_attempts table
-- This eliminates expensive JOINs with questions and quiz_sessions tables
ALTER TABLE quiz_attempts
ADD COLUMN IF NOT EXISTS category_id UUID,
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Step 2: Populate category_id and user_id for existing records
-- This backfills the denormalized data
UPDATE quiz_attempts
SET
    category_id = q.category_id,
    user_id = qs.user_id
FROM questions q, quiz_sessions qs
WHERE quiz_attempts.question_id = q.id
AND quiz_attempts.quiz_session_id = qs.id
AND (quiz_attempts.category_id IS NULL OR quiz_attempts.user_id IS NULL);

-- Step 3: Add foreign key constraints
ALTER TABLE quiz_attempts
ADD CONSTRAINT quiz_attempts_category_id_fkey
FOREIGN KEY (category_id) REFERENCES categories(id);

ALTER TABLE quiz_attempts
ADD CONSTRAINT quiz_attempts_user_id_fkey
FOREIGN KEY (user_id) REFERENCES users(id);

-- Step 4: Create optimized indexes for the new query patterns

-- Index for user statistics queries (replaces expensive JOIN)
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_category_stats
ON quiz_attempts(user_id, category_id, is_correct)
WHERE user_id IS NOT NULL;

-- Covering index for quiz session queries
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_session_covering
ON quiz_attempts(quiz_session_id, question_id, is_correct, category_id);

-- Index for user activity by category (for analytics)
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_category_date
ON quiz_attempts(user_id, category_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Step 5: Create materialized view for user category statistics
-- This pre-calculates expensive aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS user_category_stats AS
SELECT 
    qa.user_id,
    qa.category_id,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE qa.is_correct = true) as correct_attempts,
    COUNT(*) FILTER (WHERE qa.is_correct = false) as incorrect_attempts,
    MAX(qa.created_at) as last_attempt_at,
    -- Calculate unique questions attempted
    COUNT(DISTINCT qa.question_id) as unique_questions_attempted
FROM quiz_attempts qa
WHERE qa.user_id IS NOT NULL
GROUP BY qa.user_id, qa.category_id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_category_stats_pk
ON user_category_stats(user_id, category_id);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_category_stats_user
ON user_category_stats(user_id);

-- Step 6: Create function to refresh user stats efficiently
CREATE OR REPLACE FUNCTION refresh_user_category_stats(p_user_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
    IF p_user_id IS NOT NULL THEN
        -- Refresh stats for specific user
        DELETE FROM user_category_stats WHERE user_id = p_user_id;
        
        INSERT INTO user_category_stats
        SELECT 
            qa.user_id,
            qa.category_id,
            COUNT(*) as total_attempts,
            COUNT(*) FILTER (WHERE qa.is_correct = true) as correct_attempts,
            COUNT(*) FILTER (WHERE qa.is_correct = false) as incorrect_attempts,
            MAX(qa.created_at) as last_attempt_at,
            COUNT(DISTINCT qa.question_id) as unique_questions_attempted
        FROM quiz_attempts qa
        WHERE qa.user_id = p_user_id
        GROUP BY qa.user_id, qa.category_id;
    ELSE
        -- Refresh all stats
        REFRESH MATERIALIZED VIEW CONCURRENTLY user_category_stats;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger to maintain category_id and user_id consistency
-- This ensures new quiz_attempts always have category_id and user_id populated
CREATE OR REPLACE FUNCTION set_quiz_attempt_denormalized_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Set category_id from the question if not already set
    IF NEW.category_id IS NULL THEN
        SELECT category_id INTO NEW.category_id
        FROM questions
        WHERE id = NEW.question_id;
    END IF;

    -- Set user_id from the quiz session if not already set
    IF NEW.user_id IS NULL THEN
        SELECT user_id INTO NEW.user_id
        FROM quiz_sessions
        WHERE id = NEW.quiz_session_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT operations
DROP TRIGGER IF EXISTS trigger_set_quiz_attempt_denormalized_fields ON quiz_attempts;
CREATE TRIGGER trigger_set_quiz_attempt_denormalized_fields
    BEFORE INSERT ON quiz_attempts
    FOR EACH ROW
    EXECUTE FUNCTION set_quiz_attempt_denormalized_fields();

-- Step 8: Create function to update user stats after quiz completion
CREATE OR REPLACE FUNCTION update_user_stats_after_quiz(p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Refresh stats for the specific user
    PERFORM refresh_user_category_stats(p_user_id);
END;
$$ LANGUAGE plpgsql;

-- Step 9: Add comments for documentation
COMMENT ON COLUMN quiz_attempts.category_id IS
'Denormalized category_id from questions table for performance optimization';

COMMENT ON COLUMN quiz_attempts.user_id IS
'Denormalized user_id from quiz_sessions table for performance optimization';

COMMENT ON MATERIALIZED VIEW user_category_stats IS 
'Pre-calculated user statistics by category to optimize quiz options API';

COMMENT ON FUNCTION refresh_user_category_stats(UUID) IS 
'Efficiently refresh user category statistics, optionally for a specific user';

COMMENT ON FUNCTION update_user_stats_after_quiz(UUID) IS 
'Update user statistics after quiz completion for real-time accuracy';

-- Step 10: Create indexes for user_favorites optimization
-- These support the favorites query in the quiz options API
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_question
ON user_favorites(user_id, question_id);

-- Covering index for favorites with category info
CREATE INDEX IF NOT EXISTS idx_user_favorites_covering
ON user_favorites(user_id) 
INCLUDE (question_id);

COMMIT;

-- Step 11: Initial population of materialized view
-- Run this after the transaction commits
-- REFRESH MATERIALIZED VIEW user_category_stats;
