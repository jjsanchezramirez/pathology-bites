// Script to execute the Anki fields migration directly on Supabase
// This script uses the service role key to execute SQL directly

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

async function executeMigration() {
  try {
    console.log('🚀 Executing Anki Integration Migration')
    console.log('=' .repeat(80))

    // Get Supabase credentials
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables. Make sure .env.local is configured.')
    }

    console.log('✓ Environment variables loaded')
    console.log(`✓ Supabase URL: ${supabaseUrl}`)

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('✓ Supabase client created with service role')

    // Read the migration SQL file
    const migrationPath = join(__dirname, 'add-anki-fields.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf8')
    console.log('✓ Migration SQL loaded')

    console.log('\n📋 Executing migration SQL...\n')

    // Split SQL into individual statements (separated by semicolons)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`Found ${statements.length} SQL statements to execute\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      
      // Use the rpc method to execute raw SQL
      const { _data, error } = await supabase.rpc('exec_sql', { 
        sql_query: statement + ';' 
      })

      if (error) {
        // If exec_sql doesn't exist, try direct execution via REST API
        if (error.message.includes('function') && error.message.includes('does not exist')) {
          console.log('⚠️  exec_sql function not available, using direct SQL execution...')
          
          // Execute using the REST API directly
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql_query: statement + ';' })
          })

          if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Failed to execute SQL: ${errorText}`)
          }
        } else {
          throw error
        }
      }

      console.log(`✓ Statement ${i + 1} executed successfully`)
    }

    console.log('\n' + '=' .repeat(80))
    console.log('✅ Migration completed successfully!')
    console.log('\n📝 What was added:')
    console.log('   • anki_card_id (BIGINT) - stores Anki Note ID')
    console.log('   • anki_deck_name (VARCHAR(100)) - stores deck name')
    console.log('   • Indexes for efficient querying')
    console.log('\n⚠️  Next steps:')
    console.log('   1. Update TypeScript types (see instructions below)')
    console.log('   2. Update your application code to use the new fields')
    console.log('\n💡 To update TypeScript types, run:')
    console.log('   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/shared/types/supabase.ts')

  } catch (error) {
    console.error('\n❌ Migration failed!')
    console.error('Error:', error.message)
    
    if (error.message.includes('already exists')) {
      console.log('\n💡 It looks like the columns might already exist.')
      console.log('   Check your database schema to verify.')
    } else if (error.message.includes('exec_sql')) {
      console.log('\n💡 The exec_sql function is not available.')
      console.log('   Please run the migration manually via Supabase Dashboard:')
      console.log('   1. Go to Supabase Dashboard > SQL Editor')
      console.log('   2. Copy the contents of add-anki-fields.sql')
      console.log('   3. Paste and run it')
    }
    
    process.exit(1)
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  executeMigration()
}

export default executeMigration

