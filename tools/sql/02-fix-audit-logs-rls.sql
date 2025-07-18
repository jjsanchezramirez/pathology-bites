-- Fix Audit Logs RLS Policies
-- This script creates proper RLS policies for the audit_logs table

-- Ensure audit_logs table exists and has RLS enabled
DO $$
BEGIN
  -- Create table if it doesn't exist
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    CREATE TABLE audit_logs (
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
  END IF;
END $$;

-- Enable RLS on audit_logs table
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admin can view all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admin can manage audit logs" ON audit_logs;

-- Policy 1: Admins can view all audit logs
CREATE POLICY "Admin can view all audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy 2: Users can view their own audit logs (limited fields)
CREATE POLICY "Users can view their own audit logs" ON audit_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND event_type NOT IN ('admin_action', 'role_change', 'suspicious_activity')
  );

-- Policy 3: System can insert audit logs (for service role)
CREATE POLICY "System can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true); -- Allow all inserts (controlled by application logic)

-- Policy 4: Admins can delete old audit logs (for maintenance)
CREATE POLICY "Admin can delete old audit logs" ON audit_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    AND created_at < NOW() - INTERVAL '1 year' -- Only allow deletion of logs older than 1 year
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_level ON audit_logs(risk_level);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_event ON audit_logs(user_id, event_type);

-- Grant permissions
GRANT SELECT ON audit_logs TO authenticated;
GRANT INSERT ON audit_logs TO authenticated, service_role;
GRANT DELETE ON audit_logs TO authenticated; -- Controlled by RLS policy

-- Create a function for admins to query audit logs with filters
CREATE OR REPLACE FUNCTION get_audit_logs(
  user_filter uuid DEFAULT NULL,
  event_type_filter text DEFAULT NULL,
  risk_level_filter text DEFAULT NULL,
  start_date timestamptz DEFAULT NULL,
  end_date timestamptz DEFAULT NULL,
  limit_count integer DEFAULT 100
)
RETURNS TABLE(
  id uuid,
  event_type text,
  user_id uuid,
  user_email text,
  ip_address inet,
  user_agent text,
  risk_level text,
  details jsonb,
  metadata jsonb,
  created_at timestamptz
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
    al.id,
    al.event_type,
    al.user_id,
    al.user_email,
    al.ip_address,
    al.user_agent,
    al.risk_level,
    al.details,
    al.metadata,
    al.created_at
  FROM audit_logs al
  WHERE 
    (user_filter IS NULL OR al.user_id = user_filter)
    AND (event_type_filter IS NULL OR al.event_type = event_type_filter)
    AND (risk_level_filter IS NULL OR al.risk_level = risk_level_filter)
    AND (start_date IS NULL OR al.created_at >= start_date)
    AND (end_date IS NULL OR al.created_at <= end_date)
  ORDER BY al.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION get_audit_logs(uuid, text, text, timestamptz, timestamptz, integer) TO authenticated;

-- Create a function to clean up old audit logs (admin only)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  retention_days integer DEFAULT 365
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Delete old audit logs
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - (retention_days || ' days')::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup action
  INSERT INTO audit_logs (
    event_type,
    user_id,
    risk_level,
    details
  ) VALUES (
    'audit_cleanup',
    auth.uid(),
    'low',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'retention_days', retention_days
    )
  );
  
  RETURN deleted_count;
END;
$$;

-- Grant execute permission on the cleanup function
GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs(integer) TO authenticated;
