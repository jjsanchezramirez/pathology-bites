-- Fix RLS Performance Issues (Auth RLS Initialization Plan)
-- This migration optimizes RLS policies by wrapping auth.uid() in SELECT subqueries
-- This prevents re-evaluation of auth.uid() for each row, improving query performance at scale

-- ============================================================================
-- TABLE: question_reviews
-- ============================================================================

-- Drop and recreate: Question reviews read access
DROP POLICY IF EXISTS "Question reviews read access" ON public.question_reviews;

CREATE POLICY "Question reviews read access"
ON public.question_reviews
FOR SELECT
TO public
USING (
  -- Admin can see all reviews
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()) 
    AND users.role = 'admin'
  ))
  OR
  -- Reviewers can see all reviews
  (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()) 
    AND users.role = 'reviewer'
  ))
  OR
  -- Creators can see reviews for their own questions
  (
    (EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = (SELECT auth.uid()) 
      AND users.role = 'creator'
    ))
    AND
    (EXISTS (
      SELECT 1 FROM questions q 
      WHERE q.id = question_reviews.question_id 
      AND q.created_by = (SELECT auth.uid())
    ))
  )
);

-- ============================================================================
-- TABLE: questions
-- ============================================================================

-- Drop and recreate: Questions delete access
DROP POLICY IF EXISTS "Questions delete access" ON public.questions;

CREATE POLICY "Questions delete access"
ON public.questions
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()) 
    AND users.role = 'admin'
  )
);

-- Drop and recreate: Questions insert access
DROP POLICY IF EXISTS "Questions insert access" ON public.questions;

CREATE POLICY "Questions insert access"
ON public.questions
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()) 
    AND users.role IN ('admin', 'creator')
  )
);

-- ============================================================================
-- TABLE: user_learning
-- ============================================================================

-- Drop and recreate: Users can create their own learning path enrollments
DROP POLICY IF EXISTS "Users can create their own learning path enrollments" ON public.user_learning;

CREATE POLICY "Users can create their own learning path enrollments"
ON public.user_learning
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: module_attempts
-- ============================================================================

-- Drop and recreate: Users can create their own module attempts
DROP POLICY IF EXISTS "Users can create their own module attempts" ON public.module_attempts;

CREATE POLICY "Users can create their own module attempts"
ON public.module_attempts
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- BONUS: Fix other policies that also have the same issue (not in linter report but good to fix)
-- ============================================================================

-- module_attempts: Users can view their own module attempts
DROP POLICY IF EXISTS "Users can view their own module attempts" ON public.module_attempts;

CREATE POLICY "Users can view their own module attempts"
ON public.module_attempts
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- module_attempts: Users can update their own module attempts
DROP POLICY IF EXISTS "Users can update their own module attempts" ON public.module_attempts;

CREATE POLICY "Users can update their own module attempts"
ON public.module_attempts
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- user_learning: Users can view their own learning path enrollments
DROP POLICY IF EXISTS "Users can view their own learning path enrollments" ON public.user_learning;

CREATE POLICY "Users can view their own learning path enrollments"
ON public.user_learning
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- user_learning: Users can update their own learning path enrollments
DROP POLICY IF EXISTS "Users can update their own learning path enrollments" ON public.user_learning;

CREATE POLICY "Users can update their own learning path enrollments"
ON public.user_learning
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- questions: Questions read access (has multiple auth.uid() calls)
DROP POLICY IF EXISTS "Questions read access" ON public.questions;

CREATE POLICY "Questions read access"
ON public.questions
FOR SELECT
TO public
USING (
  status = 'published'
  OR created_by = (SELECT auth.uid())
  OR reviewer_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()) 
    AND users.role = 'admin'
  )
);

-- questions: Questions update access (has multiple auth.uid() calls)
DROP POLICY IF EXISTS "Questions update access" ON public.questions;

CREATE POLICY "Questions update access"
ON public.questions
FOR UPDATE
TO public
USING (
  -- Creators can update their own draft/rejected questions
  (created_by = (SELECT auth.uid()) AND status IN ('draft', 'rejected'))
  OR
  -- Reviewers can update questions pending review
  (reviewer_id = (SELECT auth.uid()) AND status = 'pending_review')
  OR
  -- Admins can update any question
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- TABLE: module_sessions
-- ============================================================================

-- Drop and recreate: Users can create their own module sessions
DROP POLICY IF EXISTS "Users can create their own module sessions" ON public.module_sessions;

CREATE POLICY "Users can create their own module sessions"
ON public.module_sessions
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

-- Drop and recreate: Users can view their own module sessions
DROP POLICY IF EXISTS "Users can view their own module sessions" ON public.module_sessions;

CREATE POLICY "Users can view their own module sessions"
ON public.module_sessions
FOR SELECT
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- Drop and recreate: Users can update their own module sessions
DROP POLICY IF EXISTS "Users can update their own module sessions" ON public.module_sessions;

CREATE POLICY "Users can update their own module sessions"
ON public.module_sessions
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: categories
-- ============================================================================

-- Drop and recreate: categories_delete_admin
DROP POLICY IF EXISTS "categories_delete_admin" ON public.categories;

CREATE POLICY "categories_delete_admin"
ON public.categories
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'
  )
);

-- Drop and recreate: categories_insert_admin
DROP POLICY IF EXISTS "categories_insert_admin" ON public.categories;

CREATE POLICY "categories_insert_admin"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'
  )
);

-- Drop and recreate: categories_update_admin (bonus - has auth.uid() in both USING and WITH CHECK)
DROP POLICY IF EXISTS "categories_update_admin" ON public.categories;

CREATE POLICY "categories_update_admin"
ON public.categories
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'
  )
);

-- ============================================================================
-- TABLE: notification_states
-- ============================================================================

-- Drop and recreate: notification_states_user_access
DROP POLICY IF EXISTS "notification_states_user_access" ON public.notification_states;

CREATE POLICY "notification_states_user_access"
ON public.notification_states
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: performance_analytics
-- ============================================================================

-- Drop and recreate: performance_analytics_user_access
DROP POLICY IF EXISTS "performance_analytics_user_access" ON public.performance_analytics;

CREATE POLICY "performance_analytics_user_access"
ON public.performance_analytics
FOR SELECT
TO authenticated
USING (
  (user_id = (SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'
  )
);

-- Drop and recreate: performance_analytics_user_modify
DROP POLICY IF EXISTS "performance_analytics_user_modify" ON public.performance_analytics;

CREATE POLICY "performance_analytics_user_modify"
ON public.performance_analytics
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: question_reports
-- ============================================================================

-- Drop and recreate: question_reports_admin_delete
DROP POLICY IF EXISTS "question_reports_admin_delete" ON public.question_reports;

CREATE POLICY "question_reports_admin_delete"
ON public.question_reports
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'
  )
);

-- Drop and recreate: question_reports_admin_update
DROP POLICY IF EXISTS "question_reports_admin_update" ON public.question_reports;

CREATE POLICY "question_reports_admin_update"
ON public.question_reports
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
);

-- Drop and recreate: question_reports_user_insert (bonus optimization)
DROP POLICY IF EXISTS "question_reports_user_insert" ON public.question_reports;

CREATE POLICY "question_reports_user_insert"
ON public.question_reports
FOR INSERT
TO authenticated
WITH CHECK (reported_by = (SELECT auth.uid()));

-- Drop and recreate: question_reports_user_select (bonus optimization)
DROP POLICY IF EXISTS "question_reports_user_select" ON public.question_reports;

CREATE POLICY "question_reports_user_select"
ON public.question_reports
FOR SELECT
TO authenticated
USING (
  (reported_by = (SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
);

-- ============================================================================
-- TABLE: question_sets
-- ============================================================================

-- Drop and recreate: question_sets_delete_admin
DROP POLICY IF EXISTS "question_sets_delete_admin" ON public.question_sets;

CREATE POLICY "question_sets_delete_admin"
ON public.question_sets
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

-- Drop and recreate: question_sets_insert_creator
DROP POLICY IF EXISTS "question_sets_insert_creator" ON public.question_sets;

CREATE POLICY "question_sets_insert_creator"
ON public.question_sets
FOR INSERT
TO authenticated
WITH CHECK (
  (created_by = (SELECT auth.uid()))
  AND
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'creator'::user_role, 'reviewer'::user_role])
  )
);

-- Drop and recreate: question_sets_select_own
DROP POLICY IF EXISTS "question_sets_select_own" ON public.question_sets;

CREATE POLICY "question_sets_select_own"
ON public.question_sets
FOR SELECT
TO authenticated
USING (
  (created_by = (SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
);

-- Drop and recreate: question_sets_update_creator
DROP POLICY IF EXISTS "question_sets_update_creator" ON public.question_sets;

CREATE POLICY "question_sets_update_creator"
ON public.question_sets
FOR UPDATE
TO authenticated
USING (
  (created_by = (SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
)
WITH CHECK (
  (created_by = (SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
);

-- ============================================================================
-- TABLE: user_achievements
-- ============================================================================

-- Drop and recreate: user_achievements_user_access
DROP POLICY IF EXISTS "user_achievements_user_access" ON public.user_achievements;

CREATE POLICY "user_achievements_user_access"
ON public.user_achievements
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: question_tags
-- ============================================================================

-- Drop and recreate: question_tags_delete_creator
DROP POLICY IF EXISTS "question_tags_delete_creator" ON public.question_tags;

CREATE POLICY "question_tags_delete_creator"
ON public.question_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM questions q
    JOIN users u ON q.created_by = u.id
    WHERE q.id = question_tags.question_id
    AND (q.created_by = (SELECT auth.uid()) OR u.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role]))
  )
);

-- Drop and recreate: question_tags_insert_creator
DROP POLICY IF EXISTS "question_tags_insert_creator" ON public.question_tags;

CREATE POLICY "question_tags_insert_creator"
ON public.question_tags
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM questions q
    JOIN users u ON q.created_by = u.id
    WHERE q.id = question_tags.question_id
    AND (q.created_by = (SELECT auth.uid()) OR u.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role]))
  )
);

-- Drop and recreate: question_tags_update_creator
DROP POLICY IF EXISTS "question_tags_update_creator" ON public.question_tags;

CREATE POLICY "question_tags_update_creator"
ON public.question_tags
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM questions q
    JOIN users u ON q.created_by = u.id
    WHERE q.id = question_tags.question_id
    AND (q.created_by = (SELECT auth.uid()) OR u.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role]))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM questions q
    JOIN users u ON q.created_by = u.id
    WHERE q.id = question_tags.question_id
    AND (q.created_by = (SELECT auth.uid()) OR u.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role]))
  )
);

-- ============================================================================
-- TABLE: question_versions
-- ============================================================================

-- Drop and recreate: question_versions_select
DROP POLICY IF EXISTS "question_versions_select" ON public.question_versions;

CREATE POLICY "question_versions_select"
ON public.question_versions
FOR SELECT
TO public
USING (
  -- Admins can see all versions
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
  OR
  -- Reviewers can see versions of draft/pending_review questions
  (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role = 'reviewer'::user_role
    )
    AND
    EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_versions.question_id
      AND q.status = ANY (ARRAY['draft'::question_status, 'pending_review'::question_status])
    )
  )
  OR
  -- Creators can see versions of their own questions
  (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = (SELECT auth.uid())
      AND users.role = 'creator'::user_role
    )
    AND
    EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_versions.question_id
      AND q.created_by = (SELECT auth.uid())
    )
  )
);

-- ============================================================================
-- TABLE: tags
-- ============================================================================

-- Drop and recreate: tags_delete_admin
DROP POLICY IF EXISTS "tags_delete_admin" ON public.tags;

CREATE POLICY "tags_delete_admin"
ON public.tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

-- Drop and recreate: tags_insert_admin
DROP POLICY IF EXISTS "tags_insert_admin" ON public.tags;

CREATE POLICY "tags_insert_admin"
ON public.tags
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'creator'::user_role, 'reviewer'::user_role])
  )
);

-- Drop and recreate: tags_update_admin
DROP POLICY IF EXISTS "tags_update_admin" ON public.tags;

CREATE POLICY "tags_update_admin"
ON public.tags
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
);

-- ============================================================================
-- TABLE: user_favorites
-- ============================================================================

-- Drop and recreate: user_favorites_user_access
DROP POLICY IF EXISTS "user_favorites_user_access" ON public.user_favorites;

CREATE POLICY "user_favorites_user_access"
ON public.user_favorites
FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================================
-- TABLE: images
-- ============================================================================

-- Drop and recreate: Allow admins to insert images
DROP POLICY IF EXISTS "Allow admins to insert images" ON public.images;

CREATE POLICY "Allow admins to insert images"
ON public.images
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

-- Drop and recreate: Allow admins to delete images (bonus optimization)
DROP POLICY IF EXISTS "Allow admins to delete images" ON public.images;

CREATE POLICY "Allow admins to delete images"
ON public.images
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

-- Drop and recreate: Allow admins to update images (bonus optimization)
DROP POLICY IF EXISTS "Allow admins to update images" ON public.images;

CREATE POLICY "Allow admins to update images"
ON public.images
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

-- ============================================================================
-- TABLE: waitlist
-- ============================================================================

-- Drop and recreate: Allow admins to select from waitlist
DROP POLICY IF EXISTS "Allow admins to select from waitlist" ON public.waitlist;

CREATE POLICY "Allow admins to select from waitlist"
ON public.waitlist
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

-- ============================================================================
-- TABLE: inquiries
-- ============================================================================

-- Drop and recreate: inquiries_select_admin
DROP POLICY IF EXISTS "inquiries_select_admin" ON public.inquiries;

CREATE POLICY "inquiries_select_admin"
ON public.inquiries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = ANY (ARRAY['admin'::user_role, 'creator'::user_role, 'reviewer'::user_role])
  )
);

-- ============================================================================
-- TABLE: user_settings
-- ============================================================================

-- Drop and recreate: user_settings_insert_for_new_user
DROP POLICY IF EXISTS "user_settings_insert_for_new_user" ON public.user_settings;

CREATE POLICY "user_settings_insert_for_new_user"
ON public.user_settings
FOR INSERT
TO public
WITH CHECK (
  ((SELECT (auth.jwt() ->> 'role')) = 'service_role')
  OR
  (user_id = (SELECT auth.uid()))
);

-- ============================================================================
-- TABLE: question_options
-- ============================================================================

-- Drop and recreate: Question options read access
DROP POLICY IF EXISTS "Question options read access" ON public.question_options;

CREATE POLICY "Question options read access"
ON public.question_options
FOR SELECT
TO public
USING (
  -- Admins can see all options
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
  OR
  -- Authenticated users can see options for published questions
  (
    (SELECT auth.role()) = 'authenticated'
    AND
    EXISTS (
      SELECT 1 FROM questions
      WHERE questions.id = question_options.question_id
      AND questions.status = 'published'::question_status
    )
  )
);

