-- Fix Function Search Path Security Issues
-- This script addresses the "Function Search Path Mutable" warnings by setting secure search paths

-- 1. Fix update_questions_search_vector function
CREATE OR REPLACE FUNCTION public.update_questions_search_vector()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.stem, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.teaching_point, '')), 'C');
  RETURN NEW;
END;
$$;

-- 2. Fix handle_deleted_user function
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up user-related data when a user is deleted
  DELETE FROM quiz_sessions WHERE user_id = OLD.id;
  DELETE FROM quiz_attempts WHERE user_id = OLD.id;
  DELETE FROM question_flags WHERE flagged_by = OLD.id;
  DELETE FROM question_reviews WHERE reviewer_id = OLD.id;
  DELETE FROM audit_logs WHERE user_id = OLD.id;
  
  RETURN OLD;
END;
$$;

-- 3. Fix select_demo_questions function
CREATE OR REPLACE FUNCTION public.select_demo_questions(
  question_limit integer DEFAULT 10
)
RETURNS TABLE(
  id uuid,
  title text,
  stem text,
  difficulty text,
  category_id integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    q.id,
    q.title,
    q.stem,
    q.difficulty,
    q.category_id,
    q.created_at
  FROM questions q
  WHERE q.status = 'published' 
    AND q.is_demo = true
  ORDER BY q.created_at DESC
  LIMIT question_limit;
END;
$$;

-- 4. Fix create_question_version function
CREATE OR REPLACE FUNCTION public.create_question_version(
  question_id_param uuid,
  version_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  version_id uuid;
BEGIN
  -- Insert new version record
  INSERT INTO question_versions (
    question_id,
    version_number,
    data,
    created_by,
    created_at
  )
  SELECT 
    question_id_param,
    COALESCE(MAX(version_number), 0) + 1,
    version_data,
    auth.uid(),
    NOW()
  FROM question_versions 
  WHERE question_id = question_id_param
  RETURNING id INTO version_id;
  
  RETURN version_id;
END;
$$;

-- 5. Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = user_id_param;
  
  RETURN user_role = 'admin';
END;
$$;

-- 6. Fix is_current_user_admin function
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM users
  WHERE id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$$;

-- 7. Fix create_audit_logs_table function
CREATE OR REPLACE FUNCTION public.create_audit_logs_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create audit_logs table if it doesn't exist
  CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email text,
    ip_address inet,
    user_agent text,
    risk_level text NOT NULL DEFAULT 'low',
    details jsonb NOT NULL DEFAULT '{}',
    metadata jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT NOW()
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
  
  -- Enable RLS
  ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
END;
$$;

-- 8. Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 9. Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert new user into users table
  INSERT INTO users (
    id,
    email,
    first_name,
    last_name,
    user_type,
    role,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'student'),
    'user', -- Default role
    'active', -- Default status
    NOW(),
    NOW()
  );
  
  RETURN NEW;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.update_questions_search_vector() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_deleted_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.select_demo_questions(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_question_version(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_audit_logs_table() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;
