-- Migration: Fix quiz_attempts correctness calculation and add constraint
-- Date: 2024-12-11
-- Description: 
-- 1. Update existing quiz_attempts records to have correct is_correct values
-- 2. Add database constraint to ensure data integrity for future inserts

-- First, let's see what we're working with
DO $$
DECLARE
    total_attempts INTEGER;
    incorrect_attempts INTEGER;
BEGIN
    -- Count total attempts
    SELECT COUNT(*) INTO total_attempts FROM quiz_attempts;
    
    -- Count attempts where is_correct doesn't match the actual correctness
    SELECT COUNT(*) INTO incorrect_attempts
    FROM quiz_attempts qa
    LEFT JOIN question_options qo ON qa.selected_answer_id = qo.id
    WHERE qa.is_correct != COALESCE(qo.is_correct, false);
    
    RAISE NOTICE 'Total quiz attempts: %', total_attempts;
    RAISE NOTICE 'Attempts with incorrect is_correct values: %', incorrect_attempts;
END $$;

-- Update existing quiz_attempts records to have correct is_correct values
-- This handles cases where:
-- 1. selected_answer_id is NULL (should be false)
-- 2. selected_answer_id points to a non-existent option (should be false)
-- 3. selected_answer_id points to an incorrect option (should be false)
-- 4. selected_answer_id points to a correct option (should be true)

UPDATE quiz_attempts 
SET is_correct = COALESCE(
    (SELECT qo.is_correct 
     FROM question_options qo 
     WHERE qo.id = quiz_attempts.selected_answer_id), 
    false
),
updated_at = NOW()
WHERE is_correct != COALESCE(
    (SELECT qo.is_correct 
     FROM question_options qo 
     WHERE qo.id = quiz_attempts.selected_answer_id), 
    false
);

-- Get the count of updated records
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Updated % quiz_attempts records', updated_count;
END $$;

-- Add a check constraint to ensure future data integrity
-- This constraint ensures that is_correct always matches the actual correctness
-- of the selected answer option
ALTER TABLE quiz_attempts 
ADD CONSTRAINT check_answer_correctness 
CHECK (
    is_correct = COALESCE(
        (SELECT qo.is_correct 
         FROM question_options qo 
         WHERE qo.id = selected_answer_id), 
        false
    )
);

-- Add a comment explaining the constraint
COMMENT ON CONSTRAINT check_answer_correctness ON quiz_attempts IS 
'Ensures is_correct field matches the actual correctness of the selected answer option. 
If selected_answer_id is NULL or points to non-existent option, is_correct must be false.';

-- Verify the constraint works by checking all records
DO $$
DECLARE
    violation_count INTEGER;
BEGIN
    -- This should return 0 if all records are now correct
    SELECT COUNT(*) INTO violation_count
    FROM quiz_attempts qa
    WHERE qa.is_correct != COALESCE(
        (SELECT qo.is_correct 
         FROM question_options qo 
         WHERE qo.id = qa.selected_answer_id), 
        false
    );
    
    IF violation_count > 0 THEN
        RAISE EXCEPTION 'Constraint validation failed: % records still have incorrect is_correct values', violation_count;
    ELSE
        RAISE NOTICE 'Constraint validation passed: All quiz_attempts records have correct is_correct values';
    END IF;
END $$;

-- Create an index to optimize the constraint check
-- This will speed up the constraint validation on inserts/updates
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_selected_answer_correctness 
ON quiz_attempts (selected_answer_id, is_correct);

COMMENT ON INDEX idx_quiz_attempts_selected_answer_correctness IS 
'Optimizes the check_answer_correctness constraint validation';

-- Final summary
DO $$
DECLARE
    total_attempts INTEGER;
    correct_attempts INTEGER;
    incorrect_attempts INTEGER;
    null_attempts INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_attempts FROM quiz_attempts;
    SELECT COUNT(*) INTO correct_attempts FROM quiz_attempts WHERE is_correct = true;
    SELECT COUNT(*) INTO incorrect_attempts FROM quiz_attempts WHERE is_correct = false;
    SELECT COUNT(*) INTO null_attempts FROM quiz_attempts WHERE selected_answer_id IS NULL;
    
    RAISE NOTICE '=== MIGRATION SUMMARY ===';
    RAISE NOTICE 'Total quiz attempts: %', total_attempts;
    RAISE NOTICE 'Correct attempts: %', correct_attempts;
    RAISE NOTICE 'Incorrect attempts: %', incorrect_attempts;
    RAISE NOTICE 'Attempts with no answer: %', null_attempts;
    RAISE NOTICE 'Constraint added: check_answer_correctness';
    RAISE NOTICE 'Index added: idx_quiz_attempts_selected_answer_correctness';
    RAISE NOTICE '=========================';
END $$;
