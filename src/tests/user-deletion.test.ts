// src/tests/user-deletion.test.ts
/**
 * User deletion tests
 * Tests soft and hard deletion scenarios
 */

import { createClient } from '@supabase/supabase-js'
import {
  getDatabaseState,
  verifyUserDeleted,
  verifySoftDeleted,
  countUserRelatedData,
  logTestResult,
  logTestSection
} from './user-management.test'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminClient = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// USER DELETION TESTS
// ============================================================================

export async function testUserDeletionFlow() {
  logTestSection('USER DELETION TESTS')

  const initialState = await getDatabaseState()
  console.log(`\nInitial Database State:`)
  console.log(`  - auth.users: ${initialState.authUsersCount}`)
  console.log(`  - public.users: ${initialState.publicUsersCount}`)
  console.log(`  - user_settings: ${initialState.userSettingsCount}`)
  console.log(`  - Soft deleted: ${initialState.softDeletedCount}`)

  // Test 1: Find a student user for hard delete testing
  console.log(`\n🔍 Finding test users...`)
  const { data: studentUsers } = await adminClient
    .from('users')
    .select('id, email, role, status')
    .eq('role', 'user')
    .eq('status', 'active')
    .limit(1)

  const { data: creatorUsers } = await adminClient
    .from('users')
    .select('id, email, role, status')
    .in('role', ['admin', 'creator', 'reviewer'])
    .eq('status', 'active')
    .limit(1)

  if (!studentUsers?.length) {
    console.log(`⚠️  No student users found for hard delete testing`)
    return
  }

  if (!creatorUsers?.length) {
    console.log(`⚠️  No creator/admin/reviewer users found for soft delete testing`)
    return
  }

  const studentUser = studentUsers[0]
  const creatorUser = creatorUsers[0]

  console.log(`   Student user: ${studentUser.email} (${studentUser.id})`)
  console.log(`   Creator user: ${creatorUser.email} (${creatorUser.id})`)

  // Test 2: Verify student user has related data
  console.log(`\n📊 Checking student user related data...`)
  const studentRelatedData = await countUserRelatedData(studentUser.id)
  console.log(`   Related data counts:`)
  Object.entries(studentRelatedData).forEach(([table, count]) => {
    if (count > 0) {
      console.log(`     - ${table}: ${count}`)
    }
  })

  // Test 3: Simulate hard delete (student user)
  console.log(`\n🗑️  Testing hard delete (student user)...`)
  console.log(`   Deleting user: ${studentUser.email}`)

  // Delete from all related tables
  const tablesToDelete = [
    'user_settings',
    'user_favorites',
    'user_achievements',
    'performance_analytics',
    'notification_states',
    'quiz_sessions',
    'quiz_attempts',
    'module_sessions',
    'module_attempts',
    'user_learning'
  ]

  for (const table of tablesToDelete) {
    await adminClient
      .from(table)
      .delete()
      .eq('user_id', studentUser.id)
  }

  // Delete from public.users
  await adminClient
    .from('users')
    .delete()
    .eq('id', studentUser.id)

  // Delete from auth.users
  await adminClient.auth.admin.deleteUser(studentUser.id)

  // Verify deletion
  const hardDeleteResult = await verifyUserDeleted(studentUser.id)
  logTestResult(
    'Hard delete: User completely removed',
    hardDeleteResult.deletedFromAllTables,
    `Auth: ${hardDeleteResult.deletedFromAuth}, Public: ${hardDeleteResult.deletedFromPublic}, Settings: ${hardDeleteResult.deletedFromSettings}`
  )

  // Test 4: Simulate soft delete (creator user)
  console.log(`\n🗑️  Testing soft delete (creator user)...`)
  console.log(`   Soft deleting user: ${creatorUser.email}`)

  // Update to soft delete
  await adminClient
    .from('users')
    .update({
      deleted_at: new Date().toISOString(),
      status: 'deleted',
      updated_at: new Date().toISOString()
    })
    .eq('id', creatorUser.id)

  // Delete from auth
  await adminClient.auth.admin.deleteUser(creatorUser.id)

  // Verify soft deletion
  const softDeleteResult = await verifySoftDeleted(creatorUser.id)
  logTestResult(
    'Soft delete: User marked as deleted',
    softDeleteResult.isSoftDeleted,
    `Status: ${softDeleteResult.status}, Deleted from auth: ${softDeleteResult.deletedFromAuth}`
  )

  // Test 5: Verify final database state
  console.log(`\n📊 Verifying final database state...`)
  const finalState = await getDatabaseState()
  console.log(`   Final counts:`)
  console.log(`     - auth.users: ${finalState.authUsersCount} (was ${initialState.authUsersCount})`)
  console.log(`     - public.users: ${finalState.publicUsersCount} (was ${initialState.publicUsersCount})`)
  console.log(`     - user_settings: ${finalState.userSettingsCount} (was ${initialState.userSettingsCount})`)
  console.log(`     - Soft deleted: ${finalState.softDeletedCount} (was ${initialState.softDeletedCount})`)

  const expectedAuthCount = initialState.authUsersCount - 2
  const expectedPublicCount = initialState.publicUsersCount - 1 // Hard delete removes, soft delete keeps
  const expectedSettingsCount = initialState.userSettingsCount - 1 // Hard delete removes settings

  logTestResult(
    'Database counts updated correctly',
    finalState.authUsersCount === expectedAuthCount &&
    finalState.publicUsersCount === expectedPublicCount &&
    finalState.userSettingsCount === expectedSettingsCount,
    `Auth: ${finalState.authUsersCount}/${expectedAuthCount}, Public: ${finalState.publicUsersCount}/${expectedPublicCount}, Settings: ${finalState.userSettingsCount}/${expectedSettingsCount}`
  )

  console.log(`\n✨ User deletion verification complete!`)
}

// Run tests
if (require.main === module) {
  testUserDeletionFlow().catch(console.error)
}

