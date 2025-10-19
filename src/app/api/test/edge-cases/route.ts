// src/app/api/test/edge-cases/route.ts
/**
 * Edge case tests for user management
 * Tests error scenarios and boundary conditions
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const adminClient = createClient(supabaseUrl, supabaseServiceKey)

interface EdgeCaseTestResult {
  testName: string
  passed: boolean
  details: string
}

export async function GET() {
  const results: EdgeCaseTestResult[] = []

  try {
    // Test 1: Verify no duplicate users
    console.log('Testing for duplicate users...')
    const { data: allUsers } = await adminClient
      .from('users')
      .select('id, email')

    if (allUsers) {
      const emailCounts: Record<string, number> = {}
      let duplicates = 0
      for (const user of allUsers) {
        emailCounts[user.email] = (emailCounts[user.email] || 0) + 1
        if (emailCounts[user.email] > 1) {
          duplicates++
        }
      }

      results.push({
        testName: 'No duplicate users by email',
        passed: duplicates === 0,
        details: `Duplicate emails found: ${duplicates}`
      })
    }

    // Test 2: Verify all users have valid roles
    console.log('Testing user roles...')
    const { data: usersWithRoles } = await adminClient
      .from('users')
      .select('id, role')

    const validRoles = ['admin', 'creator', 'reviewer', 'user']
    let invalidRoles = 0
    if (usersWithRoles) {
      for (const user of usersWithRoles) {
        if (!validRoles.includes(user.role)) {
          invalidRoles++
        }
      }
    }

    results.push({
      testName: 'All users have valid roles',
      passed: invalidRoles === 0,
      details: `Invalid roles found: ${invalidRoles}`
    })

    // Test 3: Verify all users have valid status
    console.log('Testing user status...')
    const { data: usersWithStatus } = await adminClient
      .from('users')
      .select('id, status')

    const validStatuses = ['active', 'inactive', 'suspended', 'deleted']
    let invalidStatuses = 0
    if (usersWithStatus) {
      for (const user of usersWithStatus) {
        if (!validStatuses.includes(user.status)) {
          invalidStatuses++
        }
      }
    }

    results.push({
      testName: 'All users have valid status',
      passed: invalidStatuses === 0,
      details: `Invalid statuses found: ${invalidStatuses}`
    })

    // Test 4: Verify soft-deleted users have deleted_at timestamp
    console.log('Testing soft-deleted users...')
    const { data: softDeletedUsers } = await adminClient
      .from('users')
      .select('id, status, deleted_at')
      .eq('status', 'deleted')

    let invalidSoftDeletes = 0
    if (softDeletedUsers) {
      for (const user of softDeletedUsers) {
        if (user.deleted_at === null) {
          invalidSoftDeletes++
        }
      }
    }

    results.push({
      testName: 'Soft-deleted users have deleted_at timestamp',
      passed: invalidSoftDeletes === 0,
      details: `Soft-deleted users without timestamp: ${invalidSoftDeletes}`
    })

    // Test 5: Verify active users don't have deleted_at
    console.log('Testing active users...')
    const { data: activeUsers } = await adminClient
      .from('users')
      .select('id, status, deleted_at')
      .eq('status', 'active')

    let invalidActiveUsers = 0
    if (activeUsers) {
      for (const user of activeUsers) {
        if (user.deleted_at !== null) {
          invalidActiveUsers++
        }
      }
    }

    results.push({
      testName: 'Active users do not have deleted_at timestamp',
      passed: invalidActiveUsers === 0,
      details: `Active users with deleted_at: ${invalidActiveUsers}`
    })

    // Test 6: Verify all user_settings have required fields
    console.log('Testing user_settings structure...')
    const { data: allSettings } = await adminClient
      .from('user_settings')
      .select('*')

    let invalidSettings = 0
    if (allSettings) {
      for (const setting of allSettings) {
        if (!setting.quiz_settings || !setting.notification_settings || !setting.ui_settings) {
          invalidSettings++
        }
      }
    }

    results.push({
      testName: 'All user_settings have required fields',
      passed: invalidSettings === 0,
      details: `Settings with missing fields: ${invalidSettings}`
    })

    // Test 7: Verify no orphaned user_settings
    console.log('Testing for orphaned user_settings...')
    const { data: settingsUserIds } = await adminClient
      .from('user_settings')
      .select('user_id')

    const { data: publicUserIds } = await adminClient
      .from('users')
      .select('id')

    let orphanedSettings = 0
    if (settingsUserIds && publicUserIds) {
      const publicIds = new Set(publicUserIds.map(u => u.id))
      for (const setting of settingsUserIds) {
        if (!publicIds.has(setting.user_id)) {
          orphanedSettings++
        }
      }
    }

    results.push({
      testName: 'No orphaned user_settings entries',
      passed: orphanedSettings === 0,
      details: `Orphaned settings: ${orphanedSettings}`
    })

    // Test 8: Verify user_settings count matches public.users count
    console.log('Testing user_settings count...')
    const { count: usersCount } = await adminClient
      .from('users')
      .select('id', { count: 'exact' })

    const { count: settingsCount } = await adminClient
      .from('user_settings')
      .select('id', { count: 'exact' })

    results.push({
      testName: 'user_settings count matches public.users count',
      passed: usersCount === settingsCount,
      details: `Users: ${usersCount}, Settings: ${settingsCount}`
    })

    // Test 9: Verify no users with null email
    console.log('Testing for null emails...')
    const { data: usersWithEmail } = await adminClient
      .from('users')
      .select('id, email')

    let nullEmails = 0
    if (usersWithEmail) {
      for (const user of usersWithEmail) {
        if (!user.email || user.email.trim() === '') {
          nullEmails++
        }
      }
    }

    results.push({
      testName: 'No users with null or empty email',
      passed: nullEmails === 0,
      details: `Users with null/empty email: ${nullEmails}`
    })

    // Test 10: Verify user_type values are valid
    console.log('Testing user_type values...')
    const { data: usersWithType } = await adminClient
      .from('users')
      .select('id, user_type')

    const validUserTypes = ['student', 'resident', 'faculty', 'other']
    let invalidUserTypes = 0
    if (usersWithType) {
      for (const user of usersWithType) {
        if (!validUserTypes.includes(user.user_type)) {
          invalidUserTypes++
        }
      }
    }

    results.push({
      testName: 'All users have valid user_type',
      passed: invalidUserTypes === 0,
      details: `Invalid user_types found: ${invalidUserTypes}`
    })

    const passedCount = results.filter(r => r.passed).length
    const totalCount = results.length

    return NextResponse.json({
      success: true,
      summary: {
        totalTests: totalCount,
        passed: passedCount,
        failed: totalCount - passedCount,
        passRate: `${((passedCount / totalCount) * 100).toFixed(1)}%`
      },
      results
    })

  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results
      },
      { status: 500 }
    )
  }
}

