-- Migration: Add support for external images
-- This allows images to have only id and url (for PathOutlines integration)
-- while keeping existing uploaded images unchanged

-- Make storage_path, file_type, and alt_text nullable for external images
ALTER TABLE images ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE images ALTER COLUMN file_type DROP NOT NULL;
ALTER TABLE images ALTER COLUMN alt_text DROP NOT NULL;

-- Update the existing category check constraint to include 'external'
ALTER TABLE images DROP CONSTRAINT IF EXISTS images_category_check;
ALTER TABLE images ADD CONSTRAINT images_category_check
CHECK (category IN ('microscopic', 'gross', 'figure', 'table', 'external'));

-- Add a check constraint to ensure external images have minimal required fields
-- External images (category = 'external') only need id and url
-- Regular images need storage_path, file_type, and alt_text
ALTER TABLE images ADD CONSTRAINT images_external_check
CHECK (
  (category = 'external' AND url IS NOT NULL) OR
  (category != 'external' AND storage_path IS NOT NULL AND file_type IS NOT NULL AND alt_text IS NOT NULL)
);

-- Create index for external images
CREATE INDEX idx_images_category_external ON images(category) WHERE category = 'external';

-- Verify the migration
DO $$
BEGIN
  -- Check if constraints were modified
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'images' 
    AND column_name IN ('storage_path', 'file_type', 'alt_text')
    AND is_nullable = 'YES'
  ) THEN
    RAISE NOTICE 'SUCCESS: Images table updated to support external images';
  ELSE
    RAISE EXCEPTION 'FAILED: Images table constraints not updated properly';
  END IF;
END $$;
