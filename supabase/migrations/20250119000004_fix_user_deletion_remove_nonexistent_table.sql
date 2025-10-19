-- Fix user deletion functions to remove reference to non-existent user_learning_path_enrollments table
-- This table does not exist in the schema, so the DELETE statement was causing errors

-- Update handle_user_deletion to only delete from tables that actually exist
CREATE OR REPLACE FUNCTION public.handle_user_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Delete from all user-related tables (bypasses RLS)
  -- Only includes tables with user_id foreign key that should be CASCADE deleted
  DELETE FROM user_settings WHERE user_id = OLD.id;
  DELETE FROM user_favorites WHERE user_id = OLD.id;
  DELETE FROM user_achievements WHERE user_id = OLD.id;
  DELETE FROM performance_analytics WHERE user_id = OLD.id;
  DELETE FROM notification_states WHERE user_id = OLD.id;
  DELETE FROM quiz_sessions WHERE user_id = OLD.id;
  DELETE FROM quiz_attempts WHERE user_id = OLD.id;
  DELETE FROM module_sessions WHERE user_id = OLD.id;
  DELETE FROM module_attempts WHERE user_id = OLD.id;
  DELETE FROM user_learning WHERE user_id = OLD.id;
  
  RETURN OLD;
END;
$function$;

-- Update handle_auth_user_deletion to match
CREATE OR REPLACE FUNCTION public.handle_auth_user_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DECLARE
    user_role user_role;
  BEGIN
    -- Get the user's role from public.users
    SELECT role INTO user_role FROM public.users WHERE id = OLD.id;
    
    -- If user role is admin, creator, or reviewer: SOFT DELETE
    -- Otherwise (student/user): HARD DELETE
    IF user_role IN ('admin', 'creator', 'reviewer') THEN
      -- Soft delete: mark as deleted but keep record for attribution
      UPDATE public.users 
      SET 
        deleted_at = NOW(),
        status = 'deleted',
        updated_at = NOW()
      WHERE id = OLD.id;
    ELSE
      -- Hard delete: explicitly delete from all user-related tables first (bypasses RLS)
      DELETE FROM user_settings WHERE user_id = OLD.id;
      DELETE FROM user_favorites WHERE user_id = OLD.id;
      DELETE FROM user_achievements WHERE user_id = OLD.id;
      DELETE FROM performance_analytics WHERE user_id = OLD.id;
      DELETE FROM notification_states WHERE user_id = OLD.id;
      DELETE FROM quiz_sessions WHERE user_id = OLD.id;
      DELETE FROM quiz_attempts WHERE user_id = OLD.id;
      DELETE FROM module_sessions WHERE user_id = OLD.id;
      DELETE FROM module_attempts WHERE user_id = OLD.id;
      DELETE FROM user_learning WHERE user_id = OLD.id;
      
      -- Then delete the user record
      DELETE FROM public.users WHERE id = OLD.id;
    END IF;
    
    RETURN OLD;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_auth_user_deletion: %', SQLERRM;
    RETURN OLD;
  END;
END;
$function$;

-- Add comments
COMMENT ON FUNCTION handle_user_deletion() IS 
'Trigger function that explicitly deletes from all user-related tables when a user is deleted from public.users. Uses SECURITY DEFINER to bypass RLS policies. Only deletes from tables with user_id foreign key (CASCADE delete). Tables with created_by/reviewed_by/etc use SET NULL.';

COMMENT ON FUNCTION handle_auth_user_deletion() IS 
'Trigger function that handles user deletion from auth.users. For admin/creator/reviewer: soft delete (sets deleted_at, status=deleted). For student/user: hard delete (removes all data). Uses SECURITY DEFINER to bypass RLS policies.';

