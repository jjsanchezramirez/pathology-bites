-- Migration: Add question_analytics table
-- This table tracks performance metrics for questions to help identify
-- which questions need review, are too easy/hard, or have other issues

BEGIN;

-- Create question_analytics table
CREATE TABLE IF NOT EXISTS question_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  
  -- Basic attempt statistics
  total_attempts integer NOT NULL DEFAULT 0,
  correct_attempts integer NOT NULL DEFAULT 0,
  
  -- Time-based metrics
  avg_time_spent interval,
  median_time_spent interval,
  
  -- Calculated metrics
  success_rate numeric(5,4), -- percentage as decimal (0.0000 to 1.0000)
  difficulty_score numeric(3,2), -- calculated difficulty (1.00 = easiest, 5.00 = hardest)
  
  -- Quality indicators
  flag_count integer NOT NULL DEFAULT 0,
  review_count integer NOT NULL DEFAULT 0,
  
  -- Metadata
  last_calculated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  -- Constraints
  CONSTRAINT question_analytics_question_id_unique UNIQUE (question_id),
  CONSTRAINT question_analytics_success_rate_check CHECK (success_rate >= 0 AND success_rate <= 1),
  CONSTRAINT question_analytics_difficulty_score_check CHECK (difficulty_score >= 1.00 AND difficulty_score <= 5.00),
  CONSTRAINT question_analytics_attempts_check CHECK (correct_attempts <= total_attempts),
  CONSTRAINT question_analytics_counts_check CHECK (total_attempts >= 0 AND correct_attempts >= 0 AND flag_count >= 0 AND review_count >= 0)
);

-- Create indexes for performance
CREATE INDEX idx_question_analytics_question_id ON question_analytics(question_id);
CREATE INDEX idx_question_analytics_success_rate ON question_analytics(success_rate);
CREATE INDEX idx_question_analytics_difficulty_score ON question_analytics(difficulty_score);
CREATE INDEX idx_question_analytics_total_attempts ON question_analytics(total_attempts);
CREATE INDEX idx_question_analytics_last_calculated ON question_analytics(last_calculated_at);

-- Create function to calculate analytics for a question
CREATE OR REPLACE FUNCTION calculate_question_analytics(target_question_id uuid)
RETURNS void AS $$
DECLARE
  attempt_count integer;
  correct_count integer;
  avg_time interval;
  median_time interval;
  success_rate_calc numeric(5,4);
  difficulty_calc numeric(3,2);
  flag_count_calc integer;
  review_count_calc integer;
BEGIN
  -- Get basic attempt statistics
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE is_correct = true)
  INTO attempt_count, correct_count
  FROM quiz_attempts 
  WHERE question_id = target_question_id;
  
  -- Get time statistics (only for attempts with reasonable time spent)
  SELECT 
    AVG(time_spent),
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_spent)
  INTO avg_time, median_time
  FROM quiz_attempts 
  WHERE question_id = target_question_id 
    AND time_spent IS NOT NULL 
    AND time_spent > interval '1 second' 
    AND time_spent < interval '10 minutes';
  
  -- Calculate success rate
  IF attempt_count > 0 THEN
    success_rate_calc := correct_count::numeric / attempt_count::numeric;
  ELSE
    success_rate_calc := NULL;
  END IF;
  
  -- Calculate difficulty score (1.00 = easiest, 5.00 = hardest)
  -- Based on success rate: 90%+ = 1.0, 70-90% = 2.0, 50-70% = 3.0, 30-50% = 4.0, <30% = 5.0
  IF success_rate_calc IS NOT NULL THEN
    CASE 
      WHEN success_rate_calc >= 0.9 THEN difficulty_calc := 1.0;
      WHEN success_rate_calc >= 0.7 THEN difficulty_calc := 2.0;
      WHEN success_rate_calc >= 0.5 THEN difficulty_calc := 3.0;
      WHEN success_rate_calc >= 0.3 THEN difficulty_calc := 4.0;
      ELSE difficulty_calc := 5.0;
    END CASE;
  ELSE
    difficulty_calc := NULL;
  END IF;
  
  -- Get flag and review counts
  SELECT COUNT(*) INTO flag_count_calc
  FROM question_flags 
  WHERE question_id = target_question_id;
  
  SELECT COUNT(*) INTO review_count_calc
  FROM question_reviews 
  WHERE question_id = target_question_id;
  
  -- Insert or update analytics
  INSERT INTO question_analytics (
    question_id,
    total_attempts,
    correct_attempts,
    avg_time_spent,
    median_time_spent,
    success_rate,
    difficulty_score,
    flag_count,
    review_count,
    last_calculated_at,
    updated_at
  ) VALUES (
    target_question_id,
    attempt_count,
    correct_count,
    avg_time,
    median_time,
    success_rate_calc,
    difficulty_calc,
    flag_count_calc,
    review_count_calc,
    now(),
    now()
  )
  ON CONFLICT (question_id) DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    correct_attempts = EXCLUDED.correct_attempts,
    avg_time_spent = EXCLUDED.avg_time_spent,
    median_time_spent = EXCLUDED.median_time_spent,
    success_rate = EXCLUDED.success_rate,
    difficulty_score = EXCLUDED.difficulty_score,
    flag_count = EXCLUDED.flag_count,
    review_count = EXCLUDED.review_count,
    last_calculated_at = EXCLUDED.last_calculated_at,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql;

-- Create function to recalculate all analytics
CREATE OR REPLACE FUNCTION recalculate_all_question_analytics()
RETURNS void AS $$
DECLARE
  question_record RECORD;
BEGIN
  FOR question_record IN SELECT id FROM questions LOOP
    PERFORM calculate_question_analytics(question_record.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update analytics when quiz attempts are added/updated
CREATE OR REPLACE FUNCTION trigger_update_question_analytics()
RETURNS trigger AS $$
BEGIN
  -- Update analytics for the affected question
  PERFORM calculate_question_analytics(COALESCE(NEW.question_id, OLD.question_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quiz_attempts_analytics_trigger
  AFTER INSERT OR UPDATE OR DELETE ON quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_question_analytics();

-- Create trigger to update analytics when flags/reviews are added
CREATE OR REPLACE FUNCTION trigger_update_question_analytics_flags_reviews()
RETURNS trigger AS $$
BEGIN
  PERFORM calculate_question_analytics(COALESCE(NEW.question_id, OLD.question_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER question_flags_analytics_trigger
  AFTER INSERT OR UPDATE OR DELETE ON question_flags
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_question_analytics_flags_reviews();

CREATE TRIGGER question_reviews_analytics_trigger
  AFTER INSERT OR UPDATE OR DELETE ON question_reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_question_analytics_flags_reviews();

-- Initialize analytics for existing questions
SELECT recalculate_all_question_analytics();

-- Verify the migration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_analytics') THEN
    RAISE NOTICE 'SUCCESS: question_analytics table created successfully';
  ELSE
    RAISE EXCEPTION 'FAILED: question_analytics table not found';
  END IF;
END $$;

COMMIT;

-- Note: This migration adds:
-- 1. question_analytics table with comprehensive metrics
-- 2. Functions to calculate and recalculate analytics
-- 3. Triggers to automatically update analytics when data changes
-- 4. Proper indexes for performance
-- 5. Constraints to ensure data integrity
