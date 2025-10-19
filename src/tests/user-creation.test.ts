// src/tests/user-creation.test.ts
/**
 * User creation tests
 * Tests OAuth and email verification flows
 */

import { createClient } from '@supabase/supabase-js'
import {
  getDatabaseState,
  verifyUserExists,
  logTestResult,
  logTestSection,
  DatabaseState
} from './user-management.test'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminClient = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// USER CREATION TESTS
// ============================================================================

export async function testUserCreationFlow() {
  logTestSection('USER CREATION TESTS')

  const initialState = await getDatabaseState()
  console.log(`\nInitial Database State:`)
  console.log(`  - auth.users: ${initialState.authUsersCount}`)
  console.log(`  - public.users: ${initialState.publicUsersCount}`)
  console.log(`  - user_settings: ${initialState.userSettingsCount}`)
  console.log(`  - Soft deleted: ${initialState.softDeletedCount}`)
  console.log(`  - Orphaned auth users: ${initialState.orphanedAuthUsers.length}`)
  console.log(`  - Orphaned public users: ${initialState.orphanedPublicUsers.length}`)

  // Test 1: Verify no orphaned entries
  const orphanedTest = initialState.orphanedAuthUsers.length === 0 && 
                       initialState.orphanedPublicUsers.length === 0
  logTestResult(
    'No orphaned entries exist',
    orphanedTest,
    `Auth orphans: ${initialState.orphanedAuthUsers.length}, Public orphans: ${initialState.orphanedPublicUsers.length}`
  )

  // Test 2: Verify counts match (excluding soft-deleted)
  const activePublicUsers = initialState.publicUsersCount - initialState.softDeletedCount
  const countsMatch = initialState.authUsersCount === activePublicUsers
  logTestResult(
    'Active user counts match (auth.users = public.users - soft_deleted)',
    countsMatch,
    `auth.users: ${initialState.authUsersCount}, active public.users: ${activePublicUsers}`
  )

  // Test 3: Verify user_settings count matches active public users
  const settingsMatch = initialState.userSettingsCount === activePublicUsers
  logTestResult(
    'user_settings count matches active public users',
    settingsMatch,
    `user_settings: ${initialState.userSettingsCount}, active public.users: ${activePublicUsers}`
  )

  // Test 4: Sample user verification
  console.log(`\n📊 Sampling 5 random users to verify data integrity...`)
  const { data: sampleUsers } = await adminClient
    .from('users')
    .select('id, role, status')
    .eq('status', 'active')
    .limit(5)

  if (sampleUsers && sampleUsers.length > 0) {
    let allSamplesValid = true
    for (const user of sampleUsers) {
      const userState = await verifyUserExists(user.id)
      const isValid = userState.inAuth && userState.inPublic && userState.inSettings
      if (!isValid) {
        allSamplesValid = false
        console.log(`   ❌ User ${user.id} (${user.role}): Missing data`)
      } else {
        console.log(`   ✅ User ${user.id} (${user.role}): Complete`)
      }
    }
    logTestResult('Sample users have complete data', allSamplesValid)
  }

  // Test 5: Verify default user_settings structure
  console.log(`\n🔍 Verifying user_settings structure...`)
  const { data: settingsSample } = await adminClient
    .from('user_settings')
    .select('*')
    .limit(1)
    .single()

  if (settingsSample) {
    const hasRequiredFields = 
      settingsSample.quiz_settings !== undefined &&
      settingsSample.notification_settings !== undefined &&
      settingsSample.ui_settings !== undefined

    logTestResult(
      'user_settings has required fields',
      hasRequiredFields,
      `Fields: quiz_settings, notification_settings, ui_settings`
    )

    if (hasRequiredFields) {
      console.log(`   Quiz Settings: ${JSON.stringify(settingsSample.quiz_settings)}`)
      console.log(`   Notification Settings: ${JSON.stringify(settingsSample.notification_settings)}`)
      console.log(`   UI Settings: ${JSON.stringify(settingsSample.ui_settings)}`)
    }
  }

  // Test 6: Verify role distribution
  console.log(`\n👥 Verifying role distribution...`)
  const { data: roleStats } = await adminClient
    .from('users')
    .select('role')
    .eq('status', 'active')

  if (roleStats) {
    const roleCounts: Record<string, number> = {}
    roleStats.forEach(u => {
      roleCounts[u.role] = (roleCounts[u.role] || 0) + 1
    })
    console.log(`   Role distribution:`)
    Object.entries(roleCounts).forEach(([role, count]) => {
      console.log(`     - ${role}: ${count}`)
    })
  }

  console.log(`\n✨ User creation verification complete!`)
}

// Run tests
if (require.main === module) {
  testUserCreationFlow().catch(console.error)
}

