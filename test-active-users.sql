-- Debug query to see what's actually in the database
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check users table and their last_sign_in_at values
SELECT
  id,
  email,
  last_sign_in_at,
  created_at,
  NOW() as current_time,
  NOW() - INTERVAL '24 hours' as twentyfour_hours_ago,
  CASE
    WHEN last_sign_in_at >= NOW() - INTERVAL '24 hours' THEN 'ACTIVE (last 24h)'
    WHEN last_sign_in_at >= NOW() - INTERVAL '7 days' THEN 'Recent (last 7d)'
    ELSE 'Inactive'
  END as status
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST
LIMIT 20;

-- 2. Check quiz_sessions activity
SELECT
  user_id,
  COUNT(*) as session_count,
  MAX(created_at) as latest_session,
  MAX(updated_at) as latest_update
FROM quiz_sessions
WHERE created_at >= NOW() - INTERVAL '24 hours'
   OR updated_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id
ORDER BY latest_session DESC;

-- 3. Check quiz_attempts activity
SELECT
  qs.user_id,
  COUNT(*) as attempt_count,
  MAX(qa.attempted_at) as latest_attempt,
  MAX(qa.created_at) as latest_created
FROM quiz_attempts qa
JOIN quiz_sessions qs ON qa.quiz_session_id = qs.id
WHERE qa.attempted_at >= NOW() - INTERVAL '24 hours'
   OR qa.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY qs.user_id
ORDER BY latest_attempt DESC;

-- 4. Test the actual function if it exists
SELECT get_active_users_count(24) as active_users_24h;

-- 5. Compare: users with last_sign_in vs actual activity
WITH sign_in_users AS (
  SELECT id as user_id, 'sign_in' as source
  FROM auth.users
  WHERE last_sign_in_at >= NOW() - INTERVAL '24 hours'
),
session_users AS (
  SELECT DISTINCT user_id, 'quiz_session' as source
  FROM quiz_sessions
  WHERE created_at >= NOW() - INTERVAL '24 hours'
     OR updated_at >= NOW() - INTERVAL '24 hours'
),
attempt_users AS (
  SELECT DISTINCT qs.user_id, 'quiz_attempt' as source
  FROM quiz_attempts qa
  JOIN quiz_sessions qs ON qa.quiz_session_id = qs.id
  WHERE qa.attempted_at >= NOW() - INTERVAL '24 hours'
     OR qa.created_at >= NOW() - INTERVAL '24 hours'
)
SELECT
  COALESCE(si.user_id, se.user_id, at.user_id) as user_id,
  CASE WHEN si.user_id IS NOT NULL THEN '✓' ELSE '✗' END as has_sign_in,
  CASE WHEN se.user_id IS NOT NULL THEN '✓' ELSE '✗' END as has_quiz_session,
  CASE WHEN at.user_id IS NOT NULL THEN '✓' ELSE '✗' END as has_quiz_attempt
FROM sign_in_users si
FULL OUTER JOIN session_users se ON si.user_id = se.user_id
FULL OUTER JOIN attempt_users at ON COALESCE(si.user_id, se.user_id) = at.user_id
ORDER BY user_id;
