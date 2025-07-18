-- Migration: Rename answer_options table to question_options
-- This follows the questions_*** naming convention for tables that directly reference question IDs

BEGIN;

-- Check if the table exists and hasn't been renamed already
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'answer_options') THEN
        RAISE NOTICE 'Found answer_options table. Proceeding with rename to question_options...';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_options') THEN
        RAISE NOTICE 'question_options table already exists. Migration may have already been applied.';
        RETURN;
    ELSE
        RAISE EXCEPTION 'Neither answer_options nor question_options table found. Cannot proceed.';
    END IF;
END $$;

-- Rename the table
ALTER TABLE answer_options RENAME TO question_options;

-- Update the foreign key constraint name to match the new table name
ALTER TABLE question_options RENAME CONSTRAINT answer_options_question_id_fkey TO question_options_question_id_fkey;

-- Update the primary key constraint name
ALTER TABLE question_options RENAME CONSTRAINT answer_options_pkey TO question_options_pkey;

-- Check if there are any indexes that need to be renamed
DO $$
DECLARE
    index_record RECORD;
BEGIN
    -- Find indexes on the renamed table that still have the old name
    FOR index_record IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'question_options' 
        AND indexname LIKE '%answer_options%'
    LOOP
        -- Rename indexes that contain 'answer_options' to use 'question_options'
        EXECUTE format('ALTER INDEX %I RENAME TO %I', 
            index_record.indexname, 
            replace(index_record.indexname, 'answer_options', 'question_options'));
        RAISE NOTICE 'Renamed index % to %', 
            index_record.indexname, 
            replace(index_record.indexname, 'answer_options', 'question_options');
    END LOOP;
END $$;

-- Update any sequences that might be associated with the table
DO $$
DECLARE
    seq_record RECORD;
BEGIN
    -- Find sequences that might be related to the old table name
    FOR seq_record IN 
        SELECT schemaname, sequencename 
        FROM pg_sequences 
        WHERE sequencename LIKE '%answer_options%'
    LOOP
        -- Rename sequences that contain 'answer_options' to use 'question_options'
        EXECUTE format('ALTER SEQUENCE %I.%I RENAME TO %I', 
            seq_record.schemaname,
            seq_record.sequencename, 
            replace(seq_record.sequencename, 'answer_options', 'question_options'));
        RAISE NOTICE 'Renamed sequence % to %', 
            seq_record.sequencename, 
            replace(seq_record.sequencename, 'answer_options', 'question_options');
    END LOOP;
END $$;

-- Verify the migration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_options') THEN
        RAISE NOTICE 'SUCCESS: Table successfully renamed to question_options';
    ELSE
        RAISE EXCEPTION 'FAILED: question_options table not found after migration';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'answer_options') THEN
        RAISE EXCEPTION 'FAILED: answer_options table still exists after migration';
    END IF;
END $$;

COMMIT;

-- Note: After running this migration, you will need to update application code to:
-- 1. Update TypeScript types to use question_options instead of answer_options
-- 2. Update all Supabase queries to reference question_options table
-- 3. Update API endpoints and services
-- 4. Update React components and hooks
