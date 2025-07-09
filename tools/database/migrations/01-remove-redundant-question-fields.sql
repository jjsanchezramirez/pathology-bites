-- Migration: Remove redundant fields from questions table
-- These fields are redundant because the same information is stored in 
-- question_flags and question_reviews tables with better normalization

-- Description:
-- - flagged_by, flagged_at, flag_reason are duplicated in question_flags table
-- - reviewed_by, reviewed_at are duplicated in question_reviews table
-- - This migration removes the redundant fields and updates queries to use joins

BEGIN;

-- First, let's verify the current state
DO $$
BEGIN
    -- Check if the redundant columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' 
        AND column_name IN ('flagged_by', 'flagged_at', 'flag_reason', 'reviewed_by', 'reviewed_at')
    ) THEN
        RAISE NOTICE 'Found redundant columns in questions table. Proceeding with removal...';
    ELSE
        RAISE NOTICE 'Redundant columns not found. Migration may have already been applied.';
    END IF;
END $$;

-- Drop foreign key constraints first
DO $$
BEGIN
    -- Drop flagged_by foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'questions_flagged_by_fkey' 
        AND table_name = 'questions'
    ) THEN
        ALTER TABLE questions DROP CONSTRAINT questions_flagged_by_fkey;
        RAISE NOTICE 'Dropped questions_flagged_by_fkey constraint';
    END IF;

    -- Drop reviewed_by foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'questions_reviewed_by_fkey' 
        AND table_name = 'questions'
    ) THEN
        ALTER TABLE questions DROP CONSTRAINT questions_reviewed_by_fkey;
        RAISE NOTICE 'Dropped questions_reviewed_by_fkey constraint';
    END IF;
END $$;

-- Drop the redundant columns
DO $$
BEGIN
    -- Drop flagged_by column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'flagged_by'
    ) THEN
        ALTER TABLE questions DROP COLUMN flagged_by;
        RAISE NOTICE 'Dropped flagged_by column';
    END IF;

    -- Drop flagged_at column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'flagged_at'
    ) THEN
        ALTER TABLE questions DROP COLUMN flagged_at;
        RAISE NOTICE 'Dropped flagged_at column';
    END IF;

    -- Drop flag_reason column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'flag_reason'
    ) THEN
        ALTER TABLE questions DROP COLUMN flag_reason;
        RAISE NOTICE 'Dropped flag_reason column';
    END IF;

    -- Drop reviewed_by column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'reviewed_by'
    ) THEN
        ALTER TABLE questions DROP COLUMN reviewed_by;
        RAISE NOTICE 'Dropped reviewed_by column';
    END IF;

    -- Drop reviewed_at column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'questions' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE questions DROP COLUMN reviewed_at;
        RAISE NOTICE 'Dropped reviewed_at column';
    END IF;
END $$;

-- Verify the migration
DO $$
DECLARE
    remaining_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_count
    FROM information_schema.columns 
    WHERE table_name = 'questions' 
    AND column_name IN ('flagged_by', 'flagged_at', 'flag_reason', 'reviewed_by', 'reviewed_at');
    
    IF remaining_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All redundant columns have been removed from questions table';
    ELSE
        RAISE WARNING 'WARNING: % redundant columns still remain in questions table', remaining_count;
    END IF;
END $$;

COMMIT;

-- Note: After running this migration, you will need to update application code to:
-- 1. Remove references to these fields in TypeScript types
-- 2. Update queries to join with question_flags and question_reviews tables instead
-- 3. Update API endpoints that set these fields
-- 4. Update React components that display this information
