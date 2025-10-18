// Script to run the inquiries status field migration
// DEPRECATED: This script requires the exec_sql RPC function which has been removed.
// To run this migration, execute the SQL in add-status-field.sql directly via:
// 1. Supabase Dashboard > SQL Editor
// 2. Or use psql/pgAdmin with your database credentials

import { readFileSync } from 'fs'
import { join } from 'path'

async function runMigration() {
  try {
    console.log('🚀 Inquiries migration script')

    // Read the migration SQL file
    const migrationPath = join(__dirname, 'add-status-field.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    console.log('📖 Migration SQL loaded successfully')
    console.log('\n⚠️  IMPORTANT: This script requires the exec_sql RPC function which has been removed.')
    console.log('\n📋 To apply this migration, execute the following SQL in your Supabase dashboard:')
    console.log('=' .repeat(80))
    console.log(migrationSQL)
    console.log('=' .repeat(80))
    console.log('\n✅ Steps to apply:')
    console.log('   1. Go to Supabase Dashboard > SQL Editor')
    console.log('   2. Create a new query')
    console.log('   3. Copy and paste the SQL above')
    console.log('   4. Click "Run"')

  } catch (error: any) {
    console.error('❌ Error reading migration file:', error.message)
    process.exit(1)
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration()
}

export { runMigration }
