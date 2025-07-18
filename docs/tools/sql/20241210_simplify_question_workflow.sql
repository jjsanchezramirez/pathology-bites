-- Simplify Question Review Workflow Migration
-- This migration simplifies the question review workflow by:
-- 1. Reducing question statuses from 7 to 4 (draft, pending, approved, flagged)
-- 2. Migrating existing statuses to new simplified system
-- 3. Updating related views and functions
-- 4. Maintaining backward compatibility during transition

BEGIN;

-- Step 1: Create new simplified status constraint
-- First, drop the existing constraint
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;

-- Add new simplified constraint with 4 statuses
ALTER TABLE questions ADD CONSTRAINT questions_status_check 
CHECK (status IN ('draft', 'pending', 'approved', 'flagged'));

-- Step 2: Migrate existing question statuses to simplified system
-- Map complex statuses to simplified ones:
-- draft -> draft (no change)
-- under_review -> pending
-- pending_major_edits -> pending  
-- pending_minor_edits -> pending
-- published -> approved
-- rejected -> draft (with note in change_summary)
-- archived -> draft (with note in change_summary)

UPDATE questions 
SET status = CASE 
  WHEN status = 'draft' THEN 'draft'
  WHEN status IN ('under_review', 'pending_major_edits', 'pending_minor_edits') THEN 'pending'
  WHEN status = 'published' THEN 'approved'
  WHEN status = 'rejected' THEN 'draft'
  WHEN status = 'archived' THEN 'draft'
  ELSE 'draft' -- fallback
END,
change_summary = CASE 
  WHEN status = 'rejected' AND (change_summary IS NULL OR change_summary = '') 
    THEN 'Previously rejected - needs revision'
  WHEN status = 'archived' AND (change_summary IS NULL OR change_summary = '') 
    THEN 'Previously archived - restored to draft'
  ELSE change_summary
END,
updated_at = NOW()
WHERE status NOT IN ('draft', 'pending', 'approved', 'flagged');

-- Step 3: Handle flagged questions
-- Questions that are published but have open flags should be marked as 'flagged'
UPDATE questions 
SET status = 'flagged'
WHERE status = 'approved' 
AND id IN (
  SELECT DISTINCT question_id 
  FROM question_flags 
  WHERE status = 'open'
);

-- Step 4: Update question_reviews table to use simplified actions
-- Add constraint for simplified review actions
ALTER TABLE question_reviews DROP CONSTRAINT IF EXISTS question_reviews_action_check;
ALTER TABLE question_reviews ADD CONSTRAINT question_reviews_action_check 
CHECK (action IN ('approve', 'request_changes', 'reject'));

-- Step 5: Migrate existing review actions to simplified system
UPDATE question_reviews 
SET action = CASE 
  WHEN action IN ('approve', 'approved') THEN 'approve'
  WHEN action IN ('pending_major_edits', 'pending_minor_edits', 'request_changes') THEN 'request_changes'
  WHEN action IN ('reject', 'rejected') THEN 'reject'
  ELSE 'request_changes' -- fallback
END
WHERE action NOT IN ('approve', 'request_changes', 'reject');

-- Step 6: Create simplified review queue view
CREATE OR REPLACE VIEW v_simplified_review_queue AS
SELECT 
  q.*,
  u.first_name || ' ' || u.last_name as creator_name,
  u.email as creator_email,
  s.name as question_set_name,
  CASE 
    WHEN q.status = 'pending' THEN 'new_submission'
    WHEN q.status = 'flagged' THEN 'flagged_question'
    ELSE 'other'
  END as review_type,
  CASE 
    WHEN q.status = 'flagged' THEN 100
    WHEN q.status = 'pending' AND q.created_at > NOW() - INTERVAL '24 hours' THEN 80
    WHEN q.status = 'pending' THEN 60
    ELSE 0
  END as priority_score,
  (SELECT COUNT(*) FROM question_flags qf WHERE qf.question_id = q.id AND qf.status = 'open') as flag_count,
  (SELECT MAX(created_at) FROM question_flags qf WHERE qf.question_id = q.id AND qf.status = 'open') as latest_flag_date
FROM questions q
LEFT JOIN users u ON q.created_by = u.id
LEFT JOIN sets s ON q.question_set_id = s.id
WHERE q.status IN ('pending', 'flagged')
ORDER BY priority_score DESC, q.created_at ASC;

-- Step 7: Create function for simplified question status transitions
CREATE OR REPLACE FUNCTION update_question_status_simplified(
  question_id_param UUID,
  new_status_param TEXT,
  reviewer_id_param UUID DEFAULT NULL,
  feedback_param TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status TEXT;
  valid_transition BOOLEAN := FALSE;
BEGIN
  -- Get current status
  SELECT status INTO current_status 
  FROM questions 
  WHERE id = question_id_param;
  
  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Question not found';
  END IF;
  
  -- Validate status transitions
  CASE current_status
    WHEN 'draft' THEN
      valid_transition := new_status_param IN ('pending');
    WHEN 'pending' THEN
      valid_transition := new_status_param IN ('approved', 'draft');
    WHEN 'approved' THEN
      valid_transition := new_status_param IN ('flagged', 'draft');
    WHEN 'flagged' THEN
      valid_transition := new_status_param IN ('approved', 'draft');
  END CASE;
  
  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Invalid status transition from % to %', current_status, new_status_param;
  END IF;
  
  -- Update question status
  UPDATE questions 
  SET 
    status = new_status_param,
    updated_at = NOW(),
    change_summary = CASE 
      WHEN feedback_param IS NOT NULL THEN feedback_param
      ELSE change_summary
    END
  WHERE id = question_id_param;
  
  -- Create version snapshot if transitioning to approved
  IF new_status_param = 'approved' AND current_status = 'pending' THEN
    INSERT INTO question_versions (
      question_id,
      version_major,
      version_minor, 
      version_patch,
      version_string,
      question_data,
      update_type,
      change_summary,
      changed_by
    )
    SELECT 
      q.id,
      COALESCE(q.version_major, 1),
      COALESCE(q.version_minor, 0),
      COALESCE(q.version_patch, 0),
      COALESCE(q.version_string, '1.0.0'),
      jsonb_build_object(
        'title', q.title,
        'stem', q.stem,
        'difficulty', q.difficulty,
        'teaching_point', q.teaching_point,
        'question_references', q.question_references,
        'options', (SELECT jsonb_agg(jsonb_build_object(
          'text', qo.text,
          'is_correct', qo.is_correct,
          'explanation', qo.explanation,
          'order_index', qo.order_index
        )) FROM question_options qo WHERE qo.question_id = q.id),
        'images', (SELECT jsonb_agg(jsonb_build_object(
          'image_id', qi.image_id,
          'order_index', qi.order_index
        )) FROM question_images qi WHERE qi.question_id = q.id)
      ),
      'minor',
      feedback_param,
      reviewer_id_param
    FROM questions q
    WHERE q.id = question_id_param;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Step 8: Update RLS policies for simplified workflow
-- Drop existing policies that reference old statuses
DROP POLICY IF EXISTS "question_reviews_reviewer_insert" ON question_reviews;

-- Create new policy for simplified workflow
CREATE POLICY "question_reviews_reviewer_insert_simplified" ON question_reviews
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'reviewer')
    )
    AND reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_id
      AND q.status IN ('pending', 'flagged')
    )
  );

-- Step 9: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_questions_status_simplified ON questions(status) WHERE status IN ('pending', 'flagged');
CREATE INDEX IF NOT EXISTS idx_questions_review_queue ON questions(status, created_at) WHERE status IN ('pending', 'flagged');

COMMIT;
