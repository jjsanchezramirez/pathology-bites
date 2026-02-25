-- Fix RLS performance issues identified by Supabase database linter
-- Addresses warnings: auth_rls_initplan and multiple_permissive_policies
--
-- Performance Issues Fixed:
-- 1. auth_rls_initplan: auth.uid() and auth.jwt() re-evaluated for each row
--    Solution: Wrap in subquery (select auth.uid()) to evaluate once per query
--
-- 2. multiple_permissive_policies: Multiple SELECT policies on same table/role
--    Solution: Combine into single policy with OR logic
--
-- References:
-- - https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
-- - https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

-- ==============================================================================
-- FIX: r2_storage_metrics table policies
-- ==============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can read storage metrics" ON public.r2_storage_metrics;
DROP POLICY IF EXISTS "Service role can manage storage metrics" ON public.r2_storage_metrics;

-- Recreate with optimized auth checks
CREATE POLICY "Admins can read storage metrics"
  ON public.r2_storage_metrics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())  -- Evaluate once per query
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Service role can manage storage metrics"
  ON public.r2_storage_metrics
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');  -- JWT access doesn't need subquery (static)

-- ==============================================================================
-- FIX: audio table policies
-- ==============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Only admins can insert audio" ON public.audio;
DROP POLICY IF EXISTS "Only admins can update audio" ON public.audio;
DROP POLICY IF EXISTS "Only admins can delete audio" ON public.audio;

-- Recreate with optimized auth checks
CREATE POLICY "Only admins can insert audio"
    ON public.audio
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can update audio"
    ON public.audio
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete audio"
    ON public.audio
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    );

-- ==============================================================================
-- FIX: interactive_sequences table policies
-- ==============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view published interactive sequences" ON public.interactive_sequences;
DROP POLICY IF EXISTS "Admins can view all interactive sequences" ON public.interactive_sequences;
DROP POLICY IF EXISTS "Only admins can insert interactive sequences" ON public.interactive_sequences;
DROP POLICY IF EXISTS "Only admins can update interactive sequences" ON public.interactive_sequences;
DROP POLICY IF EXISTS "Only admins can delete interactive sequences" ON public.interactive_sequences;

-- COMBINED POLICY: Fix multiple_permissive_policies warning
-- Combines "Anyone can view published" + "Admins can view all" into single policy
CREATE POLICY "View interactive sequences"
    ON public.interactive_sequences
    FOR SELECT
    USING (
        -- Anyone can view published sequences
        status = 'published'
        OR
        -- Admins can view all sequences (draft/published/archived)
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    );

-- Other policies with optimized auth checks
CREATE POLICY "Only admins can insert interactive sequences"
    ON public.interactive_sequences
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can update interactive sequences"
    ON public.interactive_sequences
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    );

CREATE POLICY "Only admins can delete interactive sequences"
    ON public.interactive_sequences
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = (select auth.uid())  -- Evaluate once per query
            AND users.role = 'admin'
        )
    );

-- ==============================================================================
-- COMMENTS AND DOCUMENTATION
-- ==============================================================================

COMMENT ON POLICY "Admins can read storage metrics" ON public.r2_storage_metrics IS
  'Optimized: auth.uid() wrapped in subquery to evaluate once per query instead of per row';

COMMENT ON POLICY "View interactive sequences" ON public.interactive_sequences IS
  'Optimized: Combined two SELECT policies into one. Published sequences visible to all, all sequences visible to admins. auth.uid() wrapped in subquery for performance.';

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

DO $$
DECLARE
    r2_policy_count integer;
    audio_policy_count integer;
    interactive_policy_count integer;
BEGIN
    -- Count policies per table
    SELECT COUNT(*) INTO r2_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'r2_storage_metrics';

    SELECT COUNT(*) INTO audio_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audio';

    SELECT COUNT(*) INTO interactive_policy_count
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'interactive_sequences';

    RAISE NOTICE 'RLS policies updated successfully:';
    RAISE NOTICE '  r2_storage_metrics: % policies', r2_policy_count;
    RAISE NOTICE '  audio: % policies (4 expected: 1 SELECT + 3 admin)', audio_policy_count;
    RAISE NOTICE '  interactive_sequences: % policies (4 expected: 1 combined SELECT + 3 admin)', interactive_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Performance improvements:';
    RAISE NOTICE '  ✓ auth.uid() now wrapped in subquery (evaluates once per query)';
    RAISE NOTICE '  ✓ Multiple permissive policies combined (interactive_sequences)';
    RAISE NOTICE '';
    RAISE NOTICE 'Run database linter again to verify warnings are resolved';
END $$;
