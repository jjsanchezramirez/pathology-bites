// src/app/api/admin/system-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { getBucketSize } from '@/shared/services/r2-storage'
import { formatSize } from '@/features/images/services/image-upload'

interface SystemHealth {
  vercelStatus: 'operational' | 'error'
  supabaseStatus: 'operational' | 'error'
  cloudflareR2Status: 'operational' | 'error'
  responseTime: number
  dbConnections: number
  storageUsage: number // Supabase storage in MB
  r2StorageUsage: number // R2 storage in MB
  r2StorageFormatted: string // Formatted R2 storage
  errorRate: number // percentage
  lastUpdated: string
}

export async function GET() {
  const startTime = performance.now()

  try {
    const supabase = await createClient()

    // Test multiple services and get metrics
    const [dbTest, storageStats, vercelStatusResponse, r2ImagesStats, r2DataStats] = await Promise.allSettled([
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .limit(1),
      supabase
        .from('v_storage_stats')
        .select('*')
        .single(),
      fetch('https://www.vercel-status.com/api/v2/status.json'),
      getBucketSize('pathology-bites-images'),
      getBucketSize('pathology-bites-data')
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

    // Calculate error rate based on service failures
    const totalServices = 5 // DB, Storage, Vercel, R2 Images, R2 Data
    let failedServices = 0

    if (dbTest.status === 'rejected') failedServices++
    if (storageStats.status === 'rejected') failedServices++
    if (vercelStatusResponse.status === 'rejected' || vercelStatus === 'error') failedServices++
    if (r2ImagesStats.status === 'rejected') failedServices++
    if (r2DataStats.status === 'rejected') failedServices++

    const errorRate = Math.round((failedServices / totalServices) * 100)

    const systemHealth: SystemHealth = {
      vercelStatus,
      supabaseStatus: dbTest.status === 'rejected' ? 'error' : 'operational',
      cloudflareR2Status,
      responseTime,
      dbConnections: 1, // Simplified - could query actual connection pool stats
      storageUsage, // Supabase storage
      r2StorageUsage, // R2 storage
      r2StorageFormatted, // Formatted R2 storage
      errorRate,
      lastUpdated: new Date().toISOString()
    }

    // Only log errors, not successful checks
    if (dbTest.status === 'rejected') {
      console.error('Supabase connection error:', dbTest.reason)
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
      dbConnections: 0,
      storageUsage: 0,
      errorRate: 100,
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 200 })
  }
}
