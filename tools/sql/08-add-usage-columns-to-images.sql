-- Migration: Add usage tracking columns directly to images table
-- This eliminates the need for complex views and provides better performance

-- Add usage tracking columns
ALTER TABLE images ADD COLUMN IF NOT EXISTS usage_count integer DEFAULT 0;
ALTER TABLE images ADD COLUMN IF NOT EXISTS is_orphaned boolean DEFAULT true;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_images_usage_count ON images(usage_count);
CREATE INDEX IF NOT EXISTS idx_images_is_orphaned ON images(is_orphaned);

-- Function to update image usage statistics
CREATE OR REPLACE FUNCTION update_image_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT
  IF TG_OP = 'INSERT' THEN
    UPDATE images 
    SET 
      usage_count = COALESCE((
        SELECT COUNT(*) 
        FROM question_images 
        WHERE image_id = NEW.image_id
      ), 0),
      is_orphaned = NOT EXISTS (
        SELECT 1 
        FROM question_images 
        WHERE image_id = NEW.image_id
      )
    WHERE id = NEW.image_id;
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    UPDATE images 
    SET 
      usage_count = COALESCE((
        SELECT COUNT(*) 
        FROM question_images 
        WHERE image_id = OLD.image_id
      ), 0),
      is_orphaned = NOT EXISTS (
        SELECT 1 
        FROM question_images 
        WHERE image_id = OLD.image_id
      )
    WHERE id = OLD.image_id;
    RETURN OLD;
  END IF;

  -- Handle UPDATE (if image_id changes)
  IF TG_OP = 'UPDATE' AND OLD.image_id != NEW.image_id THEN
    -- Update old image
    UPDATE images 
    SET 
      usage_count = COALESCE((
        SELECT COUNT(*) 
        FROM question_images 
        WHERE image_id = OLD.image_id
      ), 0),
      is_orphaned = NOT EXISTS (
        SELECT 1 
        FROM question_images 
        WHERE image_id = OLD.image_id
      )
    WHERE id = OLD.image_id;
    
    -- Update new image
    UPDATE images 
    SET 
      usage_count = COALESCE((
        SELECT COUNT(*) 
        FROM question_images 
        WHERE image_id = NEW.image_id
      ), 0),
      is_orphaned = NOT EXISTS (
        SELECT 1 
        FROM question_images 
        WHERE image_id = NEW.image_id
      )
    WHERE id = NEW.image_id;
    
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update usage stats
DROP TRIGGER IF EXISTS question_images_usage_trigger ON question_images;
CREATE TRIGGER question_images_usage_trigger
  AFTER INSERT OR UPDATE OR DELETE ON question_images
  FOR EACH ROW
  EXECUTE FUNCTION update_image_usage_stats();

-- Initialize usage stats for existing images
UPDATE images 
SET 
  usage_count = COALESCE((
    SELECT COUNT(*) 
    FROM question_images 
    WHERE image_id = images.id
  ), 0),
  is_orphaned = NOT EXISTS (
    SELECT 1 
    FROM question_images 
    WHERE image_id = images.id
  )
WHERE category != 'external';

-- Update the storage_statistics view to use the new columns
CREATE OR REPLACE VIEW storage_statistics AS
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
  COUNT(*) FILTER (WHERE is_orphaned = true) as orphaned_count,
  COALESCE(SUM(file_size_bytes) FILTER (WHERE is_orphaned = true), 0) as orphaned_size_bytes
FROM images 
WHERE category != 'external';

-- We can now drop the image_usage_stats view since we have the data in the table
DROP VIEW IF EXISTS image_usage_stats;

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'images' 
    AND column_name IN ('usage_count', 'is_orphaned')
  ) THEN
    RAISE NOTICE 'SUCCESS: Images table updated with usage tracking columns';
  ELSE
    RAISE EXCEPTION 'FAILED: Usage tracking columns not added';
  END IF;
END $$;
