-- Simplify Question Review Workflow Migration
-- This migration simplifies the question review workflow by:
-- 1. Reducing question statuses from 7 to 4
-- 2. Adding flag metadata to questions table
-- 3. Simplifying flag statuses from 4 to 2
-- 4. Updating related views and functions

BEGIN;

-- Step 1: Add flag metadata columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS flag_count INTEGER DEFAULT 0;

-- Step 2: Update question status constraint to simplified statuses
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check 
CHECK (status IN ('draft', 'under_review', 'published', 'rejected'));

-- Step 3: Migrate existing question statuses to simplified ones
UPDATE questions 
SET status = CASE 
  WHEN status IN ('pending_minor_edits', 'pending_major_edits') THEN 'under_review'
  WHEN status = 'flagged' THEN 'published'
  WHEN status = 'archived' THEN 'rejected'
  ELSE status 
END;

-- Step 4: Update questions with flag information
UPDATE questions 
SET 
  is_flagged = TRUE,
  flag_count = (
    SELECT COUNT(*) 
    FROM question_flags 
    WHERE question_id = questions.id 
    AND status = 'pending'
  )
WHERE id IN (
  SELECT DISTINCT question_id 
  FROM question_flags 
  WHERE status = 'pending'
);

-- Step 5: Simplify question_flags status constraint
ALTER TABLE question_flags DROP CONSTRAINT IF EXISTS question_flags_status_check;
ALTER TABLE question_flags ADD CONSTRAINT question_flags_status_check 
CHECK (status IN ('open', 'closed'));

-- Step 6: Migrate existing flag statuses to simplified ones
UPDATE question_flags 
SET status = CASE 
  WHEN status IN ('resolved', 'dismissed') THEN 'closed'
  WHEN status IN ('pending', 'under_review') THEN 'open'
  ELSE 'open'
END;

-- Step 7: Add resolution_type column to track how flags were closed
ALTER TABLE question_flags ADD COLUMN IF NOT EXISTS resolution_type TEXT 
CHECK (resolution_type IN ('fixed', 'dismissed'));

-- Step 8: Set resolution_type for existing closed flags
UPDATE question_flags 
SET resolution_type = CASE 
  WHEN resolution_notes IS NOT NULL AND resolution_notes != '' THEN 'fixed'
  ELSE 'dismissed'
END
WHERE status = 'closed' AND resolution_type IS NULL;

-- Step 9: Create function to update question flag metadata
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

-- Step 10: Create trigger to automatically update flag metadata
DROP TRIGGER IF EXISTS question_flags_metadata_trigger ON question_flags;
CREATE TRIGGER question_flags_metadata_trigger
  AFTER INSERT OR UPDATE OR DELETE ON question_flags
  FOR EACH ROW
  EXECUTE FUNCTION update_question_flag_metadata();

-- Step 11: Update review action constraint to simplified actions
ALTER TABLE question_reviews DROP CONSTRAINT IF EXISTS question_reviews_action_check;
ALTER TABLE question_reviews ADD CONSTRAINT question_reviews_action_check 
CHECK (action IN ('approve', 'reject'));

-- Step 12: Migrate existing review actions to simplified ones
UPDATE question_reviews 
SET action = CASE 
  WHEN action IN ('approve_as_is', 'approve_with_minor_edits') THEN 'approve'
  WHEN action IN ('request_major_revisions', 'reject') THEN 'reject'
  ELSE 'reject'
END;

-- Step 13: Create unified review queue view
CREATE OR REPLACE VIEW v_review_queue AS
SELECT
  q.*,
  u.first_name || ' ' || u.last_name as creator_name,
  u.email as creator_email,
  s.name as question_set_name,
  s.short_form as question_set_short,
  CASE
    WHEN q.status = 'under_review' AND q.is_flagged = FALSE THEN 'new_submission'
    WHEN q.status = 'published' AND q.is_flagged = TRUE THEN 'flagged_question'
    ELSE 'other'
  END as review_type,
  CASE
    WHEN q.is_flagged = TRUE THEN q.flag_count
    ELSE 0
  END as priority_score
FROM questions q
LEFT JOIN users u ON q.created_by = u.id
LEFT JOIN sets s ON q.question_set_id = s.id
WHERE q.status IN ('under_review')
   OR (q.status = 'published' AND q.is_flagged = TRUE)
ORDER BY
  q.is_flagged DESC, -- Flagged questions first
  q.created_at ASC;  -- Older submissions first

-- Step 14: Create creator dashboard view
CREATE OR REPLACE VIEW v_creator_questions AS
SELECT
  q.*,
  s.name as question_set_name,
  s.short_form as question_set_short,
  -- Get latest review feedback for rejected questions
  (SELECT feedback
   FROM question_reviews qr
   WHERE qr.question_id = q.id
   ORDER BY qr.created_at DESC
   LIMIT 1) as latest_feedback,
  -- Get rejection date
  (SELECT qr.created_at
   FROM question_reviews qr
   WHERE qr.question_id = q.id AND qr.action = 'reject'
   ORDER BY qr.created_at DESC
   LIMIT 1) as rejected_at,
  -- Count of times submitted for review
  (SELECT COUNT(*)
   FROM question_reviews qr
   WHERE qr.question_id = q.id) as review_count
FROM questions q
LEFT JOIN sets s ON q.question_set_id = s.id;

-- Step 15: Update flagged questions view for simplified flag status
DROP VIEW IF EXISTS v_flagged_questions;
CREATE VIEW v_flagged_questions AS
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

COMMIT;
