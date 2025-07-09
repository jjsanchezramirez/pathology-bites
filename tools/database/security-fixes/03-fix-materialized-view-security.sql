-- Fix Materialized View Security Issues
-- This script addresses the dashboard_stats materialized view security concerns

-- Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS public.dashboard_stats;

-- Create a secure function to get dashboard stats instead of a materialized view
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
  total_questions bigint,
  total_users bigint,
  total_images bigint,
  total_inquiries bigint,
  pending_questions bigint,
  active_users bigint,
  recent_questions bigint,
  unread_inquiries bigint,
  question_reports bigint,
  pending_reports bigint,
  last_updated timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is admin or reviewer
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'reviewer')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin or Reviewer role required.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM questions)::bigint as total_questions,
    (SELECT COUNT(*) FROM users)::bigint as total_users,
    (SELECT COUNT(*) FROM images)::bigint as total_images,
    (SELECT COUNT(*) FROM inquiries)::bigint as total_inquiries,
    (SELECT COUNT(*) FROM questions WHERE status = 'draft')::bigint as pending_questions,
    (SELECT COUNT(*) FROM users WHERE status = 'active')::bigint as active_users,
    (SELECT COUNT(*) FROM questions WHERE created_at >= NOW() - INTERVAL '30 days')::bigint as recent_questions,
    (SELECT COUNT(*) FROM inquiries WHERE status = 'pending')::bigint as unread_inquiries,
    (SELECT COUNT(*) FROM question_reports)::bigint as question_reports,
    (SELECT COUNT(*) FROM question_reports WHERE status = 'pending')::bigint as pending_reports,
    NOW() as last_updated;
END;
$$;

-- Grant execute permission to authenticated users (RLS will control access)
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;

-- Create a role-specific dashboard stats function for reviewers
CREATE OR REPLACE FUNCTION get_reviewer_dashboard_stats()
RETURNS TABLE(
  total_questions bigint,
  pending_questions bigint,
  recent_questions bigint,
  question_reports bigint,
  pending_reports bigint,
  last_updated timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if current user is admin or reviewer
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'reviewer')
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin or Reviewer role required.';
  END IF;

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM questions WHERE status = 'published')::bigint as total_questions,
    (SELECT COUNT(*) FROM questions WHERE status = 'draft')::bigint as pending_questions,
    (SELECT COUNT(*) FROM questions WHERE created_at >= NOW() - INTERVAL '30 days')::bigint as recent_questions,
    (SELECT COUNT(*) FROM question_reports)::bigint as question_reports,
    (SELECT COUNT(*) FROM question_reports WHERE status = 'pending')::bigint as pending_reports,
    NOW() as last_updated;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_reviewer_dashboard_stats() TO authenticated;

-- Create performance analytics table with proper RLS
CREATE TABLE IF NOT EXISTS performance_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  metric_value numeric NOT NULL,
  metric_type text NOT NULL, -- 'count', 'percentage', 'average', etc.
  category text NOT NULL, -- 'questions', 'users', 'performance', etc.
  subcategory text,
  time_period text NOT NULL, -- 'daily', 'weekly', 'monthly', 'yearly'
  date_recorded date NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

-- Enable RLS on performance_analytics
ALTER TABLE performance_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for performance_analytics
CREATE POLICY "Admin can manage performance analytics" ON performance_analytics
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Reviewers can view performance analytics" ON performance_analytics
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'reviewer')
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_performance_analytics_metric_name ON performance_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_analytics_category ON performance_analytics(category);
CREATE INDEX IF NOT EXISTS idx_performance_analytics_date ON performance_analytics(date_recorded DESC);
CREATE INDEX IF NOT EXISTS idx_performance_analytics_time_period ON performance_analytics(time_period);

-- Create trigger for updated_at
CREATE TRIGGER performance_analytics_updated_at
  BEFORE UPDATE ON performance_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT ON performance_analytics TO authenticated;
GRANT INSERT, UPDATE, DELETE ON performance_analytics TO authenticated; -- Controlled by RLS

-- Create a function to record performance metrics
CREATE OR REPLACE FUNCTION record_performance_metric(
  metric_name_param text,
  metric_value_param numeric,
  metric_type_param text,
  category_param text,
  subcategory_param text DEFAULT NULL,
  time_period_param text DEFAULT 'daily',
  date_recorded_param date DEFAULT CURRENT_DATE,
  metadata_param jsonb DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  metric_id uuid;
BEGIN
  -- Check if current user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Insert or update the metric
  INSERT INTO performance_analytics (
    metric_name,
    metric_value,
    metric_type,
    category,
    subcategory,
    time_period,
    date_recorded,
    metadata
  ) VALUES (
    metric_name_param,
    metric_value_param,
    metric_type_param,
    category_param,
    subcategory_param,
    time_period_param,
    date_recorded_param,
    metadata_param
  )
  ON CONFLICT (metric_name, category, time_period, date_recorded) 
  DO UPDATE SET
    metric_value = EXCLUDED.metric_value,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING id INTO metric_id;
  
  RETURN metric_id;
END;
$$;

-- Add unique constraint to prevent duplicate metrics
ALTER TABLE performance_analytics 
ADD CONSTRAINT unique_performance_metric 
UNIQUE (metric_name, category, time_period, date_recorded);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION record_performance_metric(text, numeric, text, text, text, text, date, jsonb) TO authenticated;
