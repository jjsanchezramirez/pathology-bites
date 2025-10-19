-- Create materialized view for public stats
-- This provides fast access to public-facing statistics without expensive queries

-- Drop existing view if it exists
DROP MATERIALIZED VIEW IF EXISTS v_public_stats CASCADE;

-- Create materialized view for public stats
CREATE MATERIALIZED VIEW v_public_stats AS
SELECT
  -- Total questions count (ALL statuses)
  (SELECT COUNT(*) FROM questions)::integer AS total_questions,

  -- Total images count
  (SELECT COUNT(*) FROM images)::integer AS total_images,

  -- Unique categories count (from ALL questions)
  (SELECT COUNT(DISTINCT category_id)
   FROM questions
   WHERE category_id IS NOT NULL)::integer AS total_categories,

  -- Timestamp for cache invalidation
  NOW() AS last_refreshed;

-- Create unique index for faster access (materialized views need at least one unique index for concurrent refresh)
CREATE UNIQUE INDEX idx_v_public_stats_singleton ON v_public_stats ((1));

-- Grant access to authenticated and anon users
GRANT SELECT ON v_public_stats TO authenticated, anon;

-- Add comment
COMMENT ON MATERIALIZED VIEW v_public_stats IS 'Materialized view for public statistics - refreshed periodically for performance';

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_public_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_public_stats;
END;
$$;

-- Grant execute permission to authenticated users (for manual refresh if needed)
GRANT EXECUTE ON FUNCTION refresh_public_stats() TO authenticated;

-- Add comment
COMMENT ON FUNCTION refresh_public_stats() IS 'Refreshes the public stats materialized view - should be called when questions/images/categories change';

-- Create trigger function to auto-refresh stats when questions are approved/created/deleted
CREATE OR REPLACE FUNCTION trigger_refresh_public_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Refresh the materialized view asynchronously
  -- Note: In production, you might want to use pg_cron or a scheduled job instead
  PERFORM refresh_public_stats();
  RETURN NULL;
END;
$$;

-- Create triggers on questions table
DROP TRIGGER IF EXISTS trigger_questions_refresh_public_stats ON questions;
CREATE TRIGGER trigger_questions_refresh_public_stats
  AFTER INSERT OR UPDATE OR DELETE ON questions
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_public_stats();

-- Create triggers on images table
DROP TRIGGER IF EXISTS trigger_images_refresh_public_stats ON images;
CREATE TRIGGER trigger_images_refresh_public_stats
  AFTER INSERT OR DELETE ON images
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_public_stats();

-- Initial refresh
REFRESH MATERIALIZED VIEW v_public_stats;

