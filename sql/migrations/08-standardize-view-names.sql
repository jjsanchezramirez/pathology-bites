-- Migration: Standardize view names with v_ prefix
-- This creates a consistent naming convention for all views

-- Drop existing views
DROP VIEW IF EXISTS image_usage_stats;
DROP VIEW IF EXISTS storage_statistics;

-- Create standardized views with v_ prefix

-- View: Image usage statistics with all metadata
CREATE VIEW v_image_usage_stats AS
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

-- View: Storage statistics summary
CREATE VIEW v_storage_stats AS
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

-- View: Orphaned images (for cleanup operations)
CREATE VIEW v_orphaned_images AS
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

-- View: Image usage by category (for analytics)
CREATE VIEW v_image_usage_by_category AS
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

-- View: Recent image activity (for monitoring)
CREATE VIEW v_recent_image_activity AS
SELECT 
  i.id,
  i.alt_text,
  i.category,
  i.file_size_bytes,
  i.created_at,
  COALESCE(qi.usage_count, 0) as usage_count,
  CASE WHEN qi.usage_count IS NULL OR qi.usage_count = 0 THEN true ELSE false END as is_orphaned
FROM images i
LEFT JOIN (
  SELECT 
    image_id,
    COUNT(*) as usage_count
  FROM question_images 
  GROUP BY image_id
) qi ON i.id = qi.image_id
WHERE i.category != 'external'
  AND i.created_at >= NOW() - INTERVAL '30 days'
ORDER BY i.created_at DESC;

-- Grant permissions (if needed)
-- GRANT SELECT ON v_image_usage_stats TO authenticated;
-- GRANT SELECT ON v_storage_stats TO authenticated;
-- GRANT SELECT ON v_orphaned_images TO authenticated;
-- GRANT SELECT ON v_image_usage_by_category TO authenticated;
-- GRANT SELECT ON v_recent_image_activity TO authenticated;

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name LIKE 'v_%' 
    AND table_schema = 'public'
  ) THEN
    RAISE NOTICE 'SUCCESS: Standardized views created with v_ prefix';
  ELSE
    RAISE EXCEPTION 'FAILED: Views not created properly';
  END IF;
END $$;
