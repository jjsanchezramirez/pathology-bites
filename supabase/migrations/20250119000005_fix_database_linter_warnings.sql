-- Fix Supabase database linter warnings
-- This migration addresses security warnings from the database linter

-- 1. Add SET search_path TO 'public' to create_user_settings_for_new_user function
CREATE OR REPLACE FUNCTION public.create_user_settings_for_new_user(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_settings (
    user_id,
    quiz_settings,
    notification_settings,
    ui_settings
  )
  VALUES (
    p_user_id,
    -- Quiz settings defaults (matches DEFAULT_QUIZ_SETTINGS)
    jsonb_build_object(
      'default_question_count', 10,
      'default_mode', 'tutor',
      'default_timing', 'untimed',
      'default_question_type', 'unused',
      'default_category_selection', 'all'
    ),
    -- Notification settings defaults (matches DEFAULT_NOTIFICATION_SETTINGS)
    jsonb_build_object(
      'email_notifications', true,
      'quiz_reminders', true,
      'progress_updates', true
    ),
    -- UI settings defaults (matches DEFAULT_UI_SETTINGS)
    jsonb_build_object(
      'theme', 'system',
      'font_size', 'medium',
      'text_zoom', 1.0,
      'dashboard_theme_admin', 'default',
      'dashboard_theme_user', 'tangerine',
      'sidebar_collapsed', false,
      'welcome_message_seen', false
    )
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$function$;

-- 2. Add SET search_path TO 'public' to trigger_refresh_public_stats function
CREATE OR REPLACE FUNCTION public.trigger_refresh_public_stats()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Refresh the materialized view asynchronously
  -- Note: In production, you might want to use pg_cron or a scheduled job instead
  PERFORM refresh_public_stats();
  RETURN NULL;
END;
$function$;

-- 3. Add SET search_path TO 'public' to refresh_public_stats function
CREATE OR REPLACE FUNCTION public.refresh_public_stats()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_public_stats;
END;
$function$;

-- 4. Revoke SELECT access on v_public_stats materialized view from anon and authenticated roles
REVOKE SELECT ON v_public_stats FROM anon, authenticated;

-- 5. Create a secure function to get public stats instead of direct view access
CREATE OR REPLACE FUNCTION public.get_public_stats()
 RETURNS TABLE(total_questions integer, total_images integer, total_categories integer, last_refreshed timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT v_public_stats.total_questions, v_public_stats.total_images, v_public_stats.total_categories, v_public_stats.last_refreshed
  FROM v_public_stats;
END;
$function$;

-- 6. Grant EXECUTE permission on get_public_stats function to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- Add comments
COMMENT ON FUNCTION get_public_stats() IS
'Secure function to retrieve public statistics. Replaces direct access to v_public_stats materialized view to comply with security best practices. Returns total questions, images, categories, and last refresh timestamp.';

-- 7. Drop automatic refresh triggers for public stats
-- These triggers were causing "cannot refresh materialized view concurrently" errors
-- when deleting users, and are unnecessary since:
-- - The API has a 24-hour cache
-- - Stats don't need to be real-time
-- - Manual refresh is available via get_public_stats() function
DROP TRIGGER IF EXISTS trigger_questions_refresh_public_stats ON public.questions;
DROP TRIGGER IF EXISTS trigger_images_refresh_public_stats ON public.images;

-- 8. Convert v_public_stats from materialized view to regular view
-- Regular views are always fresh (computed on-the-fly) and don't need refresh logic
-- This eliminates concurrent refresh conflicts entirely
DROP MATERIALIZED VIEW IF EXISTS v_public_stats CASCADE;

CREATE VIEW v_public_stats AS
SELECT
  (SELECT count(*) FROM questions)::integer AS total_questions,
  (SELECT count(*) FROM images)::integer AS total_images,
  (SELECT count(DISTINCT questions.category_id) FROM questions WHERE questions.category_id IS NOT NULL)::integer AS total_categories,
  now() AS last_refreshed;

-- Note: The trigger_refresh_public_stats() and refresh_public_stats() functions
-- are no longer needed but kept for backwards compatibility if needed

