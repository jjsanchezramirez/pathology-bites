// src/app/api/public/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { withRateLimit, generalAPIRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(generalAPIRateLimiter)

// Cache for public stats with 24-hour TTL
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
let cachedStats: any = null
let cacheTimestamp: number = 0

interface PublicStatsResponse {
  total_questions: number
  total_images: number
  total_categories: number
  last_refreshed: string
}

export const GET = rateLimitedHandler(async function() {
  try {
    // Check cache first
    const now = Date.now()
    if (cachedStats && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cachedStats,
        cached: true
      })
    }

    const supabase = await createClient()

    // Use secure function to retrieve public stats
    const { data: statsData, error: statsError } = await supabase
      .rpc('get_public_stats')
      .single<PublicStatsResponse>()

    if (statsError) {
      console.error('Error fetching public stats from materialized view:', statsError)
      throw statsError
    }

    const stats = {
      questions: statsData?.total_questions || 0,
      images: statsData?.total_images || 0,
      categories: statsData?.total_categories || 0
    }

    // Update cache
    cachedStats = stats
    cacheTimestamp = now

    return NextResponse.json({
      success: true,
      data: stats
    })

  } catch (error) {
    console.error('Error fetching public stats:', error)

    // Return fallback data on any error
    return NextResponse.json({
      success: true,
      data: {
        questions: 0,
        images: 0,
        categories: 0
      }
    })
  }
})

// Cache invalidation endpoint for admin use
export async function DELETE() {
  cachedStats = null
  cacheTimestamp = 0
  
  return NextResponse.json({
    success: true,
    message: 'Public stats cache cleared'
  })
}
