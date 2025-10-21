// src/app/api/admin/system-status/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { getBucketSize } from '@/shared/services/r2-storage'
import { formatSize } from '@/features/images/services/image-upload'

interface SystemHealth {
  vercelStatus: 'operational' | 'error'
  supabaseStatus: 'operational' | 'error'
  cloudflareR2Status: 'operational' | 'error'
  responseTime: number
  dbQueryTime: number // Average database query time in ms
  dbConnections: number
  activeUsers: number // Currently active users (logged in within last 60 minutes)
  storageUsage: number // Supabase storage in MB
  r2StorageUsage: number // R2 storage in MB
  r2StorageFormatted: string // Formatted R2 storage
  lastUpdated: string
}

export async function GET() {
  const startTime = performance.now()

  try {
    const supabase = await createClient()

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
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const [storageStats, vercelStatusResponse, r2ImagesStats, r2DataStats, activeUsersResult] = await Promise.allSettled([
      supabase
        .from('v_storage_stats')
        .select('*')
        .single(),
      fetch('https://www.vercel-status.com/api/v2/status.json'),
      getBucketSize('pathology-bites-images'),
      getBucketSize('pathology-bites-data'),
      // Count active users (those with activity in last 60 minutes)
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('last_sign_in_at', sixtyMinutesAgo)
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

    // Get active users count
    let activeUsers = 0
    if (activeUsersResult.status === 'fulfilled' && activeUsersResult.value.count !== null) {
      activeUsers = activeUsersResult.value.count
    }

    const systemHealth: SystemHealth = {
      vercelStatus,
      supabaseStatus: dbTestResult.error ? 'error' : 'operational',
      cloudflareR2Status,
      responseTime,
      dbQueryTime,
      dbConnections: 1, // Hardcoded as requested
      activeUsers,
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
      storageUsage: 0,
      r2StorageUsage: 0,
      r2StorageFormatted: '0 MB',
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 200 })
  }
}
