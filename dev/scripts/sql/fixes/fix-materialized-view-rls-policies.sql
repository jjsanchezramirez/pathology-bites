-- Fix RLS policies for user_stats_computed materialized view
-- Addresses Supabase database linter warning: materialized_view_in_api
-- This ensures proper access control for the materialized view exposed via PostgREST

-- ==============================================================================
-- ENABLE RLS ON MATERIALIZED VIEW
-- ==============================================================================

-- Enable Row Level Security on the materialized view
ALTER MATERIALIZED VIEW IF EXISTS public.user_stats_computed
    OWNER TO postgres;

-- Note: Materialized views don't support RLS directly in PostgreSQL
-- Instead, we'll create a secure view wrapper with RLS

-- ==============================================================================
-- CREATE SECURE VIEW WRAPPER
-- ==============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS public.user_stats_secure CASCADE;

-- Create a regular view that wraps the materialized view with access control
-- Note: Views don't support RLS policies in PostgreSQL, but we can filter directly
CREATE OR REPLACE VIEW public.user_stats_secure
WITH (security_invoker = true)
AS
SELECT
    user_id,
    total_quizzes,
    completed_quizzes,
    avg_score,
    highest_score,
    lowest_score,
    total_questions_attempted,
    total_correct_answers,
    total_time_spent,
    avg_time_per_question,
    last_quiz_completed,
    last_quiz_created,
    current_streak,
    longest_streak,
    last_updated
FROM public.user_stats_computed
WHERE user_id = auth.uid();  -- Filter to current user only

-- Enable security_invoker on the view
ALTER VIEW public.user_stats_secure SET (security_invoker = true);

-- ==============================================================================
-- ACCESS CONTROL VIA VIEW FILTERING
-- ==============================================================================

-- Note: Views don't support RLS policies directly in PostgreSQL
-- Access control is implemented via WHERE clause in the view definition
-- Users can only see their own stats (WHERE user_id = auth.uid())
-- Service role bypasses this restriction and can query the underlying
-- materialized view directly for admin operations

-- ==============================================================================
-- REVOKE DIRECT ACCESS TO MATERIALIZED VIEW
-- ==============================================================================

-- Revoke public access from the materialized view
REVOKE ALL ON public.user_stats_computed FROM anon;
REVOKE ALL ON public.user_stats_computed FROM authenticated;

-- Only service_role should have direct access to refresh the materialized view
GRANT SELECT ON public.user_stats_computed TO service_role;

-- ==============================================================================
-- GRANT ACCESS TO SECURE VIEW
-- ==============================================================================

-- Grant access to the secure view wrapper
GRANT SELECT ON public.user_stats_secure TO authenticated;
GRANT SELECT ON public.user_stats_secure TO anon;

-- ==============================================================================
-- CREATE REFRESH FUNCTION (ADMIN ONLY)
-- ==============================================================================

-- Create a function to refresh the materialized view (admin only)
CREATE OR REPLACE FUNCTION public.refresh_user_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_stats_computed;

    RAISE NOTICE 'User stats materialized view refreshed successfully';
END;
$$;

-- Only service_role can execute the refresh function
GRANT EXECUTE ON FUNCTION public.refresh_user_stats() TO service_role;
REVOKE EXECUTE ON FUNCTION public.refresh_user_stats() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_user_stats() FROM anon;

COMMENT ON FUNCTION public.refresh_user_stats() IS
  'Refreshes the user_stats_computed materialized view.
   Only accessible by service_role for admin operations.
   Uses SECURITY DEFINER with immutable search_path for security.';

-- ==============================================================================
-- CREATE CRON JOB FOR AUTOMATIC REFRESH (OPTIONAL)
-- ==============================================================================

-- Note: Uncomment below to set up automatic refresh via pg_cron extension
-- Requires pg_cron extension to be enabled in Supabase

/*
-- Refresh user stats every hour
SELECT cron.schedule(
    'refresh-user-stats',           -- job name
    '0 * * * *',                     -- every hour at minute 0
    $$SELECT refresh_user_stats()$$
);
*/

-- ==============================================================================
-- COMMENTS AND DOCUMENTATION
-- ==============================================================================

COMMENT ON VIEW public.user_stats_secure IS
  'Secure view wrapper for user_stats_computed materialized view.
   Filters data to current user via WHERE user_id = auth.uid().
   Users can only see their own stats; service_role queries materialized view directly.';

COMMENT ON MATERIALIZED VIEW public.user_stats_computed IS
  'Precomputed user statistics for performance.
   Direct access is restricted - use user_stats_secure view instead.
   Refresh via refresh_user_stats() function (service_role only).';

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

DO $$
DECLARE
    view_exists boolean;
BEGIN
    -- Check if secure view exists
    SELECT EXISTS (
        SELECT 1
        FROM pg_views
        WHERE schemaname = 'public'
        AND viewname = 'user_stats_secure'
    ) INTO view_exists;

    IF view_exists THEN
        RAISE NOTICE 'Successfully created secure view wrapper for user_stats_computed';
        RAISE NOTICE 'View filters data to current user via WHERE user_id = auth.uid()';
        RAISE NOTICE 'Direct access to materialized view restricted to service_role';
        RAISE NOTICE 'Use user_stats_secure view for filtered access';
    ELSE
        RAISE WARNING 'Failed to create secure view wrapper';
    END IF;
END $$;
