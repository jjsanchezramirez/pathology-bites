-- Migration: Enhance images with search vector and metadata
-- Adds full-text search capabilities and image metadata tracking

-- Add new columns for search and metadata
ALTER TABLE images ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE images ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
ALTER TABLE images ADD COLUMN IF NOT EXISTS width integer;
ALTER TABLE images ADD COLUMN IF NOT EXISTS height integer;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_images_search_vector ON images USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_images_file_size ON images(file_size_bytes);
CREATE INDEX IF NOT EXISTS idx_images_dimensions ON images(width, height);

-- Function to update search vector
CREATE OR REPLACE FUNCTION update_images_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.alt_text, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.source_ref, '')), 'C') ||
    setweight(to_tsvector('english', NEW.category), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS images_search_vector_trigger ON images;
CREATE TRIGGER images_search_vector_trigger
  BEFORE INSERT OR UPDATE ON images
  FOR EACH ROW
  EXECUTE FUNCTION update_images_search_vector();

-- Update existing records with search vectors
UPDATE images SET 
  search_vector = 
    setweight(to_tsvector('english', COALESCE(alt_text, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(source_ref, '')), 'C') ||
    setweight(to_tsvector('english', category), 'D')
WHERE search_vector IS NULL;

-- Create a view for image usage analytics
CREATE OR REPLACE VIEW image_usage_stats AS
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
  COALESCE(qi.usage_count, 0) as usage_count,
  CASE WHEN qi.usage_count IS NULL OR qi.usage_count = 0 THEN true ELSE false END as is_orphaned,
  qi.question_ids
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

-- Create a view for storage statistics
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
  COUNT(*) FILTER (WHERE id NOT IN (SELECT DISTINCT image_id FROM question_images)) as orphaned_count,
  COALESCE(SUM(file_size_bytes) FILTER (WHERE id NOT IN (SELECT DISTINCT image_id FROM question_images)), 0) as orphaned_size_bytes
FROM images 
WHERE category != 'external';

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'images' 
    AND column_name IN ('search_vector', 'file_size_bytes', 'width', 'height')
  ) THEN
    RAISE NOTICE 'SUCCESS: Images table enhanced with search and metadata columns';
  ELSE
    RAISE EXCEPTION 'FAILED: Images table enhancement not completed';
  END IF;
END $$;
