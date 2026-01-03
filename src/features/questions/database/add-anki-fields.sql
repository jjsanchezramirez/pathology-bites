-- Add Anki integration fields to questions table
-- This migration adds fields to link questions with Anki cards

-- Add anki_card_id column to store the Anki Note ID (stable across exports)
ALTER TABLE questions 
ADD COLUMN anki_card_id BIGINT NULL;

-- Add anki_deck_name column to store the deck name for context
ALTER TABLE questions 
ADD COLUMN anki_deck_name VARCHAR(100) NULL;

-- Create an index on anki_card_id for efficient lookups
CREATE INDEX idx_questions_anki_card_id ON questions(anki_card_id);

-- Create an index on anki_deck_name for filtering by deck
CREATE INDEX idx_questions_anki_deck_name ON questions(anki_deck_name);

-- Add a comment to document the purpose of these fields
COMMENT ON COLUMN questions.anki_card_id IS 'Anki Note ID for linking to Anki cards (stable across exports)';
COMMENT ON COLUMN questions.anki_deck_name IS 'Name of the Anki deck containing this card';

