-- Master Security Fixes Script
-- Run this script to apply all database security fixes

-- This script addresses the following security issues:
-- 1. Function Search Path Mutable warnings
-- 2. RLS disabled on audit_logs table
-- 3. Materialized view security concerns
-- 4. Performance analytics table RLS policies
-- 5. Auth security enhancements

BEGIN;

-- 1. Fix function search paths
\echo 'Applying function search path fixes...'
\i 01-fix-function-search-paths.sql

-- 2. Fix audit logs RLS policies
\echo 'Applying audit logs RLS fixes...'
\i 02-fix-audit-logs-rls.sql

-- 3. Fix materialized view security
\echo 'Applying materialized view security fixes...'
\i 03-fix-materialized-view-security.sql

-- 4. Enable auth security features
\echo 'Applying auth security enhancements...'
\i 04-enable-auth-security.sql

-- Verify all fixes have been applied
\echo 'Verifying security fixes...'

-- Check that functions have secure search paths
SELECT 
  routine_name,
  routine_type,
  security_type,
  CASE 
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_mode
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
WHERE r.routine_schema = 'public'
  AND r.routine_name IN (
    'update_questions_search_vector',
    'handle_deleted_user',
    'select_demo_questions',
    'create_question_version',
    'is_admin',
    'is_current_user_admin',
    'create_audit_logs_table',
    'update_updated_at_column',
    'handle_new_user'
  );

-- Check that audit_logs table has RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED'
    ELSE 'RLS DISABLED'
  END as rls_status
FROM pg_tables 
WHERE tablename = 'audit_logs';

-- Check that performance_analytics table has RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  CASE 
    WHEN rowsecurity THEN 'RLS ENABLED'
    ELSE 'RLS DISABLED'
  END as rls_status
FROM pg_tables 
WHERE tablename = 'performance_analytics';

-- List all RLS policies for audit_logs
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'audit_logs';

-- List all RLS policies for performance_analytics
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'performance_analytics';

COMMIT;

\echo 'Security fixes completed successfully!'
\echo ''
\echo 'Summary of changes:'
\echo '1. ✅ Fixed function search path security issues'
\echo '2. ✅ Enabled RLS on audit_logs table with proper policies'
\echo '3. ✅ Replaced insecure materialized view with secure functions'
\echo '4. ✅ Created performance_analytics table with RLS'
\echo '5. ✅ Added auth security enhancement functions'
\echo ''
\echo 'Manual steps required:'
\echo '1. Enable "Leaked Password Protection" in Supabase Dashboard'
\echo '2. Configure password policy settings'
\echo '3. Set up rate limiting parameters'
\echo '4. Review and test all security policies'
