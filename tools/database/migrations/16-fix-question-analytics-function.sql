-- Migration: Fix question analytics function column mismatches
-- The calculate_question_analytics function was referencing non-existent columns
-- causing question review submissions to fail with database errors.

BEGIN;

-- Fix the calculate_question_analytics function with correct column names and required fields
CREATE OR REPLACE FUNCTION public.calculate_question_analytics(target_question_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flag_count INTEGER;
  review_count INTEGER;
  attempt_count INTEGER;
  correct_count INTEGER;
BEGIN
  -- Calculate flag count
  SELECT COUNT(*) INTO flag_count
  FROM question_flags
  WHERE question_id = target_question_id;
  
  -- Calculate review count
  SELECT COUNT(*) INTO review_count
  FROM question_reviews
  WHERE question_id = target_question_id;
  
  -- Calculate attempt statistics (if quiz_attempts table exists)
  SELECT 
    COALESCE(COUNT(*), 0),
    COALESCE(COUNT(*) FILTER (WHERE is_correct = true), 0)
  INTO attempt_count, correct_count
  FROM quiz_attempts 
  WHERE question_id = target_question_id;
  
  -- Insert or update analytics with all required fields
  INSERT INTO question_analytics (
    question_id, 
    total_attempts,
    correct_attempts,
    flag_count, 
    review_count, 
    last_calculated_at, 
    updated_at
  ) VALUES (
    target_question_id, 
    attempt_count,
    correct_count,
    flag_count, 
    review_count, 
    NOW(), 
    NOW()
  )
  ON CONFLICT (question_id) DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    correct_attempts = EXCLUDED.correct_attempts,
    flag_count = EXCLUDED.flag_count,
    review_count = EXCLUDED.review_count,
    last_calculated_at = EXCLUDED.last_calculated_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- Verify the function was updated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'calculate_question_analytics'
  ) THEN
    RAISE NOTICE 'SUCCESS: calculate_question_analytics function updated successfully';
  ELSE
    RAISE EXCEPTION 'FAILED: calculate_question_analytics function not found';
  END IF;
END $$;

COMMIT;

-- Summary:
-- Fixed column name mismatches:
-- - 'rating' column (removed - doesn't exist)
-- - 'last_activity' -> 'last_calculated_at' 
-- - Added required NOT NULL fields: total_attempts, correct_attempts
-- 
-- This resolves the "column does not exist" errors when creating question reviews.
