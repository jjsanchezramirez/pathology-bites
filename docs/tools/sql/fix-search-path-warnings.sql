-- Fix Function Search Path Security Warnings
-- Addresses Supabase linter warnings for functions with mutable search paths
-- Date: 2025-01-07

BEGIN;

-- 1. Fix update_questions_search_vector function
-- This function updates the search vector for questions table
CREATE OR REPLACE FUNCTION public.update_questions_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.stem, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.teaching_point, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.explanation, '')), 'D');
  
  RETURN NEW;
END;
$$;

-- 2. Fix create_question_version function
-- This function creates version snapshots for questions
CREATE OR REPLACE FUNCTION public.create_question_version(
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

  -- Update question version numbers
  UPDATE questions
  SET 
    version_major = new_major,
    version_minor = new_minor,
    version_patch = new_patch,
    update_type = version_type_param,
    change_summary = change_summary_param,
    current_editor_id = auth.uid(),
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
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_questions_search_vector() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_question_version(UUID, TEXT, TEXT) TO authenticated;

-- Verify the functions now have search_path set
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('update_questions_search_vector', 'create_question_version')
    AND p.proconfig IS NOT NULL
    AND 'search_path=public' = ANY(p.proconfig);
    
  IF func_count < 2 THEN
    RAISE EXCEPTION 'Not all functions have search_path set correctly. Expected 2, found %', func_count;
  END IF;
  
  RAISE NOTICE 'Successfully fixed search_path for % functions', func_count;
END;
$$;

COMMIT;
