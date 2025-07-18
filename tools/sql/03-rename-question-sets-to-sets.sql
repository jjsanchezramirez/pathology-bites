-- Migration: Rename question_sets table to sets
-- This simplifies the naming convention since this table doesn't directly reference question IDs

BEGIN;

-- Check if the table exists and hasn't been renamed already
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_sets') THEN
        RAISE NOTICE 'Found question_sets table. Proceeding with rename to sets...';
    ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sets') THEN
        RAISE NOTICE 'sets table already exists. Migration may have already been applied.';
        RETURN;
    ELSE
        RAISE EXCEPTION 'Neither question_sets nor sets table found. Cannot proceed.';
    END IF;
END $$;

-- Rename the table
ALTER TABLE question_sets RENAME TO sets;

-- Update the primary key constraint name
ALTER TABLE sets RENAME CONSTRAINT question_sets_pkey TO sets_pkey;

-- Update the foreign key constraint name for created_by
ALTER TABLE sets RENAME CONSTRAINT question_sets_created_by_fkey TO sets_created_by_fkey;

-- Update the foreign key constraint in questions table that references this table
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_question_set_id_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_set_id_fkey 
  FOREIGN KEY (question_set_id) REFERENCES sets(id);

-- Check if there are any indexes that need to be renamed
DO $$
DECLARE
    index_record RECORD;
BEGIN
    -- Find indexes on the renamed table that still have the old name
    FOR index_record IN 
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'sets' 
        AND indexname LIKE '%question_sets%'
    LOOP
        -- Rename indexes that contain 'question_sets' to use 'sets'
        EXECUTE format('ALTER INDEX %I RENAME TO %I', 
            index_record.indexname, 
            replace(index_record.indexname, 'question_sets', 'sets'));
        RAISE NOTICE 'Renamed index % to %', 
            index_record.indexname, 
            replace(index_record.indexname, 'question_sets', 'sets');
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
        WHERE sequencename LIKE '%question_sets%'
    LOOP
        -- Rename sequences that contain 'question_sets' to use 'sets'
        EXECUTE format('ALTER SEQUENCE %I.%I RENAME TO %I', 
            seq_record.schemaname,
            seq_record.sequencename, 
            replace(seq_record.sequencename, 'question_sets', 'sets'));
        RAISE NOTICE 'Renamed sequence % to %', 
            seq_record.sequencename, 
            replace(seq_record.sequencename, 'question_sets', 'sets');
    END LOOP;
END $$;

-- Verify the migration
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sets') THEN
        RAISE NOTICE 'SUCCESS: Table successfully renamed to sets';
    ELSE
        RAISE EXCEPTION 'FAILED: sets table not found after migration';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_sets') THEN
        RAISE EXCEPTION 'FAILED: question_sets table still exists after migration';
    END IF;
END $$;

COMMIT;

-- Note: After running this migration, you will need to update application code to:
-- 1. Update TypeScript types to use sets instead of question_sets
-- 2. Update all Supabase queries to reference sets table
-- 3. Update API endpoints and services
-- 4. Update React components and hooks
-- 5. Consider renaming question_set_id column to set_id for consistency
