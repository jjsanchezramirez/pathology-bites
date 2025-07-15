-- Migration: Add Global Timer Support to Quiz Sessions
-- Date: 2024-12-15
-- Description: Add fields to support global timer functionality instead of per-question timer
-- This enables a single timer for the entire quiz duration

BEGIN;

-- Step 1: Add global timer fields to quiz_sessions table
ALTER TABLE quiz_sessions 
ADD COLUMN IF NOT EXISTS total_time_limit INTEGER, -- Total time allowed for entire quiz in seconds
ADD COLUMN IF NOT EXISTS time_remaining INTEGER,   -- Current time remaining in seconds
ADD COLUMN IF NOT EXISTS quiz_started_at TIMESTAMP WITH TIME ZONE; -- When the quiz timer actually started

-- Step 2: Add comments for documentation
COMMENT ON COLUMN quiz_sessions.total_time_limit IS 
'Total time allowed for the entire quiz in seconds (global timer)';

COMMENT ON COLUMN quiz_sessions.time_remaining IS 
'Current time remaining for the entire quiz in seconds';

COMMENT ON COLUMN quiz_sessions.quiz_started_at IS 
'Timestamp when the quiz timer actually started (for pause/resume functionality)';

-- Step 3: Create index for performance on time-related queries
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_time_remaining 
ON quiz_sessions(time_remaining) 
WHERE time_remaining IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_started_at 
ON quiz_sessions(quiz_started_at) 
WHERE quiz_started_at IS NOT NULL;

-- Step 4: Update existing timed quiz sessions to use global timer
-- Convert existing sessions that have timePerQuestion in config to global timer
UPDATE quiz_sessions 
SET 
  total_time_limit = (config->>'timePerQuestion')::integer * total_questions,
  time_remaining = (config->>'timePerQuestion')::integer * total_questions
WHERE 
  config->>'timing' = 'timed' 
  AND config->>'timePerQuestion' IS NOT NULL 
  AND total_time_limit IS NULL;

-- Step 5: Set quiz_started_at for in-progress sessions
UPDATE quiz_sessions 
SET quiz_started_at = started_at 
WHERE status = 'in_progress' AND quiz_started_at IS NULL AND started_at IS NOT NULL;

COMMIT;
