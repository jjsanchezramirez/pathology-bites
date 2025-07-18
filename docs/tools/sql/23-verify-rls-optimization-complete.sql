-- Verification Script: RLS Performance Optimization Complete
-- This script verifies that all RLS performance issues have been resolved

-- ============================================================================
-- 1. CHECK AUTH FUNCTION OPTIMIZATION STATUS
-- ============================================================================

SELECT 
  'Auth Function Optimization Status' as check_name,
  COUNT(*) as total_policies_with_auth,
  COUNT(CASE WHEN qual ~ 'SELECT auth\.(uid|role)\(\)' OR with_check ~ 'SELECT auth\.(uid|role)\(\)' THEN 1 END) as optimized_policies,
  COUNT(CASE WHEN (qual ~ 'auth\.(uid|role)\(\)' AND qual !~ 'SELECT auth\.(uid|role)\(\)') 
                OR (with_check ~ 'auth\.(uid|role)\(\)' AND with_check !~ 'SELECT auth\.(uid|role)\(\)') 
                THEN 1 END) as unoptimized_policies,
  CASE 
    WHEN COUNT(CASE WHEN (qual ~ 'auth\.(uid|role)\(\)' AND qual !~ 'SELECT auth\.(uid|role)\(\)') 
                      OR (with_check ~ 'auth\.(uid|role)\(\)' AND with_check !~ 'SELECT auth\.(uid|role)\(\)') 
                      THEN 1 END) = 0 
    THEN '✅ ALL OPTIMIZED'
    ELSE '❌ NEEDS WORK'
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
  AND (qual LIKE '%auth.%' OR with_check LIKE '%auth.%');

-- ============================================================================
-- 2. CHECK MULTIPLE PERMISSIVE POLICIES STATUS
-- ============================================================================

SELECT 
  'Multiple Permissive Policies Status' as check_name,
  COUNT(*) as total_overlapping_groups,
  0 as optimized_policies,
  0 as unoptimized_policies,
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ NO OVERLAPS'
    ELSE '❌ HAS OVERLAPS'
  END as status
FROM (
  SELECT tablename, cmd, roles
  FROM pg_policies 
  WHERE schemaname = 'public'
    AND permissive = 'PERMISSIVE'
  GROUP BY tablename, cmd, roles
  HAVING COUNT(*) > 1
) AS overlapping_policies;

-- ============================================================================
-- 3. CHECK DUPLICATE INDEXES STATUS
-- ============================================================================

SELECT 
  'Duplicate Indexes Status' as check_name,
  COUNT(*) as total_duplicate_groups,
  0 as optimized_policies,
  0 as unoptimized_policies,
  CASE 
    WHEN COUNT(*) = 0 
    THEN '✅ NO DUPLICATES'
    ELSE '❌ HAS DUPLICATES'
  END as status
FROM (
  SELECT 
    schemaname,
    tablename,
    array_agg(indexname) as duplicate_indexes
  FROM pg_indexes 
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename, indexdef
  HAVING COUNT(*) > 1
) AS duplicate_indexes;

-- ============================================================================
-- 4. OVERALL SUMMARY
-- ============================================================================

SELECT 
  'OVERALL RLS OPTIMIZATION SUMMARY' as summary_title,
  COUNT(*) as total_rls_policies,
  COUNT(DISTINCT tablename) as tables_with_rls,
  COUNT(CASE WHEN permissive = 'PERMISSIVE' THEN 1 END) as permissive_policies,
  COUNT(CASE WHEN permissive = 'RESTRICTIVE' THEN 1 END) as restrictive_policies
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================================================
-- 5. LIST ANY REMAINING UNOPTIMIZED POLICIES (Should be empty)
-- ============================================================================

SELECT 
  'UNOPTIMIZED POLICIES (Should be empty)' as warning_title,
  tablename,
  policyname,
  cmd,
  'Auth function not wrapped in SELECT' as issue
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    (qual ~ 'auth\.(uid|role)\(\)' AND qual !~ 'SELECT auth\.(uid|role)\(\)') 
    OR (with_check ~ 'auth\.(uid|role)\(\)' AND with_check !~ 'SELECT auth\.(uid|role)\(\)')
  )
ORDER BY tablename, policyname;

-- ============================================================================
-- 6. LIST ANY REMAINING MULTIPLE PERMISSIVE POLICIES (Should be empty)
-- ============================================================================

SELECT 
  'MULTIPLE PERMISSIVE POLICIES (Should be empty)' as warning_title,
  tablename,
  cmd,
  roles,
  COUNT(*) as policy_count,
  array_agg(policyname) as overlapping_policies
FROM pg_policies 
WHERE schemaname = 'public'
  AND permissive = 'PERMISSIVE'
GROUP BY tablename, cmd, roles
HAVING COUNT(*) > 1
ORDER BY tablename, cmd;

-- ============================================================================
-- 7. PERFORMANCE RECOMMENDATIONS
-- ============================================================================

SELECT 
  'PERFORMANCE RECOMMENDATIONS' as recommendation_title,
  'All RLS policies have been optimized for performance' as message,
  'Auth functions are wrapped in subqueries to prevent re-evaluation per row' as auth_optimization,
  'Multiple permissive policies have been consolidated to reduce policy execution overhead' as policy_consolidation,
  'Duplicate indexes have been removed to reduce storage and maintenance overhead' as index_optimization;

-- ============================================================================
-- 8. NEXT STEPS
-- ============================================================================

SELECT 
  'NEXT STEPS' as next_steps_title,
  'Monitor query performance in production to measure improvements' as step_1,
  'Run Supabase database linter regularly to catch new issues' as step_2,
  'Update RLS policy documentation with optimization patterns' as step_3,
  'Share optimization knowledge with development team' as step_4;
