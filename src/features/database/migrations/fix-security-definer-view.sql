-- Fix Security Definer View Issue
-- This migration removes SECURITY DEFINER from v_public_stats view
-- and recreates it with SECURITY INVOKER (explicit, safer option)

-- Drop the existing view
DROP VIEW IF EXISTS public.v_public_stats;

-- Recreate the view with explicit SECURITY INVOKER option
-- This view shows public statistics that should be accessible to everyone
-- It only counts published questions to respect RLS policies
-- The WITH (security_invoker = true) option is REQUIRED in PostgreSQL 15+
CREATE VIEW public.v_public_stats
WITH (security_invoker = true)
AS
SELECT
  (SELECT COUNT(*)::integer
   FROM questions
   WHERE status = 'published') AS total_questions,
  (SELECT COUNT(*)::integer
   FROM images) AS total_images,
  (SELECT COUNT(DISTINCT category_id)::integer
   FROM questions
   WHERE category_id IS NOT NULL
   AND status = 'published') AS total_categories,
  NOW() AS last_refreshed;

-- Grant SELECT access to public (anonymous users)
GRANT SELECT ON public.v_public_stats TO anon;

-- Grant SELECT access to authenticated users
GRANT SELECT ON public.v_public_stats TO authenticated;

-- Add a comment to document the view's purpose
COMMENT ON VIEW public.v_public_stats IS 'Public statistics view showing counts of published questions, images, and categories. Uses SECURITY INVOKER for safety.';

