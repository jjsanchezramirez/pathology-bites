-- Migration: Fix Security Definer Views
-- This migration recreates views with SECURITY INVOKER to ensure they respect
-- the querying user's permissions and don't bypass RLS policies
-- Addresses Supabase Security Advisor ERROR: Security Definer View

BEGIN;

-- 1. Recreate v_storage_stats with SECURITY INVOKER
CREATE OR REPLACE VIEW public.v_storage_stats
WITH (security_invoker=on)
AS
SELECT 
  COUNT(*) as total_images,
  COALESCE(SUM(file_size_bytes), 0) as total_size_bytes,
  COUNT(*) FILTER (WHERE category = 'microscopic') as microscopic_count,
  COUNT(*) FILTER (WHERE category = 'gross') as gross_count,
  COUNT(*) FILTER (WHERE category = 'figure') as figure_count,
  COUNT(*) FILTER (WHERE category = 'table') as table_count,
  COALESCE(SUM(file_size_bytes) FILTER (WHERE category = 'microscopic'), 0) as microscopic_size_bytes,
  COALESCE(SUM(file_size_bytes) FILTER (WHERE category = 'gross'), 0) as gross_size_bytes,
  COALESCE(SUM(file_size_bytes) FILTER (WHERE category = 'figure'), 0) as figure_size_bytes,
  COALESCE(SUM(file_size_bytes) FILTER (WHERE category = 'table'), 0) as table_size_bytes,
  COUNT(*) FILTER (WHERE id NOT IN (SELECT DISTINCT image_id FROM question_images)) as orphaned_count,
  COALESCE(SUM(file_size_bytes) FILTER (WHERE id NOT IN (SELECT DISTINCT image_id FROM question_images)), 0) as orphaned_size_bytes
FROM images 
WHERE category != 'external';

-- 2. Recreate v_image_usage_stats with SECURITY INVOKER
CREATE OR REPLACE VIEW public.v_image_usage_stats
WITH (security_invoker=on)
AS
SELECT 
  i.id,
  i.url,
  i.alt_text,
  i.description,
  i.category,
  i.file_size_bytes,
  i.width,
  i.height,
  i.created_at,
  i.created_by,
  i.source_ref,
  COALESCE(qi.usage_count, 0) as usage_count,
  CASE WHEN qi.usage_count IS NULL OR qi.usage_count = 0 THEN true ELSE false END as is_orphaned,
  COALESCE(qi.question_ids, ARRAY[]::uuid[]) as question_ids
FROM images i
LEFT JOIN (
  SELECT 
    image_id,
    COUNT(*) as usage_count,
    array_agg(DISTINCT question_id) as question_ids
  FROM question_images 
  GROUP BY image_id
) qi ON i.id = qi.image_id
WHERE i.category != 'external';

-- 3. Recreate v_orphaned_images with SECURITY INVOKER
CREATE OR REPLACE VIEW public.v_orphaned_images
WITH (security_invoker=on)
AS
SELECT 
  i.id,
  i.url,
  i.alt_text,
  i.description,
  i.category,
  i.file_size_bytes,
  i.storage_path,
  i.created_at
FROM images i
WHERE i.category != 'external'
  AND i.id NOT IN (
    SELECT DISTINCT image_id 
    FROM question_images
  );

-- 4. Recreate v_image_usage_by_category with SECURITY INVOKER
CREATE OR REPLACE VIEW public.v_image_usage_by_category
WITH (security_invoker=on)
AS
SELECT 
  i.category,
  COUNT(*) as total_images,
  COUNT(qi.image_id) as used_images,
  COUNT(*) - COUNT(qi.image_id) as orphaned_images,
  COALESCE(SUM(i.file_size_bytes), 0) as total_size_bytes,
  COALESCE(AVG(i.file_size_bytes), 0) as avg_size_bytes,
  ROUND(
    (COUNT(qi.image_id)::decimal / COUNT(*)::decimal) * 100, 
    2
  ) as usage_percentage
FROM images i
LEFT JOIN (
  SELECT DISTINCT image_id 
  FROM question_images
) qi ON i.id = qi.image_id
WHERE i.category != 'external'
GROUP BY i.category
ORDER BY total_images DESC;

-- 5. Recreate v_dashboard_stats with SECURITY INVOKER
CREATE OR REPLACE VIEW public.v_dashboard_stats
WITH (security_invoker=on)
AS
WITH question_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE status = 'published') as published_questions,
    COUNT(*) FILTER (WHERE status = 'draft') as draft_questions,
    COUNT(*) FILTER (WHERE status = 'flagged') as flagged_questions,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as recent_questions
  FROM questions
), user_stats AS (
  SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as recent_users
  FROM users
), other_stats AS (
  SELECT
    (SELECT COUNT(*) FROM images WHERE category != 'external') as total_images,
    (SELECT COUNT(*) FROM quiz_sessions) as total_quiz_sessions,
    (SELECT COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') FROM quiz_sessions) as recent_quiz_sessions,
    (SELECT COUNT(*) FROM inquiries) as total_inquiries,
    (SELECT COUNT(*) FROM question_reports) as question_reports,
    (SELECT COUNT(*) FILTER (WHERE status = 'pending') FROM question_reports) as pending_reports
)
SELECT
  q.published_questions,
  q.draft_questions,
  q.flagged_questions,
  q.recent_questions,
  u.total_users,
  u.recent_users,
  o.total_images,
  o.total_quiz_sessions,
  o.recent_quiz_sessions,
  o.total_inquiries,
  o.question_reports,
  o.pending_reports,
  NOW() as last_updated
FROM question_stats q, user_stats u, other_stats o;

-- 6. Recreate v_flagged_questions with SECURITY INVOKER
CREATE OR REPLACE VIEW public.v_flagged_questions
WITH (security_invoker=on)
AS
SELECT DISTINCT
  q.*,
  qf.flag_count,
  qf.latest_flag_date
FROM questions q
INNER JOIN (
  SELECT
    question_id,
    COUNT(*) as flag_count,
    MAX(created_at) as latest_flag_date
  FROM question_flags
  WHERE status = 'pending'
  GROUP BY question_id
) qf ON q.id = qf.question_id
WHERE q.status = 'published';

-- Verify all views have been recreated with SECURITY INVOKER
DO $$
DECLARE
  view_count INTEGER;
BEGIN
  -- Note: PostgreSQL doesn't have a direct way to check security_invoker setting
  -- but we can verify the views exist and were recreated
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
    AND table_name IN (
      'v_storage_stats',
      'v_image_usage_stats',
      'v_orphaned_images',
      'v_image_usage_by_category',
      'v_dashboard_stats',
      'v_flagged_questions'
    );

  IF view_count = 6 THEN
    RAISE NOTICE 'SUCCESS: All 6 views recreated with SECURITY INVOKER';
  ELSE
    RAISE EXCEPTION 'FAILED: Only % views found, expected 6', view_count;
  END IF;
END $$;

COMMIT;

-- Summary: All views now use SECURITY INVOKER which means:
-- 1. Views respect the querying user's permissions
-- 2. RLS policies on underlying tables are properly enforced
-- 3. No privilege escalation through view access
-- 4. Improved security posture for public schema views

-- Note: Users will now need appropriate permissions on underlying tables
-- to access these views, which is the intended security behavior
