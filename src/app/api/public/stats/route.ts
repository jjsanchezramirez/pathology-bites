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
  expert_questions: number
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

    // First get expert_generated question set IDs
    const { data: expertSets, error: setsError } = await supabase
      .from('question_sets')
      .select('id')
      .eq('source_type', 'expert_generated')

    if (setsError) {
      console.error('Error fetching expert question sets:', setsError)
    }

    const expertSetIds = expertSets?.map(set => set.id) || []

    // Get count of expert-curated questions
    const { count: expertQuestionsCount, error: expertError } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .in('question_set_id', expertSetIds.length > 0 ? expertSetIds : [''])

    if (expertError) {
      console.error('Error fetching expert questions count:', expertError)
    }

    // Get count of subcategories (level > 0 or parent_id is not null)
    const { count: categoriesCount, error: categoriesError } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .or('level.gt.0,parent_id.not.is.null')

    if (categoriesError) {
      console.error('Error fetching categories count:', categoriesError)
    }

    const stats = {
      expertQuestions: expertQuestionsCount || 0,
      categories: categoriesCount || 0
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
        expertQuestions: 0,
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
