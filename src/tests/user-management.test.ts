// src/tests/user-management.test.ts
/**
 * Comprehensive end-to-end tests for user creation and deletion
 * Tests both OAuth and email verification flows
 * Tests soft and hard deletion scenarios
 */

import { createClient } from '@supabase/supabase-js'

// Initialize Supabase clients
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const adminClient = createClient(supabaseUrl, supabaseServiceKey)

// ============================================================================
// DATABASE VERIFICATION UTILITIES
// ============================================================================

export interface DatabaseState {
  authUsersCount: number
  publicUsersCount: number
  userSettingsCount: number
  softDeletedCount: number
  orphanedAuthUsers: string[]
  orphanedPublicUsers: string[]
}

/**
 * Get current database state
 */
export async function getDatabaseState(): Promise<DatabaseState> {
  const [authUsers, publicUsers, userSettings, softDeleted] = await Promise.all([
    adminClient.from('auth.users').select('id', { count: 'exact' }),
    adminClient.from('users').select('id', { count: 'exact' }),
    adminClient.from('user_settings').select('id', { count: 'exact' }),
    adminClient.from('users').select('id').eq('status', 'deleted')
  ])

  // Find orphaned entries
  const authUserIds = new Set((authUsers.data || []).map(u => u.id))
  const publicUserIds = new Set((publicUsers.data || []).map(u => u.id))

  const orphanedAuthUsers = Array.from(authUserIds).filter(id => !publicUserIds.has(id))
  const orphanedPublicUsers = Array.from(publicUserIds).filter(id => !authUserIds.has(id))

  return {
    authUsersCount: authUsers.count || 0,
    publicUsersCount: publicUsers.count || 0,
    userSettingsCount: userSettings.count || 0,
    softDeletedCount: (softDeleted.data || []).length,
    orphanedAuthUsers,
    orphanedPublicUsers
  }
}

/**
 * Verify user exists in all required tables
 */
export async function verifyUserExists(userId: string): Promise<{
  inAuth: boolean
  inPublic: boolean
  inSettings: boolean
  publicData?: any
  settingsData?: any
}> {
  const [authUser, publicUser, settings] = await Promise.all([
    adminClient.auth.admin.getUserById(userId),
    adminClient.from('users').select('*').eq('id', userId).single(),
    adminClient.from('user_settings').select('*').eq('user_id', userId).single()
  ])

  return {
    inAuth: !authUser.data?.user ? false : true,
    inPublic: !publicUser.error,
    inSettings: !settings.error,
    publicData: publicUser.data,
    settingsData: settings.data
  }
}

/**
 * Verify user is completely deleted
 */
export async function verifyUserDeleted(userId: string): Promise<{
  deletedFromAuth: boolean
  deletedFromPublic: boolean
  deletedFromSettings: boolean
  deletedFromAllTables: boolean
}> {
  const [authUser, publicUser, settings] = await Promise.all([
    adminClient.auth.admin.getUserById(userId),
    adminClient.from('users').select('*').eq('id', userId).single(),
    adminClient.from('user_settings').select('*').eq('user_id', userId).single()
  ])

  return {
    deletedFromAuth: authUser.data?.user ? false : true,
    deletedFromPublic: publicUser.error?.code === 'PGRST116',
    deletedFromSettings: settings.error?.code === 'PGRST116',
    deletedFromAllTables: 
      (authUser.data?.user ? false : true) &&
      (publicUser.error?.code === 'PGRST116') &&
      (settings.error?.code === 'PGRST116')
  }
}

/**
 * Verify user is soft deleted
 */
export async function verifySoftDeleted(userId: string): Promise<{
  isSoftDeleted: boolean
  deletedAt?: string
  status?: string
  deletedFromAuth: boolean
}> {
  const [publicUser, authUser] = await Promise.all([
    adminClient.from('users').select('*').eq('id', userId).single(),
    adminClient.auth.admin.getUserById(userId)
  ])

  return {
    isSoftDeleted: publicUser.data?.status === 'deleted' && publicUser.data?.deleted_at !== null,
    deletedAt: publicUser.data?.deleted_at,
    status: publicUser.data?.status,
    deletedFromAuth: authUser.data?.user ? false : true
  }
}

/**
 * Count users in related tables
 */
export async function countUserRelatedData(userId: string): Promise<{
  userSettings: number
  userFavorites: number
  userAchievements: number
  performanceAnalytics: number
  notificationStates: number
  quizSessions: number
  quizAttempts: number
  moduleSessions: number
  moduleAttempts: number
  userLearning: number
}> {
  const tables = [
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

  const counts: any = {}

  for (const table of tables) {
    const { count } = await adminClient
      .from(table)
      .select('*', { count: 'exact' })
      .eq('user_id', userId)

    counts[table] = count || 0
  }

  return counts
}

// ============================================================================
// TEST UTILITIES
// ============================================================================

export function logTestResult(testName: string, passed: boolean, details?: string) {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  console.log(`\n${status}: ${testName}`)
  if (details) {
    console.log(`   Details: ${details}`)
  }
}

export function logTestSection(sectionName: string) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`📋 ${sectionName}`)
  console.log(`${'='.repeat(70)}`)
}

