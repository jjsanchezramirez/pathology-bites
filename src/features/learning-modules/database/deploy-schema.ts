#!/usr/bin/env tsx
// src/features/learning-modules/database/deploy-schema.ts

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl)
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey)
  process.exit(1)
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deploySchema() {
  console.log('🚀 Starting Learning Modules Schema Deployment...\n')

  try {
    // Read schema files
    const schemaPath = join(__dirname, 'schema.sql')
    const indexesPath = join(__dirname, 'indexes-views-policies.sql')
    
    const schemaSQL = readFileSync(schemaPath, 'utf8')
    const indexesSQL = readFileSync(indexesPath, 'utf8')

    console.log('📖 Schema files loaded successfully')

    // Check if tables already exist
    console.log('🔍 Checking existing schema...')
    const { data: existingTables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'learning_modules',
        'learning_paths', 
        'learning_path_modules',
        'user_learning_path_enrollments',
        'module_sessions',
        'module_attempts',
        'module_images',
        'module_prerequisites'
      ])

    if (checkError) {
      console.warn('⚠️  Could not check existing tables:', checkError.message)
    } else if (existingTables && existingTables.length > 0) {
      console.log('⚠️  Some learning module tables already exist:')
      existingTables.forEach(table => console.log(`   - ${table.table_name}`))
      
      const shouldContinue = process.argv.includes('--force')
      if (!shouldContinue) {
        console.log('\n❌ Deployment stopped to prevent data loss.')
        console.log('   Use --force flag to continue anyway (WARNING: may cause errors)')
        process.exit(1)
      }
      console.log('   Continuing with --force flag...\n')
    }

    // Deploy main schema
    console.log('📋 Deploying main schema (tables)...')
    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: schemaSQL
    })

    if (schemaError) {
      console.error('❌ Schema deployment failed:', schemaError.message)
      process.exit(1)
    }
    console.log('✅ Main schema deployed successfully')

    // Deploy indexes, views, and policies
    console.log('🔧 Deploying indexes, views, and policies...')
    const { error: indexesError } = await supabase.rpc('exec_sql', {
      sql: indexesSQL
    })

    if (indexesError) {
      console.error('❌ Indexes/views/policies deployment failed:', indexesError.message)
      process.exit(1)
    }
    console.log('✅ Indexes, views, and policies deployed successfully')

    // Verify deployment
    console.log('🔍 Verifying deployment...')
    const { data: newTables, error: verifyError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', [
        'learning_modules',
        'learning_paths', 
        'learning_path_modules',
        'user_learning_path_enrollments',
        'module_sessions',
        'module_attempts',
        'module_images',
        'module_prerequisites'
      ])

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message)
      process.exit(1)
    }

    console.log('✅ Verification successful. Created tables:')
    newTables?.forEach(table => console.log(`   ✓ ${table.table_name}`))

    // Check views
    const { data: views } = await supabase
      .from('information_schema.views')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', 'v_%')

    if (views && views.length > 0) {
      console.log('✅ Created views:')
      views.forEach(view => console.log(`   ✓ ${view.table_name}`))
    }

    console.log('\n🎉 Learning Modules Schema Deployment Complete!')
    console.log('\n📋 Next Steps:')
    console.log('   1. Update Supabase types: npm run generate-types')
    console.log('   2. Create API endpoints for learning modules')
    console.log('   3. Build admin interface for content management')
    console.log('   4. Test the system with sample data')

  } catch (error) {
    console.error('❌ Deployment failed with unexpected error:', error)
    process.exit(1)
  }
}

// Handle command line execution
if (require.main === module) {
  deploySchema().catch(console.error)
}

export { deploySchema }
