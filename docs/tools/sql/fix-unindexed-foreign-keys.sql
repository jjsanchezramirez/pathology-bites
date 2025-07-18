-- Fix Unindexed Foreign Keys Performance Issues
-- Addresses Supabase linter warnings for foreign keys without covering indexes
-- Date: 2025-01-07

BEGIN;

-- 1. Add missing foreign key constraint and index for images.created_by
-- First, add the foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'images_created_by_fkey' 
    AND table_name = 'images'
  ) THEN
    ALTER TABLE images ADD CONSTRAINT images_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

-- Create index for images.created_by foreign key
CREATE INDEX IF NOT EXISTS idx_images_created_by ON images(created_by);

-- 2. Add index for performance_analytics.category_id foreign key
CREATE INDEX IF NOT EXISTS idx_performance_analytics_category_id ON performance_analytics(category_id);

-- 3. Add indexes for question_flags foreign keys
CREATE INDEX IF NOT EXISTS idx_question_flags_flagged_by ON question_flags(flagged_by);
CREATE INDEX IF NOT EXISTS idx_question_flags_question_id ON question_flags(question_id);
CREATE INDEX IF NOT EXISTS idx_question_flags_resolved_by ON question_flags(resolved_by);

-- 4. Add index for question_images.image_id foreign key
-- Note: question_id already has an index (idx_question_images_question)
CREATE INDEX IF NOT EXISTS idx_question_images_image_id ON question_images(image_id);

-- 5. Add index for question_reviews.reviewer_id foreign key
-- Note: question_id already has an index (idx_question_reviews_question_date)
CREATE INDEX IF NOT EXISTS idx_question_reviews_reviewer_id ON question_reviews(reviewer_id);

-- 6. Create composite indexes for common query patterns
-- These optimize queries that filter by multiple foreign key columns

-- Question flags by status and question (for admin review workflows)
CREATE INDEX IF NOT EXISTS idx_question_flags_question_status ON question_flags(question_id, status);

-- Question flags by user and status (for user flag history)
CREATE INDEX IF NOT EXISTS idx_question_flags_user_status ON question_flags(flagged_by, status);

-- Question images by image and section (for image usage tracking)
CREATE INDEX IF NOT EXISTS idx_question_images_image_section ON question_images(image_id, question_section);

-- Performance analytics by user and category (for user performance by category)
CREATE INDEX IF NOT EXISTS idx_performance_analytics_user_category ON performance_analytics(user_id, category_id);

-- Question reviews by reviewer and date (for reviewer activity tracking)
CREATE INDEX IF NOT EXISTS idx_question_reviews_reviewer_date ON question_reviews(reviewer_id, created_at DESC);

-- 7. Verify all foreign key indexes are created
DO $$
DECLARE
  missing_indexes TEXT[] := ARRAY[]::TEXT[];
  index_exists BOOLEAN;
BEGIN
  -- Check each required index
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_images_created_by'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_images_created_by');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_performance_analytics_category_id'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_performance_analytics_category_id');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_question_flags_flagged_by'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_question_flags_flagged_by');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_question_flags_question_id'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_question_flags_question_id');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_question_flags_resolved_by'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_question_flags_resolved_by');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_question_images_image_id'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_question_images_image_id');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_question_reviews_reviewer_id'
  ) INTO index_exists;
  IF NOT index_exists THEN
    missing_indexes := array_append(missing_indexes, 'idx_question_reviews_reviewer_id');
  END IF;

  -- Report results
  IF array_length(missing_indexes, 1) > 0 THEN
    RAISE EXCEPTION 'Missing indexes: %', array_to_string(missing_indexes, ', ');
  ELSE
    RAISE NOTICE 'All foreign key indexes created successfully';
  END IF;
END $$;

COMMIT;
