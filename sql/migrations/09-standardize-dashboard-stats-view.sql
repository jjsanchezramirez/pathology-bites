-- Migration: Standardize dashboard_stats to v_dashboard_stats
-- This follows the v_ naming convention for all views
-- Note: dashboard_stats was a materialized view, converting to regular view

-- Drop existing materialized view (not regular view)
DROP MATERIALIZED VIEW IF EXISTS dashboard_stats;

-- Create standardized view with v_ prefix
CREATE VIEW v_dashboard_stats AS
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
    (SELECT COUNT(*) FROM images) as total_images,
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

-- Grant permissions (if needed)
-- GRANT SELECT ON v_dashboard_stats TO authenticated;

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'v_dashboard_stats' 
    AND table_schema = 'public'
  ) THEN
    RAISE NOTICE 'SUCCESS: Dashboard stats view standardized to v_dashboard_stats';
  ELSE
    RAISE EXCEPTION 'FAILED: v_dashboard_stats view not created';
  END IF;
END $$;
