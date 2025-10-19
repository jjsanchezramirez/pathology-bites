// src/app/api/test/user-management/route.ts
/**
 * User management test endpoint
 * Runs comprehensive tests on user creation and deletion
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminClient = createClient(supabaseUrl, supabaseServiceKey)

interface TestResult {
  name: string
  passed: boolean
  details?: string
}

interface DatabaseState {
  activePublicUsers: number
  totalPublicUsers: number
  userSettingsCount: number
  softDeletedCount: number
}

async function getDatabaseState(): Promise<DatabaseState> {
  const [activeUsers, totalUsers, settings, softDeleted] = await Promise.all([
    adminClient.from('users').select('id', { count: 'exact' }).eq('status', 'active'),
    adminClient.from('users').select('id', { count: 'exact' }),
    adminClient.from('user_settings').select('id', { count: 'exact' }),
    adminClient.from('users').select('id', { count: 'exact' }).eq('status', 'deleted')
  ])

  return {
    activePublicUsers: activeUsers.count || 0,
    totalPublicUsers: totalUsers.count || 0,
    userSettingsCount: settings.count || 0,
    softDeletedCount: softDeleted.count || 0
  }
}

async function testUserCreation(): Promise<TestResult[]> {
  const results: TestResult[] = []
  const state = await getDatabaseState()

  // Test 1: Verify counts match
  const activeCount = state.totalPublicUsers - state.softDeletedCount
  results.push({
    name: 'Active user counts are consistent',
    passed: state.activePublicUsers === activeCount,
    details: `Active: ${state.activePublicUsers}, Total - Soft Deleted: ${activeCount}`
  })

  // Test 2: Verify user_settings matches total users (including soft-deleted)
  // Soft-deleted users keep their settings for reference
  results.push({
    name: 'user_settings count matches total users',
    passed: state.userSettingsCount === state.totalPublicUsers,
    details: `Settings: ${state.userSettingsCount}, Total users: ${state.totalPublicUsers}`
  })

  // Test 3: Sample user verification
  const { data: sampleUsers } = await adminClient
    .from('users')
    .select('id, email, role, status')
    .eq('status', 'active')
    .limit(5)

  if (sampleUsers && sampleUsers.length > 0) {
    let allValid = true
    for (const user of sampleUsers) {
      const { error: settingsError } = await adminClient
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (settingsError) {
        allValid = false
        break
      }
    }
    results.push({
      name: 'Sample users have complete data',
      passed: allValid,
      details: `Checked ${sampleUsers.length} users`
    })
  }

  // Test 4: Verify user_settings structure
  const { data: settingsSample } = await adminClient
    .from('user_settings')
    .select('*')
    .limit(1)
    .single()

  if (settingsSample) {
    const hasFields = 
      settingsSample.quiz_settings &&
      settingsSample.notification_settings &&
      settingsSample.ui_settings

    results.push({
      name: 'user_settings has required fields',
      passed: hasFields,
      details: 'quiz_settings, notification_settings, ui_settings'
    })
  }

  return results
}

async function testUserDeletion(): Promise<TestResult[]> {
  const results: TestResult[] = []

  // Test 1: Verify soft-deleted users are preserved
  const { data: softDeletedUsers } = await adminClient
    .from('users')
    .select('id, email, role, status, deleted_at')
    .eq('status', 'deleted')
    .limit(3)

  if (softDeletedUsers && softDeletedUsers.length > 0) {
    let allValid = true
    for (const user of softDeletedUsers) {
      if (user.deleted_at === null || user.status !== 'deleted') {
        allValid = false
        break
      }
    }
    results.push({
      name: 'Soft-deleted users are properly marked',
      passed: allValid,
      details: `Checked ${softDeletedUsers.length} soft-deleted users`
    })
  } else {
    results.push({
      name: 'Soft-deleted users are properly marked',
      passed: true,
      details: 'No soft-deleted users found (expected)'
    })
  }

  // Test 2: Verify no orphaned entries
  const { data: publicUserIds } = await adminClient
    .from('users')
    .select('id')

  const { data: settingsUserIds } = await adminClient
    .from('user_settings')
    .select('user_id')

  if (publicUserIds && settingsUserIds) {
    const publicIds = new Set(publicUserIds.map(u => u.id))
    let orphanedSettings = 0
    for (const id of settingsUserIds) {
      if (!publicIds.has(id.user_id)) {
        orphanedSettings++
      }
    }

    results.push({
      name: 'No orphaned user_settings entries',
      passed: orphanedSettings === 0,
      details: `Orphaned: ${orphanedSettings}`
    })
  }

  return results
}

export async function GET() {
  try {
    const creationResults = await testUserCreation()
    const deletionResults = await testUserDeletion()
    const finalState = await getDatabaseState()

    const allResults = [...creationResults, ...deletionResults]
    const passedCount = allResults.filter(r => r.passed).length
    const totalCount = allResults.length

    return NextResponse.json({
      success: true,
      summary: {
        totalTests: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        passRate: `${((passedCount / totalCount) * 100).toFixed(1)}%`
      },
      databaseState: finalState,
      results: {
        creation: creationResults,
        deletion: deletionResults
      },
      allResults
    })
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

