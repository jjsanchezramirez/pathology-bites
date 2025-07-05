-- Migration: Create user statistics view
-- This migration creates a comprehensive user statistics view for the admin dashboard
-- providing detailed breakdowns of users by status and role

-- Description:
-- - Creates v_user_stats view with comprehensive user statistics
-- - Includes total users, active/inactive/suspended counts
-- - Provides role-based breakdowns (admin, creator, reviewer, user)
-- - Uses security_invoker=on for proper RLS handling
-- - Follows existing view naming conventions with v_ prefix

BEGIN;

-- Create comprehensive user statistics view
CREATE OR REPLACE VIEW public.v_user_stats
WITH (security_invoker=on)
AS
WITH user_counts AS (
  SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE status = 'active') as active_users,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_users,
    COUNT(*) FILTER (WHERE status = 'suspended') as suspended_users,
    COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as recent_users
  FROM users
), role_counts AS (
  SELECT 
    COUNT(*) FILTER (WHERE role = 'admin' AND status = 'active') as active_admins,
    COUNT(*) FILTER (WHERE role = 'creator' AND status = 'active') as active_creators,
    COUNT(*) FILTER (WHERE role = 'reviewer' AND status = 'active') as active_reviewers,
    COUNT(*) FILTER (WHERE role = 'user' AND status = 'active') as active_users_role,
    COUNT(*) FILTER (WHERE role = 'admin') as total_admins,
    COUNT(*) FILTER (WHERE role = 'creator') as total_creators,
    COUNT(*) FILTER (WHERE role = 'reviewer') as total_reviewers,
    COUNT(*) FILTER (WHERE role = 'user') as total_users_role
  FROM users
), status_by_role AS (
  SELECT 
    role,
    status,
    COUNT(*) as count
  FROM users
  GROUP BY role, status
)
SELECT 
  -- Overall user counts
  uc.total_users,
  uc.active_users,
  uc.inactive_users,
  uc.suspended_users,
  uc.recent_users,
  
  -- Active users by role
  rc.active_admins,
  rc.active_creators,
  rc.active_reviewers,
  rc.active_users_role,
  
  -- Total users by role (all statuses)
  rc.total_admins,
  rc.total_creators,
  rc.total_reviewers,
  rc.total_users_role,
  
  -- Calculated percentages
  CASE 
    WHEN uc.total_users > 0 THEN 
      ROUND((uc.active_users::decimal / uc.total_users::decimal) * 100, 1)
    ELSE 0 
  END as active_percentage,
  
  CASE 
    WHEN uc.total_users > 0 THEN 
      ROUND((uc.inactive_users::decimal / uc.total_users::decimal) * 100, 1)
    ELSE 0 
  END as inactive_percentage,
  
  CASE 
    WHEN uc.total_users > 0 THEN 
      ROUND((uc.suspended_users::decimal / uc.total_users::decimal) * 100, 1)
    ELSE 0 
  END as suspended_percentage,
  
  -- Timestamp for cache invalidation
  NOW() as last_updated
  
FROM user_counts uc, role_counts rc;

-- Add comment for documentation
COMMENT ON VIEW public.v_user_stats IS 'Comprehensive user statistics for admin dashboard including counts by status and role';

COMMIT;
