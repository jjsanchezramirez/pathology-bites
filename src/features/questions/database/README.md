# Questions Database Migrations

This directory contains SQL migrations for the questions table.

## Anki Integration Migration

### Overview
The `add-anki-fields.sql` migration adds two new fields to the `questions` table to enable integration with Anki flashcard software.

### Fields Added
- **`anki_card_id`** (BIGINT, nullable): Stores the Anki Note ID, which is stable across exports
- **`anki_deck_name`** (VARCHAR(100), nullable): Stores the name of the Anki deck for context

### How to Run

#### Option 1: Using the Helper Script
```bash
npx tsx src/features/questions/database/run-anki-migration.ts
```
This will display the SQL that needs to be executed.

#### Option 2: Direct SQL Execution
1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Copy and paste the contents of `add-anki-fields.sql`
5. Click "Run"

### After Running the Migration

#### 1. Update TypeScript Types
After applying the migration, regenerate your TypeScript types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/types/supabase.ts
```

Replace `YOUR_PROJECT_ID` with your actual Supabase project ID.

#### 2. Update Application Code
The new fields will be available in your TypeScript types:

```typescript
// Example: Querying questions with Anki links
const { data: ankiLinkedQuestions } = await supabase
  .from('questions')
  .select('*')
  .not('anki_card_id', 'is', null);

// Example: Filtering by deck
const { data: deckQuestions } = await supabase
  .from('questions')
  .select('*')
  .eq('anki_deck_name', 'Pathology::Cardiovascular');

// Example: Creating a question with Anki link
const { data, error } = await supabase
  .from('questions')
  .insert({
    title: 'Question Title',
    stem: 'Question text...',
    // ... other required fields
    anki_card_id: 1234567890,
    anki_deck_name: 'Pathology::Cardiovascular'
  });
```

### Use Cases

1. **Bidirectional Linking**: Link questions in your app to Anki cards
2. **Deck Organization**: Filter and organize questions by Anki deck
3. **View in Anki**: Add "View in Anki" buttons in your UI
4. **Import Tracking**: Track which questions were imported from Anki
5. **Sync Status**: Identify questions that need to be synced with Anki

### Indexes
The migration creates two indexes for optimal query performance:
- `idx_questions_anki_card_id`: For lookups by Anki Note ID
- `idx_questions_anki_deck_name`: For filtering by deck name

### Rollback
If you need to rollback this migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS idx_questions_anki_card_id;
DROP INDEX IF EXISTS idx_questions_anki_deck_name;

-- Remove columns
ALTER TABLE questions DROP COLUMN IF EXISTS anki_card_id;
ALTER TABLE questions DROP COLUMN IF EXISTS anki_deck_name;
```

## Notes
- Both fields are nullable to maintain backward compatibility
- Existing questions will have NULL values for these fields
- The Anki Note ID is a BIGINT to accommodate Anki's ID format
- Deck names are limited to 100 characters (adjust if needed)

