-- Drop old function signatures if exist
DROP FUNCTION IF EXISTS get_user_category_stats(UUID);
DROP FUNCTION IF EXISTS get_user_category_stats(UUID, TEXT[]);

-- Create function to calculate user question statistics per category
-- This replaces the slow JavaScript calculation in the API layer

CREATE OR REPLACE FUNCTION get_user_category_stats(p_user_id UUID, p_category_ids UUID[])
RETURNS TABLE (
  category_id UUID,
  all_count INTEGER,
  unused_count INTEGER,
  incorrect_count INTEGER,
  marked_count INTEGER,
  correct_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Get all published questions per category
  category_questions AS (
    SELECT 
      q.category_id,
      q.id as question_id
    FROM questions q
    WHERE q.status = 'published'
      AND q.category_id = ANY(p_category_ids)
  ),
  
  -- Get user's quiz sessions
  user_sessions AS (
    SELECT id 
    FROM quiz_sessions 
    WHERE user_id = p_user_id
  ),
  
  -- Get question attempt status (has correct, has incorrect)
  question_attempts AS (
    SELECT 
      qa.category_id,
      qa.question_id,
      BOOL_OR(qa.is_correct) as has_correct,
      BOOL_OR(NOT qa.is_correct) as has_incorrect
    FROM quiz_attempts qa
    WHERE qa.user_id = p_user_id
      AND qa.category_id = ANY(p_category_ids)
    GROUP BY qa.category_id, qa.question_id
  ),
  
  -- Get marked questions (favorites)
  marked_questions AS (
    SELECT 
      q.category_id,
      uf.question_id
    FROM user_favorites uf
    INNER JOIN questions q ON q.id = uf.question_id
    WHERE uf.user_id = p_user_id
      AND q.category_id = ANY(p_category_ids)
  ),
  
  -- Calculate stats per category
  category_stats AS (
    SELECT 
      cq.category_id,
      COUNT(DISTINCT cq.question_id) as all_count,
      COUNT(DISTINCT cq.question_id) FILTER (
        WHERE qa.question_id IS NULL
      ) as unused_count,
      COUNT(DISTINCT cq.question_id) FILTER (
        WHERE qa.has_incorrect = true
      ) as incorrect_count,
      COUNT(DISTINCT mq.question_id) as marked_count,
      COUNT(DISTINCT cq.question_id) FILTER (
        WHERE qa.has_correct = true AND (qa.has_incorrect = false OR qa.has_incorrect IS NULL)
      ) as correct_count
    FROM category_questions cq
    LEFT JOIN question_attempts qa ON qa.category_id = cq.category_id AND qa.question_id = cq.question_id
    LEFT JOIN marked_questions mq ON mq.category_id = cq.category_id AND mq.question_id = cq.question_id
    GROUP BY cq.category_id
  )

  SELECT
    cs.category_id,
    cs.all_count::INTEGER,
    cs.unused_count::INTEGER,
    cs.incorrect_count::INTEGER,
    cs.marked_count::INTEGER,
    cs.correct_count::INTEGER
  FROM category_stats cs;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_category_stats(UUID, UUID[]) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_user_category_stats IS 
'Calculates user-specific question statistics per category for quiz creation. Returns counts for all, unused, incorrect, marked, and correct questions.';

