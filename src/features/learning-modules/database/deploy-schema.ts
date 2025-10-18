#!/usr/bin/env tsx
// src/features/learning-modules/database/deploy-schema.ts
// DEPRECATED: This script requires the exec_sql RPC function which has been removed.
// To deploy the schema, execute the SQL files directly via:
// 1. Supabase Dashboard > SQL Editor
// 2. Or use psql/pgAdmin with your database credentials

import { readFileSync } from 'fs'
import { join } from 'path'

async function deploySchema() {
  console.log('🚀 Learning Modules Schema Deployment\n')

  try {
    // Read schema files
    const schemaPath = join(__dirname, 'schema.sql')
    const indexesPath = join(__dirname, 'indexes-views-policies.sql')

    const schemaSQL = readFileSync(schemaPath, 'utf8')
    const indexesSQL = readFileSync(indexesPath, 'utf8')

    console.log('📖 Schema files loaded successfully')

    console.log('\n⚠️  IMPORTANT: This script requires the exec_sql RPC function which has been removed.')
    console.log('\n📋 To deploy the schema, execute the following SQL files in your Supabase dashboard:')
    console.log('\n' + '='.repeat(80))
    console.log('FILE 1: schema.sql (Tables)')
    console.log('='.repeat(80))
    console.log(schemaSQL)
    console.log('\n' + '='.repeat(80))
    console.log('FILE 2: indexes-views-policies.sql (Indexes, Views, Policies)')
    console.log('='.repeat(80))
    console.log(indexesSQL)
    console.log('='.repeat(80))

    console.log('\n✅ Steps to deploy:')
    console.log('   1. Go to Supabase Dashboard > SQL Editor')
    console.log('   2. Create a new query')
    console.log('   3. Copy and paste the SQL from FILE 1 above')
    console.log('   4. Click "Run"')
    console.log('   5. Create another query')
    console.log('   6. Copy and paste the SQL from FILE 2 above')
    console.log('   7. Click "Run"')
    console.log('   8. Run: npm run generate-types')

  } catch (error) {
    console.error('❌ Error reading schema files:', error)
    process.exit(1)
  }
}

// Handle command line execution
if (require.main === module) {
  deploySchema().catch(console.error)
}

export { deploySchema }
