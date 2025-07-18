-- Fix Pending Status References Migration
-- This migration fixes all remaining references to 'pending' status in database views
-- and ensures they use the correct 'open' status instead

BEGIN;

-- Step 1: Update v_flagged_questions view to use 'open' instead of 'pending'
DROP VIEW IF EXISTS v_flagged_questions;
CREATE VIEW v_flagged_questions WITH (security_invoker=on) AS
SELECT
  q.*,
  q.flag_count,
  (SELECT MAX(created_at)
   FROM question_flags qf
   WHERE qf.question_id = q.id AND qf.status = 'open') as latest_flag_date
FROM questions q
WHERE q.is_flagged = TRUE
  AND q.status = 'published'
ORDER BY latest_flag_date DESC;

-- Step 2: Update any other views that might reference 'pending' status
-- Check if v_review_queue exists and update it if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_review_queue') THEN
    -- Drop and recreate v_review_queue with correct flag status
    DROP VIEW IF EXISTS v_review_queue;
    CREATE VIEW v_review_queue WITH (security_invoker=on) AS
    SELECT 
      q.*,
      u.first_name || ' ' || u.last_name as creator_name,
      u.email as creator_email,
      s.name as question_set_name,
      CASE 
        WHEN q.status IN ('under_review', 'pending_major_edits', 'pending_minor_edits') THEN 'new_submission'
        WHEN q.is_flagged = TRUE THEN 'flagged_question'
        ELSE 'other'
      END as review_type,
      CASE 
        WHEN q.is_flagged = TRUE THEN 100
        WHEN q.status = 'under_review' THEN 80
        WHEN q.status = 'pending_major_edits' THEN 60
        WHEN q.status = 'pending_minor_edits' THEN 40
        ELSE 20
      END as priority_score,
      q.flag_count,
      (SELECT MAX(created_at)
       FROM question_flags qf
       WHERE qf.question_id = q.id AND qf.status = 'open') as latest_flag_date
    FROM questions q
    LEFT JOIN users u ON q.created_by = u.id
    LEFT JOIN sets s ON q.question_set_id = s.id
    WHERE q.status IN ('under_review', 'pending_major_edits', 'pending_minor_edits', 'published')
      AND (q.status != 'published' OR q.is_flagged = TRUE);
  END IF;
END $$;

-- Step 3: Update the flag metadata trigger function to ensure it uses 'open' status
CREATE OR REPLACE FUNCTION update_question_flag_metadata()
RETURNS TRIGGER AS $$
BEGIN
  -- Update flag count and is_flagged status for the question
  UPDATE questions 
  SET 
    flag_count = (
      SELECT COUNT(*) 
      FROM question_flags 
      WHERE question_id = COALESCE(NEW.question_id, OLD.question_id)
      AND status = 'open'
    ),
    is_flagged = EXISTS (
      SELECT 1 
      FROM question_flags 
      WHERE question_id = COALESCE(NEW.question_id, OLD.question_id)
      AND status = 'open'
    )
  WHERE id = COALESCE(NEW.question_id, OLD.question_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS trigger_update_question_flag_metadata ON question_flags;
CREATE TRIGGER trigger_update_question_flag_metadata
  AFTER INSERT OR UPDATE OR DELETE ON question_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_question_flag_metadata();

-- Step 5: Update any existing questions that might have incorrect flag metadata
UPDATE questions 
SET 
  flag_count = (
    SELECT COUNT(*) 
    FROM question_flags 
    WHERE question_id = questions.id 
    AND status = 'open'
  ),
  is_flagged = EXISTS (
    SELECT 1 
    FROM question_flags 
    WHERE question_id = questions.id 
    AND status = 'open'
  );

COMMIT;
