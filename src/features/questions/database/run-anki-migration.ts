// Script to run the Anki fields migration
// This script displays the SQL needed to add Anki integration fields to the questions table
// Execute the SQL directly via Supabase Dashboard > SQL Editor

import { readFileSync } from 'fs'
import { join } from 'path'

async function runMigration() {
  try {
    console.log('🚀 Anki Integration Migration Script')
    console.log('=' .repeat(80))

    // Read the migration SQL file
    const migrationPath = join(__dirname, 'add-anki-fields.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    console.log('📖 Migration SQL loaded successfully\n')
    console.log('📋 To apply this migration, execute the following SQL in your Supabase dashboard:\n')
    console.log('=' .repeat(80))
    console.log(migrationSQL)
    console.log('=' .repeat(80))
    console.log('\n✅ Steps to apply:')
    console.log('   1. Go to Supabase Dashboard > SQL Editor')
    console.log('   2. Create a new query')
    console.log('   3. Copy and paste the SQL above')
    console.log('   4. Click "Run"')
    console.log('\n📝 What this migration does:')
    console.log('   • Adds anki_card_id (BIGINT) - stores Anki Note ID')
    console.log('   • Adds anki_deck_name (VARCHAR(100)) - stores deck name')
    console.log('   • Creates indexes for efficient querying')
    console.log('   • Both fields are nullable for backward compatibility')
    console.log('\n💡 Benefits:')
    console.log('   • Link questions to Anki cards by stable Note ID')
    console.log('   • Store deck context for organization')
    console.log('   • Query linked questions easily')
    console.log('   • Display "View in Anki" buttons in your UI')
    console.log('\n⚠️  Note: After running the migration, update TypeScript types')
    console.log('   Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/types/supabase.ts')

  } catch (error) {
    console.error('❌ Error reading migration file:', error.message)
    process.exit(1)
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration()
}

export default runMigration

