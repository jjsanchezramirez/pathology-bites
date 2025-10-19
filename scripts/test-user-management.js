#!/usr/bin/env node

/**
 * User management end-to-end tests
 * Tests user creation and deletion functionality
 */

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// UTILITIES
// ============================================================================

async function getDatabaseState() {
  try {
    const [authUsers, publicUsers, userSettings, softDeleted] = await Promise.all([
      adminClient.from('users').select('id', { count: 'exact' }).eq('status', 'active'),
      adminClient.from('users').select('id', { count: 'exact' }),
      adminClient.from('user_settings').select('id', { count: 'exact' }),
      adminClient.from('users').select('id', { count: 'exact' }).eq('status', 'deleted')
    ])

    return {
      activePublicUsers: authUsers.count || 0,
      totalPublicUsers: publicUsers.count || 0,
      userSettingsCount: userSettings.count || 0,
      softDeletedCount: softDeleted.count || 0
    }
  } catch (error) {
    console.error('Error getting database state:', error)
    throw error
  }
}

function logTestResult(testName, passed, details) {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`\n${status}: ${testName}`)
  if (details) {
    console.log(`   ${details}`)
  }
}

function logSection(title) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📋 ${title}`)
  console.log(`${'='.repeat(70)}`)
}

// ============================================================================
// TESTS
// ============================================================================

async function testUserCreation() {
  logSection('USER CREATION VERIFICATION')

  const state = await getDatabaseState()

  console.log(`\nDatabase State:`)
  console.log(`  - Active public.users: ${state.activePublicUsers}`)
  console.log(`  - Total public.users: ${state.totalPublicUsers}`)
  console.log(`  - user_settings: ${state.userSettingsCount}`)
  console.log(`  - Soft deleted: ${state.softDeletedCount}`)

  // Test 1: Verify counts match
  const activeCount = state.totalPublicUsers - state.softDeletedCount
  const countsMatch = state.activePublicUsers === activeCount
  logTestResult(
    'Active user counts are consistent',
    countsMatch,
    `Active: ${state.activePublicUsers}, Total - Soft Deleted: ${activeCount}`
  )

  // Test 2: Verify user_settings matches active users
  const settingsMatch = state.userSettingsCount === state.activePublicUsers
  logTestResult(
    'user_settings count matches active users',
    settingsMatch,
    `Settings: ${state.userSettingsCount}, Active users: ${state.activePublicUsers}`
  )

  // Test 3: Sample user verification
  console.log(`\n🔍 Sampling users to verify data integrity...`)
  const { data: sampleUsers, error: sampleError } = await adminClient
    .from('users')
    .select('id, email, role, status')
    .eq('status', 'active')
    .limit(5)

  if (sampleError) {
    console.error('Error fetching sample users:', sampleError)
    return
  }

  if (sampleUsers && sampleUsers.length > 0) {
    let allValid = true
    for (const user of sampleUsers) {
      const { data: settings, error: settingsError } = await adminClient
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      const hasSettings = !settingsError && settings
      if (!hasSettings) {
        allValid = false
        console.log(`   ❌ ${user.email} (${user.role}): Missing user_settings`)
      } else {
        console.log(`   ✅ ${user.email} (${user.role}): Complete`)
      }
    }
    logTestResult('Sample users have complete data', allValid)
  }

  // Test 4: Verify user_settings structure
  console.log(`\n🔍 Verifying user_settings structure...`)
  const { data: settingsSample, error: settingsError } = await adminClient
    .from('user_settings')
    .select('*')
    .limit(1)
    .single()

  if (!settingsError && settingsSample) {
    const hasFields = 
      settingsSample.quiz_settings &&
      settingsSample.notification_settings &&
      settingsSample.ui_settings

    logTestResult(
      'user_settings has required fields',
      hasFields,
      'quiz_settings, notification_settings, ui_settings'
    )
  }

  // Test 5: Role distribution
  console.log(`\n👥 Role distribution:`)
  const { data: allUsers } = await adminClient
    .from('users')
    .select('role')
    .eq('status', 'active')

  if (allUsers) {
    const roleCounts = {}
    allUsers.forEach(u => {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1
    })
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`   - ${role}: ${count}`)
    })
  }
}

async function testUserDeletion() {
  logSection('USER DELETION VERIFICATION')

  const initialState = await getDatabaseState()
  console.log(`\nInitial State:`)
  console.log(`  - Active users: ${initialState.activePublicUsers}`)
  console.log(`  - Total users: ${initialState.totalPublicUsers}`)
  console.log(`  - Soft deleted: ${initialState.softDeletedCount}`)

  // Test 1: Verify soft-deleted users are preserved
  console.log(`\n🔍 Verifying soft-deleted users...`)
  const { data: softDeletedUsers, error: softError } = await adminClient
    .from('users')
    .select('id, email, role, status, deleted_at')
    .eq('status', 'deleted')
    .limit(3)

  if (!softError && softDeletedUsers && softDeletedUsers.length > 0) {
    let allValid = true
    for (const user of softDeletedUsers) {
      const hasDeletedAt = user.deleted_at !== null
      const isDeleted = user.status === 'deleted'
      if (!hasDeletedAt || !isDeleted) {
        allValid = false
        console.log(`   ❌ ${user.email}: Invalid soft delete state`)
      } else {
        console.log(`   ✅ ${user.email}: Properly soft deleted`)
      }
    }
    logTestResult('Soft-deleted users are properly marked', allValid)
  } else {
    console.log(`   ℹ️  No soft-deleted users found`)
  }

  // Test 2: Verify no orphaned entries
  console.log(`\n🔍 Checking for orphaned entries...`)
  
  // Get all user IDs from public.users
  const { data: publicUserIds } = await adminClient
    .from('users')
    .select('id')

  // Get all user IDs from user_settings
  const { data: settingsUserIds } = await adminClient
    .from('user_settings')
    .select('user_id')

  if (publicUserIds && settingsUserIds) {
    const publicIds = new Set(publicUserIds.map(u => u.id))
    const settingsIds = new Set(settingsUserIds.map(u => u.user_id))

    // Check for orphaned settings
    let orphanedSettings = 0
    for (const id of settingsIds) {
      if (!publicIds.has(id)) {
        orphanedSettings++
      }
    }

    logTestResult(
      'No orphaned user_settings entries',
      orphanedSettings === 0,
      `Orphaned: ${orphanedSettings}`
    )
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function runAllTests() {
  console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                   USER MANAGEMENT END-TO-END TESTS                         ║
║                                                                            ║
║  Testing user creation and deletion functionality migrated from database  ║
║  triggers to application code.                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
  `)

  const startTime = Date.now()

  try {
    await testUserCreation()
    await testUserDeletion()

    logSection('FINAL DATABASE STATE')
    const finalState = await getDatabaseState()
    console.log(`
  ✅ Active public.users: ${finalState.activePublicUsers}
  ✅ Total public.users: ${finalState.totalPublicUsers}
  ✅ user_settings: ${finalState.userSettingsCount}
  ✅ Soft deleted: ${finalState.softDeletedCount}
    `)

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`\n✨ All tests completed in ${duration}s\n`)

  } catch (error) {
    console.error(`\n❌ Test suite failed:`, error)
    process.exit(1)
  }
}

runAllTests()

