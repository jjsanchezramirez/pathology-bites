-- Question Creation and Versioning System Migration
-- This migration implements the complete question versioning system with semantic versioning
-- and efficient flagged question handling

-- Step 1: Update question status constraint to include new states
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_status_check;
ALTER TABLE questions ADD CONSTRAINT questions_status_check 
CHECK (status IN ('draft', 'under_review', 'published', 'rejected', 'pending_major_edits', 'pending_minor_edits', 'archived'));

-- Step 2: Add semantic versioning columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS version_major INTEGER DEFAULT 1;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS version_minor INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS version_patch INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS version_string TEXT GENERATED ALWAYS AS 
  (version_major || '.' || version_minor || '.' || version_patch) STORED;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS change_summary TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS update_type TEXT CHECK (update_type IN ('patch', 'minor', 'major'));
ALTER TABLE questions ADD COLUMN IF NOT EXISTS original_creator_id UUID REFERENCES users(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS current_editor_id UUID REFERENCES users(id);

-- Step 3: Set initial values for existing questions
UPDATE questions SET 
  original_creator_id = created_by,
  current_editor_id = created_by
WHERE original_creator_id IS NULL;

-- Step 4: Update question_versions table structure for semantic versioning
-- First, check if we need to migrate existing data
DO $$
BEGIN
  -- Check if old structure exists
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_versions' AND column_name = 'version_number') THEN
    -- Create temporary table with new structure
    CREATE TABLE question_versions_new (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      
      -- Semantic version numbers
      version_major INTEGER NOT NULL,
      version_minor INTEGER NOT NULL,
      version_patch INTEGER NOT NULL,
      version_string TEXT NOT NULL,
      
      -- Complete question snapshot as JSON
      question_data JSONB NOT NULL,
      
      -- Change tracking
      update_type TEXT NOT NULL CHECK (update_type IN ('patch', 'minor', 'major')),
      change_summary TEXT,
      changed_by UUID NOT NULL REFERENCES users(id),
      
      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      UNIQUE(question_id, version_major, version_minor, version_patch)
    );
    
    -- Migrate existing data (convert old version_number to semantic versioning)
    INSERT INTO question_versions_new (
      question_id, version_major, version_minor, version_patch, version_string,
      question_data, update_type, change_summary, changed_by, created_at
    )
    SELECT 
      question_id,
      CASE WHEN version_number = 1 THEN 1 ELSE version_number END as version_major,
      0 as version_minor,
      0 as version_patch,
      CASE WHEN version_number = 1 THEN '1.0.0' ELSE version_number || '.0.0' END as version_string,
      content as question_data,
      'major' as update_type,
      'Migrated from old versioning system' as change_summary,
      created_by as changed_by,
      created_at
    FROM question_versions;
    
    -- Drop old table and rename new one
    DROP TABLE question_versions;
    ALTER TABLE question_versions_new RENAME TO question_versions;
  ELSE
    -- Table doesn't exist or already has new structure, create it
    CREATE TABLE IF NOT EXISTS question_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      
      -- Semantic version numbers
      version_major INTEGER NOT NULL,
      version_minor INTEGER NOT NULL,
      version_patch INTEGER NOT NULL,
      version_string TEXT NOT NULL,
      
      -- Complete question snapshot as JSON
      question_data JSONB NOT NULL,
      
      -- Change tracking
      update_type TEXT NOT NULL CHECK (update_type IN ('patch', 'minor', 'major')),
      change_summary TEXT,
      changed_by UUID NOT NULL REFERENCES users(id),
      
      -- Metadata
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      
      -- Constraints
      UNIQUE(question_id, version_major, version_minor, version_patch)
    );
  END IF;
END $$;

-- Step 5: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_question_versions_question_id_version ON question_versions(question_id, version_major DESC, version_minor DESC, version_patch DESC);
CREATE INDEX IF NOT EXISTS idx_questions_version_string ON questions(version_string);
CREATE INDEX IF NOT EXISTS idx_questions_original_creator ON questions(original_creator_id);
CREATE INDEX IF NOT EXISTS idx_questions_current_editor ON questions(current_editor_id);

-- Step 6: Create view for flagged questions (questions with pending flags)
CREATE OR REPLACE VIEW v_flagged_questions AS
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

-- Step 7: Create function for atomic version updates
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
  version_id UUID;
  current_major INTEGER;
  current_minor INTEGER;
  current_patch INTEGER;
  new_major INTEGER;
  new_minor INTEGER;
  new_patch INTEGER;
BEGIN
  -- Validate update type
  IF update_type_param NOT IN ('patch', 'minor', 'major') THEN
    RAISE EXCEPTION 'Invalid update type. Must be patch, minor, or major.';
  END IF;

  -- Lock the question row and get current version
  SELECT version_major, version_minor, version_patch
  INTO current_major, current_minor, current_patch
  FROM questions
  WHERE id = question_id_param
  FOR UPDATE;

  -- Calculate new version numbers
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
  END CASE;

  -- Update question version numbers
  UPDATE questions SET
    version_major = new_major,
    version_minor = new_minor,
    version_patch = new_patch,
    update_type = update_type_param,
    change_summary = change_summary_param,
    current_editor_id = auth.uid(),
    updated_at = NOW()
  WHERE id = question_id_param;

  -- Create version snapshot if question data provided
  IF question_data_param IS NOT NULL THEN
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
      question_data_param,
      update_type_param,
      change_summary_param,
      auth.uid()
    ) RETURNING id INTO version_id;
  END IF;

  RETURN version_id;
END $$;

-- Step 8: Create function to get complete question data for snapshots
CREATE OR REPLACE FUNCTION get_question_snapshot_data(question_id_param UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question_data JSONB;
BEGIN
  SELECT jsonb_build_object(
    'question', to_jsonb(q.*),
    'question_options', COALESCE(qo.options, '[]'::jsonb),
    'question_images', COALESCE(qi.images, '[]'::jsonb),
    'question_tags', COALESCE(qt.tags, '[]'::jsonb),
    'category', COALESCE(to_jsonb(c.*), 'null'::jsonb),
    'question_set', COALESCE(to_jsonb(s.*), 'null'::jsonb)
  ) INTO question_data
  FROM questions q
  LEFT JOIN (
    SELECT question_id, jsonb_agg(to_jsonb(qo.*)) as options
    FROM question_options qo
    GROUP BY question_id
  ) qo ON q.id = qo.question_id
  LEFT JOIN (
    SELECT qi.question_id, jsonb_agg(
      jsonb_build_object(
        'question_image', to_jsonb(qi.*),
        'image', to_jsonb(i.*)
      )
    ) as images
    FROM question_images qi
    LEFT JOIN images i ON qi.image_id = i.id
    GROUP BY qi.question_id
  ) qi ON q.id = qi.question_id
  LEFT JOIN (
    SELECT qt.question_id, jsonb_agg(to_jsonb(t.*)) as tags
    FROM questions_tags qt
    LEFT JOIN tags t ON qt.tag_id = t.id
    GROUP BY qt.question_id
  ) qt ON q.id = qt.question_id
  LEFT JOIN categories c ON q.category_id = c.id
  LEFT JOIN sets s ON q.question_set_id = s.id
  WHERE q.id = question_id_param;

  RETURN question_data;
END $$;
