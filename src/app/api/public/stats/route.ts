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
    // Check cache first - 24 hour TTL means we only hit DB once per day
    const now = Date.now()
    if (cachedStats && (now - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cachedStats,
        cached: true
      })
    }

    const supabase = await createClient()

    // Simple, optimized queries: count published questions and subcategories
    const { count: totalQuestionsCount, error: questionsError } = await supabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')

    if (questionsError) {
      console.error('[Public Stats] Error fetching questions count:', questionsError)
    }
    console.log('[Public Stats] Published questions count:', totalQuestionsCount)

    // Debug: Let's also fetch some actual categories to see what's there
    const { data: allCategories, error: allCategoriesError } = await supabase
      .from('categories')
      .select('id, name, parent_id, level')
      .limit(10)

    if (allCategoriesError) {
      console.error('[Public Stats] Error fetching all categories:', allCategoriesError)
    } else {
      console.log('[Public Stats] Sample categories:', allCategories)
      console.log('[Public Stats] Categories with parent_id:',
        allCategories?.filter(c => c.parent_id !== null).length)
    }

    const { count: categoriesCount, error: categoriesError } = await supabase
      .from('categories')
      .select('id', { count: 'exact', head: true })
      .not('parent_id', 'is', null)

    if (categoriesError) {
      console.error('[Public Stats] Error fetching categories count:', categoriesError)
    }
    console.log('[Public Stats] Subcategories count (parent_id IS NOT NULL):', categoriesCount)

    const stats = {
      expertQuestions: totalQuestionsCount || 0,
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
    console.error('[Public Stats] Error:', error)

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
