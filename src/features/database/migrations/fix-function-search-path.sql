-- Fix Function Search Path Mutable Security Warnings
-- This migration adds explicit search_path to functions to prevent search path hijacking attacks

-- Fix 1: handle_auth_user_deleted function
-- This function is called when a user is deleted from auth.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth  -- Explicitly set search_path for security
AS $function$
BEGIN
  -- Delete from public.user_settings first (has FK to public.users)
  DELETE FROM public.user_settings WHERE user_id = OLD.id;
  
  -- Then delete from public.users
  DELETE FROM public.users WHERE id = OLD.id;
  
  RETURN OLD;
END;
$function$;

-- Add comment to document the security fix
COMMENT ON FUNCTION public.handle_auth_user_deleted() IS 
  'Trigger function to cascade delete user data when auth.users record is deleted. Uses explicit search_path for security.';


-- Fix 2: create_question_version_simplified function
-- This function creates a new version snapshot of a question
CREATE OR REPLACE FUNCTION public.create_question_version_simplified(
  question_id_param uuid, 
  change_summary_param text, 
  changed_by_param uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth  -- Explicitly set search_path for security
AS $function$
DECLARE
  current_major INTEGER;
  current_minor INTEGER;
  current_patch INTEGER;
  new_minor INTEGER;
  new_patch INTEGER;
  new_version_string TEXT;
  question_data JSONB;
  version_id UUID;
BEGIN
  -- Get current version numbers
  SELECT version_major, version_minor, version_patch
  INTO current_major, current_minor, current_patch
  FROM questions
  WHERE id = question_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;
  
  -- Simple versioning: just increment minor version for all changes
  new_minor := current_minor + 1;
  new_patch := 0;
  new_version_string := current_major || '.' || new_minor || '.' || new_patch;
  
  -- Update question version numbers AND version text field
  UPDATE questions
  SET 
    version = new_version_string,
    version_minor = new_minor,
    version_patch = new_patch,
    updated_at = NOW(),
    updated_by = COALESCE(changed_by_param, auth.uid())
  WHERE id = question_id_param;
  
  -- Get complete question data for snapshot
  SELECT get_question_snapshot_data(question_id_param) INTO question_data;
  
  -- Create version snapshot with simplified update type
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
    current_major,
    new_minor,
    new_patch,
    new_version_string,
    question_data,
    'minor',
    change_summary_param,
    COALESCE(changed_by_param, auth.uid())
  ) RETURNING id INTO version_id;
  
  RETURN version_id;
END;
$function$;

-- Add comment to document the security fix
COMMENT ON FUNCTION public.create_question_version_simplified(uuid, text, uuid) IS 
  'Creates a new version snapshot of a question with simplified versioning. Uses explicit search_path for security.';

