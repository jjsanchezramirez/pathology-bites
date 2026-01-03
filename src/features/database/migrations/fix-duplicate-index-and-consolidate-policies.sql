-- ============================================================================
-- FIX: Duplicate Index and Multiple Permissive Policies
-- Date: 2026-01-03
-- Issues Fixed:
--   1. Duplicate Index on user_favorites (1 issue)
--   2. Multiple Permissive Policies (8 issues across 5 tables)
-- ============================================================================

-- ============================================================================
-- ISSUE 1: DUPLICATE INDEX
-- ============================================================================

-- Drop duplicate index on user_favorites
-- Both idx_quiz_comprehensive_favorites and idx_user_favorites_user_question
-- are identical: (user_id, question_id)
-- Keeping idx_user_favorites_user_question as it has a more descriptive name

DROP INDEX IF EXISTS public.idx_quiz_comprehensive_favorites;

-- ============================================================================
-- ISSUE 2: MULTIPLE PERMISSIVE POLICIES - CONSOLIDATION
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: performance_analytics
-- Issue: Has both performance_analytics_user_access (SELECT) and
--        performance_analytics_user_modify (ALL) for authenticated role
-- Solution: Split the ALL policy into specific operations to avoid overlap
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "performance_analytics_user_modify" ON public.performance_analytics;
DROP POLICY IF EXISTS "performance_analytics_user_access" ON public.performance_analytics;

CREATE POLICY "performance_analytics_select_consolidated"
ON public.performance_analytics
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = (SELECT auth.uid())
    AND users.role = 'admin'::user_role
  )
);

CREATE POLICY "performance_analytics_insert_own"
ON public.performance_analytics
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "performance_analytics_update_own"
ON public.performance_analytics
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "performance_analytics_delete_own"
ON public.performance_analytics
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

-- ----------------------------------------------------------------------------
-- TABLE: question_sets
-- Issue: Has both question_sets_select_active and question_sets_select_own
-- Solution: Consolidate into a single policy
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "question_sets_select_active" ON public.question_sets;
DROP POLICY IF EXISTS "question_sets_select_own" ON public.question_sets;

CREATE POLICY "question_sets_select_consolidated"
ON public.question_sets
FOR SELECT
TO authenticated
USING (
  -- Active question sets are visible to all authenticated users
  is_active = true
  OR
  -- Users can see their own question sets (even if inactive)
  created_by = (SELECT auth.uid())
  OR
  -- Admins and reviewers can see all question sets
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = (SELECT auth.uid()) 
    AND users.role = ANY (ARRAY['admin'::user_role, 'reviewer'::user_role])
  )
);

-- ----------------------------------------------------------------------------
-- TABLE: user_settings
-- Issue: Has both user_settings_insert_for_new_user and user_settings_own_data
-- Solution: Consolidate into a single policy for INSERT
-- Note: user_settings_own_data is for ALL operations, so we need to split it
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "user_settings_insert_for_new_user" ON public.user_settings;
DROP POLICY IF EXISTS "user_settings_own_data" ON public.user_settings;

-- Consolidated INSERT policy
CREATE POLICY "user_settings_insert_consolidated"
ON public.user_settings
FOR INSERT
TO public
WITH CHECK (
  -- Service role can insert for any user
  (SELECT auth.role()) = 'service_role'
  OR
  -- Users can insert their own settings
  user_id = (SELECT auth.uid())
);

-- Separate SELECT policy
CREATE POLICY "user_settings_select_own"
ON public.user_settings
FOR SELECT
TO public
USING (user_id = (SELECT auth.uid()));

-- Separate UPDATE policy
CREATE POLICY "user_settings_update_own"
ON public.user_settings
FOR UPDATE
TO public
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

-- Separate DELETE policy
CREATE POLICY "user_settings_delete_own"
ON public.user_settings
FOR DELETE
TO public
USING (user_id = (SELECT auth.uid()));

-- ----------------------------------------------------------------------------
-- TABLE: module_images
-- Issue: Has both "Anyone can view published" and "Authenticated users can view all"
-- Solution: Consolidate into a single policy
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view published module images" ON public.module_images;
DROP POLICY IF EXISTS "Authenticated users can view all module images" ON public.module_images;

CREATE POLICY "module_images_select_consolidated"
ON public.module_images
FOR SELECT
TO public
USING (
  -- Public can see images for published modules
  EXISTS (
    SELECT 1 FROM learning_modules
    WHERE learning_modules.id = module_images.module_id
    AND learning_modules.status = 'published'
  )
  OR
  -- Authenticated users can see all module images
  (SELECT auth.role()) = 'authenticated'
);

-- ----------------------------------------------------------------------------
-- TABLE: module_prerequisites
-- Issue: Has both "Anyone can view published" and "Authenticated users can view all"
-- Solution: Consolidate into a single policy
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view published module prerequisites" ON public.module_prerequisites;
DROP POLICY IF EXISTS "Authenticated users can view all module prerequisites" ON public.module_prerequisites;

CREATE POLICY "module_prerequisites_select_consolidated"
ON public.module_prerequisites
FOR SELECT
TO public
USING (
  -- Public can see prerequisites for published modules
  EXISTS (
    SELECT 1 FROM learning_modules
    WHERE learning_modules.id = module_prerequisites.module_id
    AND learning_modules.status = 'published'
  )
  OR
  -- Authenticated users can see all module prerequisites
  (SELECT auth.role()) = 'authenticated'
);

-- ----------------------------------------------------------------------------
-- TABLE: learning_modules
-- Issue: Has both "Anyone can view published" and "Authenticated users can view all"
-- Solution: Consolidate into a single policy
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view published learning modules" ON public.learning_modules;
DROP POLICY IF EXISTS "Authenticated users can view all learning modules" ON public.learning_modules;

CREATE POLICY "learning_modules_select_consolidated"
ON public.learning_modules
FOR SELECT
TO public
USING (
  -- Public can see published modules
  status = 'published'
  OR
  -- Authenticated users can see all modules
  (SELECT auth.role()) = 'authenticated'
);

-- ----------------------------------------------------------------------------
-- TABLE: learning_paths
-- Issue: Has both "Anyone can view published" and "Authenticated users can view all"
-- Solution: Consolidate into a single policy
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Anyone can view published learning paths" ON public.learning_paths;
DROP POLICY IF EXISTS "Authenticated users can view all learning paths" ON public.learning_paths;

CREATE POLICY "learning_paths_select_consolidated"
ON public.learning_paths
FOR SELECT
TO public
USING (
  -- Public can see published paths
  status = 'published'
  OR
  -- Authenticated users can see all paths
  (SELECT auth.role()) = 'authenticated'
);

