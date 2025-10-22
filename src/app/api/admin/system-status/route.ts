// src/app/api/admin/system-status/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getBucketSize } from '@/shared/services/r2-storage'
import { formatSize } from '@/features/images/services/image-upload'

interface SystemHealth {
  vercelStatus: 'operational' | 'error'
  supabaseStatus: 'operational' | 'error'
  cloudflareR2Status: 'operational' | 'error'
  responseTime: number
  dbQueryTime: number // Average database query time in ms
  dbConnections: number
  activeUsers: number // Currently active users (logged in within last 24 hours)
  activeUsersWeekly: number // Active users in last 7 days
  activeUsersMonthly: number // Active users in last 30 days
  storageUsage: number // Supabase storage in MB
  r2StorageUsage: number // R2 storage in MB
  r2StorageFormatted: string // Formatted R2 storage
  lastUpdated: string
}

export async function GET() {
  const startTime = performance.now()

  try {
    const supabase = await createClient()

    // Create a service role client for admin operations
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Measure database query time separately
    const dbStartTime = performance.now()
    const dbTestPromise = supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .limit(1)
    const dbTestResult = await dbTestPromise
    const dbEndTime = performance.now()
    const dbQueryTime = Math.round(dbEndTime - dbStartTime)

    // Test other services and get metrics in parallel
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const [storageStats, vercelStatusResponse, r2ImagesStats, r2DataStats, activeUsersResult] = await Promise.allSettled([
      supabase
        .from('v_storage_stats')
        .select('*')
        .single(),
      fetch('https://www.vercel-status.com/api/v2/status.json'),
      getBucketSize('pathology-bites-images'),
      getBucketSize('pathology-bites-data'),
      // Count active users from auth schema (last sign in within 24 hours)
      // Use service role client to access auth.admin API
      supabaseAdmin.auth.admin.listUsers()
    ])

    const endTime = performance.now()
    const responseTime = Math.round(endTime - startTime)

    // Check Vercel status
    let vercelStatus: 'operational' | 'error' = 'operational'
    if (vercelStatusResponse.status === 'fulfilled') {
      try {
        const vercelResponse = vercelStatusResponse.value as Response
        if (vercelResponse.ok) {
          const vercelData = await vercelResponse.json()
          // Vercel API returns status: { indicator: 'none' | 'minor' | 'major' | 'critical' }
          const indicator = vercelData?.status?.indicator
          vercelStatus = (indicator === 'none') ? 'operational' : 'error'
        } else {
          vercelStatus = 'error'
        }
      } catch (error) {
        console.error('Failed to check Vercel status:', error)
        vercelStatus = 'error'
      }
    } else {
      vercelStatus = 'error'
    }

    // Check Supabase storage
    let storageUsage = 0 // Supabase storage
    if (storageStats.status === 'fulfilled' && storageStats.value.data) {
      storageUsage = storageStats.value.data.total_size_mb || 0
    }

    // Check Cloudflare R2 status and get real usage
    let cloudflareR2Status: 'operational' | 'error' = 'operational'
    let r2StorageUsage = 0 // R2 storage in MB
    let r2StorageFormatted = '0 MB'

    if (r2ImagesStats.status === 'fulfilled' && r2DataStats.status === 'fulfilled') {
      try {
        const totalUsedBytes = r2ImagesStats.value.totalSize + r2DataStats.value.totalSize
        r2StorageUsage = Math.round(totalUsedBytes / (1024 * 1024)) // Convert to MB
        r2StorageFormatted = formatSize(totalUsedBytes)
      } catch (error) {
        console.error('Failed to calculate R2 stats:', error)
        cloudflareR2Status = 'error'
      }
    } else {
      cloudflareR2Status = 'error'
    }

    // Get active users count from auth.admin.listUsers() - daily, weekly, monthly
    let activeUsers = 0
    let activeUsersWeekly = 0
    let activeUsersMonthly = 0

    if (activeUsersResult.status === 'fulfilled') {
      const usersResponse = activeUsersResult.value
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

      if (usersResponse.data?.users) {
        // Filter users by last_sign_in_at for different time periods
        usersResponse.data.users.forEach(user => {
          if (!user.last_sign_in_at) return
          const lastSignIn = new Date(user.last_sign_in_at)

          // Count for 24 hours
          if (lastSignIn >= twentyFourHoursAgo) {
            activeUsers++
          }

          // Count for 7 days
          if (lastSignIn >= sevenDaysAgo) {
            activeUsersWeekly++
          }

          // Count for 30 days
          if (lastSignIn >= thirtyDaysAgo) {
            activeUsersMonthly++
          }
        })
      } else if (usersResponse.error) {
        console.error('[System Status] Error fetching users:', usersResponse.error)
      }
    }

    const systemHealth: SystemHealth = {
      vercelStatus,
      supabaseStatus: dbTestResult.error ? 'error' : 'operational',
      cloudflareR2Status,
      responseTime,
      dbQueryTime,
      dbConnections: 1, // Hardcoded as requested
      activeUsers,
      activeUsersWeekly,
      activeUsersMonthly,
      storageUsage, // Supabase storage
      r2StorageUsage, // R2 storage
      r2StorageFormatted, // Formatted R2 storage
      lastUpdated: new Date().toISOString()
    }

    // Only log errors, not successful checks
    if (dbTestResult.error) {
      console.error('Supabase connection error:', dbTestResult.error)
    }

    return NextResponse.json(systemHealth, { status: 200 })

  } catch (error) {
    console.error('System status check failed:', error)

    const endTime = performance.now()
    const responseTime = Math.round(endTime - startTime)

    const errorResponse: SystemHealth = {
      vercelStatus: 'operational', // We're still running
      supabaseStatus: 'error',
      cloudflareR2Status: 'error',
      responseTime,
      dbQueryTime: 0,
      dbConnections: 0,
      activeUsers: 0,
      activeUsersWeekly: 0,
      activeUsersMonthly: 0,
      storageUsage: 0,
      r2StorageUsage: 0,
      r2StorageFormatted: '0 MB',
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 200 })
  }
}
