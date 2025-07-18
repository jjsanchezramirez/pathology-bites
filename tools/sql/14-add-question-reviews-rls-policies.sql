-- Migration: Add RLS Policies for question_reviews table
-- This migration adds Row Level Security policies for the question_reviews table
-- Addresses missing RLS policies that prevent reviewers from creating review records

BEGIN;

-- First, check if RLS is enabled on question_reviews table
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'question_reviews' 
    AND schemaname = 'public' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE question_reviews ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on question_reviews table';
  ELSE
    RAISE NOTICE 'RLS already enabled on question_reviews table';
  END IF;
END $$;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "question_reviews_admin_all" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_reviewer_insert" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_reviewer_select" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_creator_select_own" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_public_select_published" ON question_reviews;

-- 1. Admins can manage all question reviews
CREATE POLICY "question_reviews_admin_all" ON question_reviews
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 2. Reviewers can insert reviews for questions under review
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
      AND q.status IN ('under_review', 'pending_major_edits', 'pending_minor_edits')
    )
  );

-- 3. Reviewers can view all reviews (for review history and context)
CREATE POLICY "question_reviews_reviewer_select" ON question_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'reviewer')
    )
  );

-- 4. Creators can view reviews of their own questions
CREATE POLICY "question_reviews_creator_select_own" ON question_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'creator'
    )
    AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_id
      AND q.created_by = auth.uid()
    )
  );

-- 5. Public can view reviews of published questions (for transparency)
CREATE POLICY "question_reviews_public_select_published" ON question_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_id
      AND q.status = 'published'
    )
  );

-- Create indexes for performance (if they don't exist)
CREATE INDEX IF NOT EXISTS idx_question_reviews_question_id ON question_reviews(question_id);
CREATE INDEX IF NOT EXISTS idx_question_reviews_reviewer_id ON question_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_question_reviews_created_at ON question_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_reviews_action ON question_reviews(action);

-- Verify the policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'question_reviews' 
  AND schemaname = 'public';
  
  IF policy_count >= 5 THEN
    RAISE NOTICE 'SUCCESS: % RLS policies created for question_reviews table', policy_count;
  ELSE
    RAISE EXCEPTION 'FAILED: Only % policies found, expected at least 5', policy_count;
  END IF;
END $$;

COMMIT;

-- Summary of RLS Policies for question_reviews:
-- 1. Admins have full access to all review records
-- 2. Reviewers can insert reviews for questions under review (where they are the reviewer)
-- 3. Reviewers can view all reviews for context and history
-- 4. Creators can view reviews of their own questions
-- 5. Public can view reviews of published questions for transparency
-- 
-- This ensures:
-- - Review workflow integrity: Only authorized reviewers can create reviews
-- - Proper access control: Users see only what they should see
-- - Transparency: Published question reviews are visible to all
-- - Admin oversight: Admins can manage all review data
-- - Performance: Proper indexes for common query patterns
