-- Migration: Fix Function Search Paths
-- This migration adds SET search_path = public to functions with mutable search paths
-- Addresses Supabase Security Advisor WARN: Function Search Path Mutable

BEGIN;

-- 1. Fix update_questions_search_vector function
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

-- 2. Fix calculate_question_analytics function
CREATE OR REPLACE FUNCTION public.calculate_question_analytics(question_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flag_count INTEGER;
  review_count INTEGER;
  avg_rating DECIMAL;
  last_activity TIMESTAMPTZ;
BEGIN
  -- Calculate flag count
  SELECT COUNT(*) INTO flag_count
  FROM question_flags
  WHERE question_id = question_id_param;
  
  -- Calculate review count
  SELECT COUNT(*) INTO review_count
  FROM question_reviews
  WHERE question_id = question_id_param;
  
  -- Calculate average rating (if reviews exist)
  SELECT AVG(rating) INTO avg_rating
  FROM question_reviews
  WHERE question_id = question_id_param AND rating IS NOT NULL;
  
  -- Get last activity timestamp
  SELECT GREATEST(
    COALESCE(MAX(qf.created_at), '1970-01-01'::timestamptz),
    COALESCE(MAX(qr.created_at), '1970-01-01'::timestamptz)
  ) INTO last_activity
  FROM question_flags qf
  FULL OUTER JOIN question_reviews qr ON qf.question_id = qr.question_id
  WHERE COALESCE(qf.question_id, qr.question_id) = question_id_param;
  
  -- Insert or update analytics
  INSERT INTO question_analytics (
    question_id, flag_count, review_count, avg_rating, last_activity, updated_at
  ) VALUES (
    question_id_param, flag_count, review_count, avg_rating, last_activity, NOW()
  )
  ON CONFLICT (question_id) DO UPDATE SET
    flag_count = EXCLUDED.flag_count,
    review_count = EXCLUDED.review_count,
    avg_rating = EXCLUDED.avg_rating,
    last_activity = EXCLUDED.last_activity,
    updated_at = NOW();
END;
$$;

-- 3. Fix recalculate_all_question_analytics function
CREATE OR REPLACE FUNCTION public.recalculate_all_question_analytics()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  question_record RECORD;
BEGIN
  FOR question_record IN SELECT id FROM questions LOOP
    PERFORM calculate_question_analytics(question_record.id);
  END LOOP;
END;
$$;

-- 4. Fix trigger_update_question_analytics function
CREATE OR REPLACE FUNCTION public.trigger_update_question_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_question_analytics(NEW.question_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM calculate_question_analytics(OLD.question_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 5. Fix trigger_update_question_analytics_flags_reviews function
CREATE OR REPLACE FUNCTION public.trigger_update_question_analytics_flags_reviews()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM calculate_question_analytics(NEW.question_id);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM calculate_question_analytics(OLD.question_id);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- 6. Fix update_images_search_vector function
CREATE OR REPLACE FUNCTION public.update_images_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('english', COALESCE(NEW.alt_text, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.source_ref, '')), 'C');
  
  RETURN NEW;
END;
$$;

-- 7. Fix handle_deleted_user function
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete user record when auth user is deleted
  DELETE FROM users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

-- 8. Fix select_demo_questions function
CREATE OR REPLACE FUNCTION public.select_demo_questions(limit_count INTEGER DEFAULT 10)
RETURNS TABLE(
  id UUID,
  title TEXT,
  stem TEXT,
  status TEXT,
  category TEXT,
  difficulty TEXT,
  display_order INTEGER
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
    q.status,
    q.category,
    q.difficulty,
    q.display_order
  FROM questions q
  WHERE q.status = 'published'
    AND q.display_order IS NOT NULL
  ORDER BY q.display_order ASC
  LIMIT limit_count;
END;
$$;

-- 9. Fix create_question_version function
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
  new_version_id UUID;
  question_data JSONB;
BEGIN
  -- Get current question data
  SELECT to_jsonb(q.*) INTO question_data
  FROM questions q
  WHERE id = question_id_param;

  -- Create new version
  INSERT INTO question_versions (
    question_id,
    version_type,
    change_summary,
    question_data,
    created_by
  ) VALUES (
    question_id_param,
    version_type_param,
    change_summary_param,
    question_data,
    auth.uid()
  ) RETURNING id INTO new_version_id;

  RETURN new_version_id;
END;
$$;

-- 10. Fix is_admin function
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id
    AND role = 'admin'
  );
END;
$$;

-- 11. Fix is_current_user_admin function
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 12. Fix create_audit_logs_table function
CREATE OR REPLACE FUNCTION public.create_audit_logs_table()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is likely deprecated, but fixing for security
  RAISE NOTICE 'create_audit_logs_table function called - consider removing if unused';
END;
$$;

-- 13. Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 14. Fix handle_new_user function (already has search_path but ensuring consistency)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
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

-- Verify all functions have search_path set
DO $$
DECLARE
  func_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'update_questions_search_vector',
      'calculate_question_analytics',
      'recalculate_all_question_analytics',
      'trigger_update_question_analytics',
      'trigger_update_question_analytics_flags_reviews',
      'update_images_search_vector',
      'handle_deleted_user',
      'select_demo_questions',
      'create_question_version',
      'is_admin',
      'is_current_user_admin',
      'create_audit_logs_table',
      'update_updated_at_column',
      'handle_new_user'
    )
    AND p.proconfig IS NOT NULL
    AND 'search_path=public' = ANY(p.proconfig);

  IF func_count = 14 THEN
    RAISE NOTICE 'SUCCESS: All 14 functions now have search_path = public';
  ELSE
    RAISE EXCEPTION 'FAILED: Only % functions have search_path set, expected 14', func_count;
  END IF;
END $$;

COMMIT;

-- Note: All functions now have SET search_path = public for security
-- This prevents search path injection attacks and ensures consistent behavior
