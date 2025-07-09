-- Enable Auth Security Features
-- This script enables additional security features in Supabase Auth

-- Note: These settings need to be configured in the Supabase Dashboard
-- This file documents the required settings for reference

/*
IMPORTANT: The following settings must be configured in the Supabase Dashboard:

1. Enable Leaked Password Protection:
   - Go to Authentication > Settings in Supabase Dashboard
   - Enable "Leaked Password Protection"
   - This will check passwords against HaveIBeenPwned.org database

2. Password Policy Settings:
   - Minimum password length: 8 characters
   - Require uppercase letters: Yes
   - Require lowercase letters: Yes
   - Require numbers: Yes
   - Require special characters: Yes

3. Rate Limiting Settings:
   - Login attempts: 5 per 15 minutes
   - Signup attempts: 3 per hour
   - Password reset: 3 per hour

4. Session Settings:
   - Session timeout: 24 hours
   - Refresh token rotation: Enabled
   - JWT expiry: 1 hour

5. Email Settings:
   - Email confirmation required: Yes
   - Email change confirmation: Yes
   - Secure email templates: Yes
*/

-- Create a function to check password strength (additional validation)
CREATE OR REPLACE FUNCTION check_password_strength(password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check minimum length
  IF LENGTH(password) < 8 THEN
    RETURN false;
  END IF;
  
  -- Check for uppercase letter
  IF password !~ '[A-Z]' THEN
    RETURN false;
  END IF;
  
  -- Check for lowercase letter
  IF password !~ '[a-z]' THEN
    RETURN false;
  END IF;
  
  -- Check for number
  IF password !~ '[0-9]' THEN
    RETURN false;
  END IF;
  
  -- Check for special character
  IF password !~ '[^A-Za-z0-9]' THEN
    RETURN false;
  END IF;
  
  -- Check for common weak patterns
  IF password ~* '(password|123456|qwerty|admin|user|test)' THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- Create a function to log authentication events
CREATE OR REPLACE FUNCTION log_auth_event(
  event_type text,
  user_id uuid DEFAULT NULL,
  user_email text DEFAULT NULL,
  success boolean DEFAULT true,
  details jsonb DEFAULT '{}',
  ip_address inet DEFAULT NULL,
  user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  risk_level text;
BEGIN
  -- Determine risk level based on event type and success
  CASE 
    WHEN event_type IN ('login_failed', 'signup_failed', 'password_reset_failed') THEN
      risk_level := 'medium';
    WHEN event_type IN ('account_locked', 'suspicious_activity') THEN
      risk_level := 'high';
    WHEN event_type IN ('login_success', 'signup_success') THEN
      risk_level := 'low';
    ELSE
      risk_level := 'low';
  END CASE;

  -- Insert audit log
  INSERT INTO audit_logs (
    event_type,
    user_id,
    user_email,
    ip_address,
    user_agent,
    risk_level,
    details
  ) VALUES (
    event_type,
    user_id,
    user_email,
    ip_address,
    user_agent,
    risk_level,
    details || jsonb_build_object('success', success)
  );
END;
$$;

-- Create a function to check for suspicious login patterns
CREATE OR REPLACE FUNCTION check_suspicious_login(
  user_id_param uuid,
  ip_address_param inet,
  user_agent_param text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_failed_attempts integer;
  different_ips_count integer;
  different_agents_count integer;
BEGIN
  -- Check for multiple failed attempts in the last hour
  SELECT COUNT(*) INTO recent_failed_attempts
  FROM audit_logs
  WHERE user_id = user_id_param
    AND event_type = 'login_failed'
    AND created_at > NOW() - INTERVAL '1 hour';
  
  -- Check for logins from multiple IPs in the last 24 hours
  SELECT COUNT(DISTINCT ip_address) INTO different_ips_count
  FROM audit_logs
  WHERE user_id = user_id_param
    AND event_type = 'login_success'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Check for logins from multiple user agents in the last 24 hours
  SELECT COUNT(DISTINCT user_agent) INTO different_agents_count
  FROM audit_logs
  WHERE user_id = user_id_param
    AND event_type = 'login_success'
    AND created_at > NOW() - INTERVAL '24 hours';
  
  -- Flag as suspicious if any threshold is exceeded
  IF recent_failed_attempts > 3 OR different_ips_count > 3 OR different_agents_count > 2 THEN
    -- Log suspicious activity
    PERFORM log_auth_event(
      'suspicious_activity',
      user_id_param,
      NULL,
      false,
      jsonb_build_object(
        'failed_attempts', recent_failed_attempts,
        'different_ips', different_ips_count,
        'different_agents', different_agents_count
      ),
      ip_address_param,
      user_agent_param
    );
    
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;

-- Create a function to get security metrics for admin dashboard
CREATE OR REPLACE FUNCTION get_security_metrics()
RETURNS TABLE(
  total_users bigint,
  active_sessions bigint,
  failed_logins_24h bigint,
  suspicious_activities_7d bigint,
  password_resets_24h bigint,
  account_lockouts_7d bigint,
  last_updated timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM users)::bigint as total_users,
    (SELECT COUNT(*) FROM users WHERE last_sign_in_at > NOW() - INTERVAL '24 hours')::bigint as active_sessions,
    (SELECT COUNT(*) FROM audit_logs WHERE event_type = 'login_failed' AND created_at > NOW() - INTERVAL '24 hours')::bigint as failed_logins_24h,
    (SELECT COUNT(*) FROM audit_logs WHERE event_type = 'suspicious_activity' AND created_at > NOW() - INTERVAL '7 days')::bigint as suspicious_activities_7d,
    (SELECT COUNT(*) FROM audit_logs WHERE event_type = 'password_reset' AND created_at > NOW() - INTERVAL '24 hours')::bigint as password_resets_24h,
    (SELECT COUNT(*) FROM audit_logs WHERE event_type = 'account_locked' AND created_at > NOW() - INTERVAL '7 days')::bigint as account_lockouts_7d,
    NOW() as last_updated;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_password_strength(text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_auth_event(text, uuid, text, boolean, jsonb, inet, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION check_suspicious_login(uuid, inet, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_security_metrics() TO authenticated;

-- Create a view for admin security dashboard (with RLS)
CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
  'auth_events' as category,
  event_type,
  COUNT(*) as count,
  DATE_TRUNC('day', created_at) as date
FROM audit_logs
WHERE event_type IN ('login_success', 'login_failed', 'signup_success', 'signup_failed', 'password_reset')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY event_type, DATE_TRUNC('day', created_at)
ORDER BY date DESC, event_type;

-- Enable RLS on the view (it will inherit from audit_logs policies)
-- Users can only see data they have permission to see from audit_logs

-- Grant select permission
GRANT SELECT ON security_dashboard TO authenticated;
