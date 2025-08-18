// Script to run the inquiries status field migration
// Run this script to add the status field to the inquiries table

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    console.log('🚀 Starting inquiries status field migration...')

    // Read the migration SQL file
    const migrationPath = join(__dirname, 'add-status-field.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')

    console.log('📖 Migration SQL loaded successfully')

    // Execute the migration
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

    if (error) {
      console.error('❌ Migration failed:', error.message)
      process.exit(1)
    }

    console.log('✅ Migration completed successfully!')
    console.log('📊 The inquiries table now has:')
    console.log('   - status field (pending/resolved/closed)')
    console.log('   - updated_at field with auto-update trigger')
    console.log('   - Indexes for better performance')
    console.log('   - Check constraints for data integrity')

    // Verify the migration by checking the table structure
    const { data: columns, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'inquiries')
      .eq('table_schema', 'public')

    if (verifyError) {
      console.warn('⚠️  Could not verify migration:', verifyError.message)
    } else {
      console.log('\n📋 Current inquiries table structure:')
      columns?.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(NULLABLE)'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`)
      })
    }

  } catch (error: any) {
    console.error('❌ Migration failed with error:', error.message)
    process.exit(1)
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration()
}

export { runMigration }
