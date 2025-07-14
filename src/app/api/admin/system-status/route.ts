// src/app/api/admin/system-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

interface SystemHealth {
  vercelStatus: 'operational' | 'error'
  supabaseStatus: 'operational' | 'error'
  responseTime: number
  lastUpdated: string
}

export async function GET() {
  const startTime = performance.now()

  try {
    const supabase = await createClient()

    // Simple database connectivity test - no auth required for health check
    const { error } = await supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    const endTime = performance.now()
    const responseTime = Math.round(endTime - startTime)

    const systemHealth: SystemHealth = {
      vercelStatus: 'operational', // If we're running, Vercel is working
      supabaseStatus: error ? 'error' : 'operational',
      responseTime,
      lastUpdated: new Date().toISOString()
    }

    // Only log errors, not successful checks
    if (error) {
      console.error('Supabase connection error:', error.message)
    }

    return NextResponse.json(systemHealth, { status: 200 })

  } catch (error) {
    console.error('System status check failed:', error)

    const endTime = performance.now()
    const responseTime = Math.round(endTime - startTime)

    const errorResponse: SystemHealth = {
      vercelStatus: 'operational', // We're still running
      supabaseStatus: 'error',
      responseTime,
      lastUpdated: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 200 })
  }
}
