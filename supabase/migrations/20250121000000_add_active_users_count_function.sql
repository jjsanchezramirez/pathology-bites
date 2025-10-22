-- Function to count active users in the last N hours
-- This counts distinct users who have performed any activity (quiz sessions or quiz attempts)

CREATE OR REPLACE FUNCTION get_active_users_count(hours_ago integer DEFAULT 24)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_count integer;
  cutoff_time timestamp with time zone;
BEGIN
  -- Calculate the cutoff time
  cutoff_time := NOW() - (hours_ago || ' hours')::interval;

  -- Count distinct users from quiz_sessions and quiz_attempts
  -- Users are considered active if they:
  -- 1. Created or updated a quiz session in the time period, OR
  -- 2. Attempted a quiz question in the time period
  SELECT COUNT(DISTINCT user_id) INTO active_count
  FROM (
    -- Users who created/updated quiz sessions
    SELECT user_id
    FROM quiz_sessions
    WHERE created_at >= cutoff_time OR updated_at >= cutoff_time

    UNION

    -- Users who attempted quiz questions (via quiz_attempts joined with quiz_sessions)
    SELECT qs.user_id
    FROM quiz_attempts qa
    JOIN quiz_sessions qs ON qa.quiz_session_id = qs.id
    WHERE qa.attempted_at >= cutoff_time OR qa.created_at >= cutoff_time
  ) AS active_users;

  RETURN COALESCE(active_count, 0);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_active_users_count(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_users_count(integer) TO service_role;

-- Add comment
COMMENT ON FUNCTION get_active_users_count IS
'Returns the count of distinct users who have been active (quiz sessions or attempts) in the last N hours. Defaults to 24 hours.';
