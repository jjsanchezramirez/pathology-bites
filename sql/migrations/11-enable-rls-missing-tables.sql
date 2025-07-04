-- Migration: Enable RLS on missing tables
-- This migration enables Row Level Security on tables that were missing RLS policies
-- Addresses Supabase Security Advisor ERROR: RLS Disabled in Public

BEGIN;

-- 1. Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for audit_logs
-- Only admins can view audit logs
CREATE POLICY "audit_logs_admin_select" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Only system can insert audit logs (via triggers/functions)
CREATE POLICY "audit_logs_system_insert" ON audit_logs
  FOR INSERT
  WITH CHECK (false); -- No direct inserts allowed

-- No updates or deletes allowed on audit logs
-- (Audit logs should be immutable)

-- 2. Enable RLS on question_analytics table
ALTER TABLE question_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for question_analytics
-- Admins and reviewers can view all analytics
CREATE POLICY "question_analytics_admin_reviewer_select" ON question_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'reviewer')
    )
  );

-- Only system can insert/update analytics (via triggers/functions)
CREATE POLICY "question_analytics_system_insert" ON question_analytics
  FOR INSERT
  WITH CHECK (false); -- No direct inserts allowed

CREATE POLICY "question_analytics_system_update" ON question_analytics
  FOR UPDATE
  USING (false); -- No direct updates allowed

-- No deletes allowed on analytics
-- (Analytics should be preserved for historical data)

-- 3. Enable RLS on question_versions table
ALTER TABLE question_versions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for question_versions
-- Admins can view all versions
CREATE POLICY "question_versions_admin_select" ON question_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Reviewers can view versions of questions they're reviewing
CREATE POLICY "question_versions_reviewer_select" ON question_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'reviewer'
    )
    AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_versions.question_id
      AND q.status IN ('draft', 'pending_review')
    )
  );

-- Creators can view versions of their own questions
CREATE POLICY "question_versions_creator_own_select" ON question_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'creator'
    )
    AND EXISTS (
      SELECT 1 FROM questions q
      WHERE q.id = question_versions.question_id
      AND q.created_by = auth.uid()
    )
  );

-- Only system can insert versions (via versioning functions)
CREATE POLICY "question_versions_system_insert" ON question_versions
  FOR INSERT
  WITH CHECK (false); -- No direct inserts allowed

-- No updates or deletes allowed on versions
-- (Versions should be immutable for audit trail)

-- 4. Verify RLS is enabled
DO $$
BEGIN
  -- Check audit_logs
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'audit_logs' 
    AND schemaname = 'public' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'FAILED: RLS not enabled on audit_logs';
  END IF;
  
  -- Check question_analytics
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'question_analytics' 
    AND schemaname = 'public' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'FAILED: RLS not enabled on question_analytics';
  END IF;
  
  -- Check question_versions
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'question_versions' 
    AND schemaname = 'public' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'FAILED: RLS not enabled on question_versions';
  END IF;
  
  RAISE NOTICE 'SUCCESS: RLS enabled on all missing tables with appropriate policies';
END $$;

COMMIT;

-- Note: These tables now have RLS enabled with restrictive policies:
-- - audit_logs: Admin view only, system insert only
-- - question_analytics: Admin/reviewer view only, system modify only  
-- - question_versions: Role-based view access, system insert only
-- All tables prevent direct data modification to maintain data integrity
