-- Migration: Consolidate question_categories table into questions table
-- Since each question can only have one category, we can add category_id directly to questions table

BEGIN;

-- Check current state
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_categories') THEN
        RAISE NOTICE 'Found question_categories table. Proceeding with consolidation...';
    ELSE
        RAISE NOTICE 'question_categories table not found. Migration may have already been applied.';
        RETURN;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'category_id') THEN
        RAISE NOTICE 'category_id column already exists in questions table. Skipping column creation.';
    END IF;
END $$;

-- Add category_id column to questions table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'category_id') THEN
        ALTER TABLE questions ADD COLUMN category_id uuid;
        RAISE NOTICE 'Added category_id column to questions table';
    END IF;
END $$;

-- Temporarily disable the version creation trigger to avoid conflicts
ALTER TABLE questions DISABLE TRIGGER create_question_version_trigger;

-- Migrate data from question_categories to questions.category_id
UPDATE questions
SET category_id = qc.category_id
FROM question_categories qc
WHERE questions.id = qc.question_id;

-- Re-enable the version creation trigger
ALTER TABLE questions ENABLE TRIGGER create_question_version_trigger;

-- Add foreign key constraint
ALTER TABLE questions 
ADD CONSTRAINT questions_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES categories(id);

-- Verify data migration
DO $$
DECLARE
    questions_with_categories INTEGER;
    question_categories_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO questions_with_categories 
    FROM questions 
    WHERE category_id IS NOT NULL;
    
    SELECT COUNT(*) INTO question_categories_count 
    FROM question_categories;
    
    IF questions_with_categories = question_categories_count THEN
        RAISE NOTICE 'SUCCESS: Data migration verified. % questions have categories', questions_with_categories;
    ELSE
        RAISE WARNING 'WARNING: Data migration mismatch. Questions with categories: %, Question categories: %', 
            questions_with_categories, question_categories_count;
    END IF;
END $$;

-- Drop the question_categories table
DROP TABLE IF EXISTS question_categories;

-- Verify the migration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'question_categories') THEN
        RAISE NOTICE 'SUCCESS: question_categories table has been removed';
    ELSE
        RAISE WARNING 'WARNING: question_categories table still exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'questions' AND column_name = 'category_id') THEN
        RAISE NOTICE 'SUCCESS: category_id column exists in questions table';
    ELSE
        RAISE WARNING 'WARNING: category_id column not found in questions table';
    END IF;
END $$;

COMMIT;

-- Note: After running this migration, you will need to update application code to:
-- 1. Remove references to question_categories table
-- 2. Update queries to use questions.category_id instead of joins to question_categories
-- 3. Update TypeScript types to reflect the new structure
-- 4. Update API endpoints and services
-- 5. Update React components and hooks
