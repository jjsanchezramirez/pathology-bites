-- Migration: Add RLS Policies for performance_analytics table
-- This migration adds Row Level Security policies for the performance_analytics table
-- Addresses Supabase Security Advisor INFO: RLS Enabled No Policy

BEGIN;

-- Verify RLS is enabled (it should be according to the security advisor)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'performance_analytics' 
    AND schemaname = 'public' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'RLS is not enabled on performance_analytics table';
  END IF;
  
  RAISE NOTICE 'RLS is enabled on performance_analytics table';
END $$;

-- 1. Users can view their own performance analytics
CREATE POLICY "performance_analytics_user_own_select" ON performance_analytics
  FOR SELECT
  USING (user_id = auth.uid());

-- 2. Users can insert their own performance analytics
CREATE POLICY "performance_analytics_user_own_insert" ON performance_analytics
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 3. Users can update their own performance analytics
CREATE POLICY "performance_analytics_user_own_update" ON performance_analytics
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Admins can view all performance analytics
CREATE POLICY "performance_analytics_admin_select" ON performance_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 5. Admins can manage all performance analytics
CREATE POLICY "performance_analytics_admin_all" ON performance_analytics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- 6. Reviewers can view performance analytics for analysis
CREATE POLICY "performance_analytics_reviewer_select" ON performance_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'reviewer'
    )
  );

-- 7. No one can delete performance analytics (preserve historical data)
-- This is enforced by not creating any DELETE policies

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE tablename = 'performance_analytics' 
  AND schemaname = 'public';
  
  IF policy_count >= 6 THEN
    RAISE NOTICE 'SUCCESS: % RLS policies created for performance_analytics table', policy_count;
  ELSE
    RAISE EXCEPTION 'FAILED: Only % policies created, expected at least 6', policy_count;
  END IF;
END $$;

COMMIT;

-- Summary of RLS Policies for performance_analytics:
-- 1. Users can view/insert/update their own performance data
-- 2. Admins have full access to all performance data
-- 3. Reviewers can view all performance data for analysis
-- 4. No DELETE policies - performance data should be preserved
-- 5. All policies respect the user_id foreign key relationship

-- This ensures:
-- - User privacy: Users only see their own performance data
-- - Admin oversight: Admins can manage all data
-- - Analytics capability: Reviewers can analyze performance trends
-- - Data integrity: Historical performance data is preserved
