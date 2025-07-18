-- Migration: Fix RLS Performance Issues
-- This migration optimizes RLS policies by wrapping auth functions in subqueries
-- to prevent re-evaluation for each row, addressing Supabase linter warnings

BEGIN;

-- ============================================================================
-- 1. CATEGORIES TABLE - Fix auth.role() performance issue
-- ============================================================================

-- Drop and recreate the problematic policy
DROP POLICY IF EXISTS "Authenticated users can read categories" ON categories;

CREATE POLICY "Authenticated users can read categories" ON categories
  FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated'::text);

-- ============================================================================
-- 2. QUESTIONS TABLE - Fix auth.role() performance issue
-- ============================================================================

-- Drop and recreate the problematic policy
DROP POLICY IF EXISTS "Authenticated users can read approved questions" ON questions;

CREATE POLICY "Authenticated users can read approved questions" ON questions
  FOR SELECT
  USING (
    (SELECT auth.role()) = 'authenticated'::text 
    AND status::text = ANY (ARRAY['published'::character varying, 'approved'::character varying]::text[])
  );

-- ============================================================================
-- 3. USER_SETTINGS TABLE - Fix auth.uid() performance issue
-- ============================================================================

-- Drop and recreate the problematic policy
DROP POLICY IF EXISTS "user_settings_own_data" ON user_settings;

CREATE POLICY "user_settings_own_data" ON user_settings
  FOR ALL
  USING (user_id = (SELECT auth.uid()));

-- ============================================================================
-- 4. USER_FAVORITES TABLE - Fix auth.uid() performance issues
-- ============================================================================

-- Drop and recreate all problematic policies
DROP POLICY IF EXISTS "Users can view own favorites" ON user_favorites;
DROP POLICY IF EXISTS "Users can add own favorites" ON user_favorites;
DROP POLICY IF EXISTS "Users can remove own favorites" ON user_favorites;
DROP POLICY IF EXISTS "Admins can view all favorites" ON user_favorites;
DROP POLICY IF EXISTS "Admins can manage all favorites" ON user_favorites;

-- Recreate with optimized auth function calls
CREATE POLICY "Users can view own favorites" ON user_favorites
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can add own favorites" ON user_favorites
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can remove own favorites" ON user_favorites
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins can view all favorites" ON user_favorites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all favorites" ON user_favorites
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- 5. QUESTION_REVIEWS TABLE - Fix auth.uid() performance issues
-- ============================================================================

-- Drop and recreate all problematic policies
DROP POLICY IF EXISTS "question_reviews_admin_all" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_reviewer_select" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_creator_select_own" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_reviewer_insert_simplified" ON question_reviews;

-- Recreate with optimized auth function calls
CREATE POLICY "question_reviews_admin_all" ON question_reviews
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

CREATE POLICY "question_reviews_reviewer_select" ON question_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = ANY (ARRAY['admin'::character varying, 'reviewer'::character varying]::text[])
    )
  );

CREATE POLICY "question_reviews_creator_select_own" ON question_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'creator'
    )
    AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_reviews.question_id
      AND q.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "question_reviews_reviewer_insert_simplified" ON question_reviews
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = ANY (ARRAY['admin'::character varying, 'reviewer'::character varying]::text[])
    )
    AND reviewer_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_reviews.question_id
      AND q.status::text = ANY (ARRAY['pending'::character varying, 'flagged'::character varying]::text[])
    )
  );

-- ============================================================================
-- 6. INQUIRIES TABLE - Fix auth.uid() performance issue
-- ============================================================================

-- Drop and recreate the problematic policy
DROP POLICY IF EXISTS "inquiries_admin_policy" ON inquiries;

CREATE POLICY "inquiries_admin_policy" ON inquiries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

-- ============================================================================
-- 7. FIX MULTIPLE PERMISSIVE POLICIES ISSUE
-- ============================================================================

-- The categories table has multiple permissive policies for authenticated SELECT
-- We need to consolidate them into a single policy

-- Drop the admin policy that overlaps with the authenticated policy
DROP POLICY IF EXISTS "Admin Full Access to Categories Table" ON categories;

-- Create a single consolidated policy for categories SELECT
CREATE POLICY "Categories read access" ON categories
  FOR SELECT
  USING (
    -- Allow authenticated users to read all categories
    (SELECT auth.role()) = 'authenticated'::text
    OR
    -- Allow admins full access (this covers the admin case)
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

-- Create separate admin policies for other operations on categories
CREATE POLICY "Admin can manage categories" ON categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update categories" ON categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete categories" ON categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = (SELECT auth.uid()) 
      AND role = 'admin'
    )
  );

-- Fix the inquiries table multiple permissive policies issue
-- The inquiries table has multiple permissive policies for anon INSERT
-- We already fixed the admin policy above, now we need to ensure no overlap

-- The inquiries_insert_policy allows anyone to insert, which is fine
-- The admin policy we just fixed allows admins to do everything
-- These don't overlap since one is for anon and one is for authenticated admins

-- ============================================================================
-- 8. FIX REMAINING MULTIPLE PERMISSIVE POLICIES ISSUES
-- ============================================================================

-- Fix categories table multiple SELECT policies
-- Drop the duplicate policies
DROP POLICY IF EXISTS "Authenticated users can read categories" ON categories;
DROP POLICY IF EXISTS "Categories read access" ON categories;

-- Create a single consolidated SELECT policy for categories
CREATE POLICY "Categories read access" ON categories
  FOR SELECT
  USING (
    -- Allow authenticated users to read all categories
    (SELECT auth.role()) = 'authenticated'::text
    OR
    -- Allow admins full access (this covers the admin case)
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Fix user_favorites table multiple SELECT policies
-- Drop the existing policies
DROP POLICY IF EXISTS "Admins can view all favorites" ON user_favorites;
DROP POLICY IF EXISTS "Users can view own favorites" ON user_favorites;

-- Create a single consolidated SELECT policy for user_favorites
CREATE POLICY "User favorites read access" ON user_favorites
  FOR SELECT
  USING (
    -- Users can view their own favorites
    user_id = (SELECT auth.uid())
    OR
    -- Admins can view all favorites
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- ============================================================================
-- 9. FIX ADDITIONAL MULTIPLE PERMISSIVE POLICIES ISSUES
-- ============================================================================

-- Fix inquiries table - Multiple INSERT policies
-- Drop the overlapping policies
DROP POLICY IF EXISTS "inquiries_admin_policy" ON inquiries;
DROP POLICY IF EXISTS "inquiries_insert_policy" ON inquiries;

-- Create consolidated policies
-- Allow anyone to insert inquiries (public contact form)
CREATE POLICY "inquiries_public_insert" ON inquiries
  FOR INSERT
  WITH CHECK (true);

-- Admins can do everything else (SELECT, UPDATE, DELETE)
CREATE POLICY "inquiries_admin_manage" ON inquiries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Fix question_options table - Multiple SELECT policies for authenticated
-- Drop the overlapping policies
DROP POLICY IF EXISTS "Admin Full Access to Answer Options Table" ON question_options;
DROP POLICY IF EXISTS "Authenticated users can read answer options for approved questi" ON question_options;

-- Create consolidated SELECT policy
CREATE POLICY "Question options read access" ON question_options
  FOR SELECT
  USING (
    -- Admins can read all question options
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    -- Authenticated users can read options for approved questions
    (
      (SELECT auth.role()) = 'authenticated'::text
      AND EXISTS (
        SELECT 1 FROM questions
        WHERE questions.id = question_options.question_id
        AND questions.status::text = 'approved'::text
      )
    )
  );

-- Create separate admin policies for other operations
CREATE POLICY "Admin can manage question options" ON question_options
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update question options" ON question_options
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete question options" ON question_options
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Fix question_reviews table - Multiple overlapping policies
-- Drop all existing policies
DROP POLICY IF EXISTS "question_reviews_admin_all" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_reviewer_insert_simplified" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_reviewer_select" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_creator_select_own" ON question_reviews;
DROP POLICY IF EXISTS "question_reviews_public_select_published" ON question_reviews;

-- Create consolidated SELECT policy
CREATE POLICY "Question reviews read access" ON question_reviews
  FOR SELECT
  USING (
    -- Admins can view all reviews
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    -- Reviewers can view all reviews
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'reviewer'
    )
    OR
    -- Creators can view reviews of their own questions
    (
      EXISTS (
        SELECT 1 FROM users
        WHERE id = (SELECT auth.uid())
        AND role = 'creator'
      )
      AND EXISTS (
        SELECT 1 FROM questions q
        WHERE q.id = question_reviews.question_id
        AND q.created_by = (SELECT auth.uid())
      )
    )
    OR
    -- Public can view reviews of published questions
    EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_reviews.question_id
      AND q.status::text = 'published'::text
    )
  );

-- Create consolidated INSERT policy
CREATE POLICY "Question reviews insert access" ON question_reviews
  FOR INSERT
  WITH CHECK (
    -- Admins can insert any review
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    -- Reviewers can insert reviews for pending/flagged questions
    (
      EXISTS (
        SELECT 1 FROM users
        WHERE id = (SELECT auth.uid())
        AND role = 'reviewer'
      )
      AND reviewer_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM questions q
        WHERE q.id = question_reviews.question_id
        AND q.status::text = ANY (ARRAY['pending'::character varying, 'flagged'::character varying]::text[])
      )
    )
  );

-- Create admin policies for other operations
CREATE POLICY "Admin can update question reviews" ON question_reviews
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete question reviews" ON question_reviews
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Fix questions table - Multiple SELECT policies
-- Drop overlapping policies
DROP POLICY IF EXISTS "Admin Full Access to Questions Table" ON questions;
DROP POLICY IF EXISTS "Authenticated users can read approved questions" ON questions;
DROP POLICY IF EXISTS "Anonymous users can read published and approved questions" ON questions;

-- Create consolidated SELECT policy
CREATE POLICY "Questions read access" ON questions
  FOR SELECT
  USING (
    -- Admins can read all questions
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
    OR
    -- Everyone can read published and approved questions
    status::text = ANY (ARRAY['published'::character varying, 'approved'::character varying]::text[])
  );

-- Create separate admin policies for other operations
CREATE POLICY "Admin can manage questions" ON questions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update questions" ON questions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can delete questions" ON questions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Fix user_favorites table - Multiple DELETE policies
-- Drop overlapping policies
DROP POLICY IF EXISTS "Admins can manage all favorites" ON user_favorites;
DROP POLICY IF EXISTS "Users can remove own favorites" ON user_favorites;
DROP POLICY IF EXISTS "Users can add own favorites" ON user_favorites;

-- Create consolidated policies
CREATE POLICY "User favorites insert access" ON user_favorites
  FOR INSERT
  WITH CHECK (
    -- Users can add their own favorites
    user_id = (SELECT auth.uid())
    OR
    -- Admins can add any favorites
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

CREATE POLICY "User favorites delete access" ON user_favorites
  FOR DELETE
  USING (
    -- Users can remove their own favorites
    user_id = (SELECT auth.uid())
    OR
    -- Admins can remove any favorites
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- Create admin UPDATE policy
CREATE POLICY "Admin can update user favorites" ON user_favorites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
    )
  );

-- ============================================================================\n-- 10. FIX FINAL REMAINING ISSUES\n-- ============================================================================\n\n-- Fix inquiries table - The ALL policy overlaps with INSERT policy\n-- Drop the overlapping policies\nDROP POLICY IF EXISTS \"inquiries_admin_manage\" ON inquiries;\nDROP POLICY IF EXISTS \"inquiries_public_insert\" ON inquiries;\n\n-- Create a consolidated INSERT policy that handles both cases\nCREATE POLICY \"inquiries_insert_access\" ON inquiries\n  FOR INSERT\n  WITH CHECK (\n    -- Anyone can insert inquiries (public contact form)\n    true\n  );\n\n-- Create separate admin policies for other operations (SELECT, UPDATE, DELETE)\nCREATE POLICY \"inquiries_admin_select\" ON inquiries\n  FOR SELECT\n  USING (\n    EXISTS (\n      SELECT 1 FROM users \n      WHERE id = (SELECT auth.uid()) \n      AND role = 'admin'\n    )\n  );\n\nCREATE POLICY \"inquiries_admin_update\" ON inquiries\n  FOR UPDATE\n  USING (\n    EXISTS (\n      SELECT 1 FROM users \n      WHERE id = (SELECT auth.uid()) \n      AND role = 'admin'\n    )\n  )\n  WITH CHECK (\n    EXISTS (\n      SELECT 1 FROM users \n      WHERE id = (SELECT auth.uid()) \n      AND role = 'admin'\n    )\n  );\n\nCREATE POLICY \"inquiries_admin_delete\" ON inquiries\n  FOR DELETE\n  USING (\n    EXISTS (\n      SELECT 1 FROM users \n      WHERE id = (SELECT auth.uid()) \n      AND role = 'admin'\n    )\n  );\n\n-- Fix question_options table - Multiple SELECT policies overlap\n-- Drop the overlapping policies\nDROP POLICY IF EXISTS \"Question options read access\" ON question_options;\nDROP POLICY IF EXISTS \"Anonymous users can read answer options for published and appro\" ON question_options;\n\n-- Create a single consolidated SELECT policy\nCREATE POLICY \"Question options read access\" ON question_options\n  FOR SELECT\n  USING (\n    -- Admins can read all question options\n    EXISTS (\n      SELECT 1 FROM users \n      WHERE id = (SELECT auth.uid()) \n      AND role = 'admin'\n    )\n    OR\n    -- Authenticated users can read options for approved questions\n    (\n      (SELECT auth.role()) = 'authenticated'::text\n      AND EXISTS (\n        SELECT 1 FROM questions\n        WHERE questions.id = question_options.question_id\n        AND questions.status::text = 'approved'::text\n      )\n    )\n    OR\n    -- Anonymous users can read options for published and approved questions\n    EXISTS (\n      SELECT 1 FROM questions\n      WHERE questions.id = question_options.question_id\n      AND questions.status::text = ANY (ARRAY['published'::character varying, 'approved'::character varying]::text[])\n    )\n  );\n\n-- Fix duplicate indexes on quiz_attempts table\n-- Drop duplicate indexes, keeping the better-named ones\nDROP INDEX IF EXISTS idx_quiz_attempts_session_user;\nDROP INDEX IF EXISTS idx_quiz_attempts_session_question_id;\n\nCOMMIT;\n\n-- ============================================================================\n-- VERIFICATION QUERIES\n-- ============================================================================

-- Check optimization status
SELECT
  COUNT(*) as total_policies_with_auth,
  COUNT(CASE WHEN qual ~ 'SELECT auth\.(uid|role)\(\)' OR with_check ~ 'SELECT auth\.(uid|role)\(\)' THEN 1 END) as optimized_policies,
  COUNT(CASE WHEN (qual ~ 'auth\.(uid|role)\(\)' AND qual !~ 'SELECT auth\.(uid|role)\(\)')
                OR (with_check ~ 'auth\.(uid|role)\(\)' AND with_check !~ 'SELECT auth\.(uid|role)\(\)')
                THEN 1 END) as unoptimized_policies
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.%' OR with_check LIKE '%auth.%');

-- Check for remaining multiple permissive policies
SELECT
  tablename,
  cmd,
  roles,
  COUNT(*) as policy_count,
  array_agg(policyname) as policy_names
FROM pg_policies
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd, roles
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;
