-- Migration: Fix question_reviews RLS policy to allow reviews for draft questions
-- The current policy only allows reviews for questions with status 'under_review', 
-- 'pending_major_edits', or 'pending_minor_edits', but reviewers should also be able 
-- to review questions in 'draft' status.

BEGIN;

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "question_reviews_reviewer_insert" ON question_reviews;

-- Create a new policy that allows reviews for draft questions as well
CREATE POLICY "question_reviews_reviewer_insert" ON question_reviews
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
      AND q.status IN ('draft', 'under_review', 'pending_major_edits', 'pending_minor_edits')
    )
  );

-- Verify the policy was updated
DO $$
DECLARE
  policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'question_reviews' 
    AND schemaname = 'public'
    AND policyname = 'question_reviews_reviewer_insert'
  ) INTO policy_exists;
  
  IF policy_exists THEN
    RAISE NOTICE 'SUCCESS: question_reviews_reviewer_insert policy updated successfully';
  ELSE
    RAISE EXCEPTION 'FAILED: question_reviews_reviewer_insert policy not found';
  END IF;
END $$;

COMMIT;

-- Summary:
-- This migration fixes the RLS policy for question_reviews to allow reviewers
-- to create reviews for questions in 'draft' status, which is the typical
-- workflow where questions are submitted as drafts and then reviewed.
