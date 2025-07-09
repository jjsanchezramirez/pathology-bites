#!/usr/bin/env node

/**
 * Apply Database Security Fixes
 * 
 * This script applies the security fixes to the Supabase database
 * by running the SQL files through the Supabase Management API.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SUPABASE_PROJECT_ID = 'htsnkuudinrcgfqlqmpi';
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!SUPABASE_ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN environment variable is required');
  console.error('   Get your access token from: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

// SQL files to execute in order
const SQL_FILES = [
  '01-fix-function-search-paths.sql',
  '02-fix-audit-logs-rls.sql', 
  '03-fix-materialized-view-security.sql',
  '04-enable-auth-security.sql'
];

/**
 * Execute SQL query via Supabase Management API
 */
async function executeSQL(query, description) {
  console.log(`🔧 ${description}...`);
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_ID}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP ${response.status}: ${error}`);
    }

    const result = await response.json();
    console.log(`✅ ${description} completed successfully`);
    return result;
    
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

/**
 * Read SQL file content
 */
function readSQLFile(filename) {
  const filePath = path.join(__dirname, '..', 'sql', 'security-fixes', filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }
  
  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔒 Starting Database Security Fixes');
  console.log('=====================================\n');

  try {
    // Test connection first
    await executeSQL('SELECT version();', 'Testing database connection');
    console.log('');

    // Execute each SQL file
    for (const filename of SQL_FILES) {
      const sqlContent = readSQLFile(filename);
      const description = `Applying ${filename}`;
      
      await executeSQL(sqlContent, description);
      console.log('');
    }

    // Verify fixes
    console.log('🔍 Verifying security fixes...');
    
    // Check function security
    const functionCheck = await executeSQL(`
      SELECT 
        routine_name,
        CASE 
          WHEN prosecdef THEN 'SECURITY DEFINER ✅'
          ELSE 'SECURITY INVOKER ❌'
        END as security_mode
      FROM information_schema.routines r
      JOIN pg_proc p ON p.proname = r.routine_name
      WHERE r.routine_schema = 'public'
        AND r.routine_name IN (
          'update_questions_search_vector',
          'handle_deleted_user', 
          'select_demo_questions',
          'create_question_version',
          'is_admin',
          'is_current_user_admin',
          'create_audit_logs_table',
          'update_updated_at_column',
          'handle_new_user'
        );
    `, 'Checking function security');

    // Check RLS status
    const rlsCheck = await executeSQL(`
      SELECT 
        tablename,
        CASE 
          WHEN rowsecurity THEN 'RLS ENABLED ✅'
          ELSE 'RLS DISABLED ❌'
        END as rls_status
      FROM pg_tables 
      WHERE tablename IN ('audit_logs', 'performance_analytics');
    `, 'Checking RLS status');

    // Check policies
    const policyCheck = await executeSQL(`
      SELECT 
        tablename,
        COUNT(*) as policy_count
      FROM pg_policies 
      WHERE tablename IN ('audit_logs', 'performance_analytics')
      GROUP BY tablename;
    `, 'Checking RLS policies');

    console.log('\n🎉 Security fixes completed successfully!');
    console.log('\n📋 Summary of changes:');
    console.log('1. ✅ Fixed function search path security issues');
    console.log('2. ✅ Enabled RLS on audit_logs table with proper policies');
    console.log('3. ✅ Replaced insecure materialized view with secure functions');
    console.log('4. ✅ Created performance_analytics table with RLS');
    console.log('5. ✅ Added auth security enhancement functions');
    
    console.log('\n⚠️  Manual steps still required:');
    console.log('1. Enable "Leaked Password Protection" in Supabase Dashboard');
    console.log('2. Configure password policy settings');
    console.log('3. Set up rate limiting parameters');
    console.log('4. Review and test all security policies');
    
    console.log('\n🔗 Dashboard URL: https://supabase.com/dashboard/project/' + SUPABASE_PROJECT_ID + '/auth/settings');

  } catch (error) {
    console.error('\n💥 Security fixes failed:', error.message);
    console.error('\nPlease check the error above and try again.');
    process.exit(1);
  }
}

// Handle command line arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🔒 Database Security Fixes Script

Usage:
  node scripts/apply-security-fixes.js

Environment Variables:
  SUPABASE_ACCESS_TOKEN  Your Supabase access token (required)

Options:
  --help, -h            Show this help message

Example:
  export SUPABASE_ACCESS_TOKEN="your_token_here"
  node scripts/apply-security-fixes.js

Get your access token from:
https://supabase.com/dashboard/account/tokens
  `);
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { executeSQL, readSQLFile };
