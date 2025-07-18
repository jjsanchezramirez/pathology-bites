-- Migration: Clean up questions table by removing redundant columns and adding updated_by
-- Date: 2024-12-07
-- Description: 
-- 1. Add updated_by column to questions table (similar to created_by)
-- 2. Remove redundant columns that already exist in question_versions table:
--    - change_summary (exists in question_versions)
--    - update_type (exists in question_versions)  
--    - original_creator_id (redundant with created_by)
--    - current_editor_id (replaced by updated_by)

BEGIN;

-- Step 1: Add updated_by column to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Step 2: Set initial values for updated_by (use created_by as default for existing questions)
UPDATE questions SET updated_by = created_by WHERE updated_by IS NULL;

-- Step 3: Make updated_by NOT NULL after setting initial values
ALTER TABLE questions ALTER COLUMN updated_by SET NOT NULL;

-- Step 4: Create trigger to automatically update updated_by when questions are modified
CREATE OR REPLACE FUNCTION update_questions_updated_by()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set updated_by if it's not already provided (for admin client compatibility)
  IF NEW.updated_by IS NULL THEN
    NEW.updated_by = COALESCE(auth.uid(), OLD.updated_by);
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_by
DROP TRIGGER IF EXISTS questions_updated_by_trigger ON questions;
CREATE TRIGGER questions_updated_by_trigger
  BEFORE UPDATE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION update_questions_updated_by();

-- Step 5: Remove redundant columns that exist in question_versions table
-- First check if columns exist before dropping them
DO $$
BEGIN
    -- Drop change_summary column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'change_summary'
    ) THEN
        ALTER TABLE questions DROP COLUMN change_summary;
        RAISE NOTICE 'Dropped change_summary column from questions table';
    END IF;

    -- Drop update_type column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'update_type'
    ) THEN
        ALTER TABLE questions DROP COLUMN update_type;
        RAISE NOTICE 'Dropped update_type column from questions table';
    END IF;

    -- Drop original_creator_id column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'original_creator_id'
    ) THEN
        ALTER TABLE questions DROP COLUMN original_creator_id;
        RAISE NOTICE 'Dropped original_creator_id column from questions table';
    END IF;

    -- Drop current_editor_id column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'current_editor_id'
    ) THEN
        ALTER TABLE questions DROP COLUMN current_editor_id;
        RAISE NOTICE 'Dropped current_editor_id column from questions table';
    END IF;
END $$;

-- Step 6: Drop related indexes that are no longer needed
DROP INDEX IF EXISTS idx_questions_original_creator;
DROP INDEX IF EXISTS idx_questions_current_editor;

-- Step 7: Create index for the new updated_by column
CREATE INDEX IF NOT EXISTS idx_questions_updated_by ON questions(updated_by);

-- Step 8: Update any views that might reference the removed columns
-- Recreate v_flagged_questions view to ensure it doesn't reference removed columns
CREATE OR REPLACE VIEW v_flagged_questions WITH (security_invoker=on) AS
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

-- Step 9: Update database functions that reference removed columns
-- Fix update_question_version function to not update redundant columns in questions table
CREATE OR REPLACE FUNCTION update_question_version(
  question_id_param UUID,
  update_type_param TEXT,
  change_summary_param TEXT DEFAULT NULL,
  question_data_param JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_major INTEGER;
  current_minor INTEGER;
  current_patch INTEGER;
  new_major INTEGER;
  new_minor INTEGER;
  new_patch INTEGER;
  version_id UUID;
  question_data JSONB;
BEGIN
  -- Get current version numbers
  SELECT version_major, version_minor, version_patch
  INTO current_major, current_minor, current_patch
  FROM questions
  WHERE id = question_id_param
  FOR UPDATE;

  -- Calculate new version numbers based on update type
  CASE update_type_param
    WHEN 'patch' THEN
      new_major := current_major;
      new_minor := current_minor;
      new_patch := current_patch + 1;
    WHEN 'minor' THEN
      new_major := current_major;
      new_minor := current_minor + 1;
      new_patch := 0;
    WHEN 'major' THEN
      new_major := current_major + 1;
      new_minor := 0;
      new_patch := 0;
    ELSE
      RAISE EXCEPTION 'Invalid update type: %. Must be patch, minor, or major', update_type_param;
  END CASE;

  -- Update question version numbers only (removed redundant columns)
  UPDATE questions SET
    version_major = new_major,
    version_minor = new_minor,
    version_patch = new_patch,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = question_id_param;

  -- Get complete question data for snapshot if not provided
  IF question_data_param IS NULL THEN
    SELECT get_question_snapshot_data(question_id_param) INTO question_data;
  ELSE
    question_data := question_data_param;
  END IF;

  -- Create version snapshot if question data provided
  IF question_data IS NOT NULL THEN
    INSERT INTO question_versions (
      question_id,
      version_major,
      version_minor,
      version_patch,
      version_string,
      question_data,
      update_type,
      change_summary,
      changed_by
    ) VALUES (
      question_id_param,
      new_major,
      new_minor,
      new_patch,
      new_major || '.' || new_minor || '.' || new_patch,
      question_data,
      update_type_param,
      change_summary_param,
      auth.uid()
    ) RETURNING id INTO version_id;
  END IF;

  RETURN version_id;
END $$;

-- Fix create_question_version function to not update redundant columns in questions table
CREATE OR REPLACE FUNCTION create_question_version(
  question_id_param UUID,
  version_type_param TEXT,
  change_summary_param TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_major INTEGER;
  current_minor INTEGER;
  current_patch INTEGER;
  new_major INTEGER;
  new_minor INTEGER;
  new_patch INTEGER;
  version_id UUID;
  question_data JSONB;
BEGIN
  -- Get current version numbers
  SELECT version_major, version_minor, version_patch
  INTO current_major, current_minor, current_patch
  FROM questions
  WHERE id = question_id_param
  FOR UPDATE;

  -- Calculate new version numbers based on update type
  CASE version_type_param
    WHEN 'patch' THEN
      new_major := current_major;
      new_minor := current_minor;
      new_patch := current_patch + 1;
    WHEN 'minor' THEN
      new_major := current_major;
      new_minor := current_minor + 1;
      new_patch := 0;
    WHEN 'major' THEN
      new_major := current_major + 1;
      new_minor := 0;
      new_patch := 0;
    ELSE
      RAISE EXCEPTION 'Invalid version type: %. Must be patch, minor, or major', version_type_param;
  END CASE;

  -- Update question version numbers only (removed redundant columns)
  UPDATE questions
  SET
    version_major = new_major,
    version_minor = new_minor,
    version_patch = new_patch,
    updated_by = auth.uid(),
    updated_at = NOW()
  WHERE id = question_id_param;

  -- Get complete question data for snapshot
  SELECT get_question_snapshot_data(question_id_param) INTO question_data;

  -- Create version record
  INSERT INTO question_versions (
    question_id,
    version_major,
    version_minor,
    version_patch,
    version_string,
    question_data,
    update_type,
    change_summary,
    changed_by
  ) VALUES (
    question_id_param,
    new_major,
    new_minor,
    new_patch,
    new_major || '.' || new_minor || '.' || new_patch,
    question_data,
    version_type_param,
    change_summary_param,
    auth.uid()
  ) RETURNING id INTO version_id;

  RETURN version_id;
END $$;

-- Step 10: Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_questions_updated_by() TO authenticated;
GRANT EXECUTE ON FUNCTION update_question_version(UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_question_version(UUID, TEXT, TEXT) TO authenticated;

-- Step 11: Verify the migration
DO $$
DECLARE
    remaining_count INTEGER;
    updated_by_exists BOOLEAN;
BEGIN
    -- Check if redundant columns were removed
    SELECT COUNT(*) INTO remaining_count
    FROM information_schema.columns 
    WHERE table_name = 'questions' 
    AND column_name IN ('change_summary', 'update_type', 'original_creator_id', 'current_editor_id');
    
    -- Check if updated_by column was added
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'updated_by'
    ) INTO updated_by_exists;
    
    IF remaining_count = 0 AND updated_by_exists THEN
        RAISE NOTICE 'SUCCESS: Questions table cleanup completed successfully';
        RAISE NOTICE '- Added updated_by column';
        RAISE NOTICE '- Removed redundant columns: change_summary, update_type, original_creator_id, current_editor_id';
        RAISE NOTICE '- Created trigger for automatic updated_by updates';
    ELSE
        IF remaining_count > 0 THEN
            RAISE WARNING 'WARNING: % redundant columns still remain in questions table', remaining_count;
        END IF;
        IF NOT updated_by_exists THEN
            RAISE WARNING 'WARNING: updated_by column was not created';
        END IF;
    END IF;
END $$;

COMMIT;

-- Note: After running this migration, you will need to update:
-- 1. TypeScript types to remove references to deleted columns and add updated_by
-- 2. Application queries to use updated_by instead of current_editor_id
-- 3. Components that display editor information to use updated_by
-- 4. Any database functions that reference the removed columns
