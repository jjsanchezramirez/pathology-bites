// src/app/api/public/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { withRateLimit, generalAPIRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(generalAPIRateLimiter)

// Cache for public stats with 5-minute TTL
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let cachedStats: any = null
let cacheTimestamp: number = 0

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

    // Parallel execution of all queries
    const [
      { count: questionCount, error: questionError },
      { count: imageCount, error: imageError },
      { data: questionsWithCategories, error: categoryError }
    ] = await Promise.all([
      // Get approved questions count
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved'),
      
      // Get total images count
      supabase
        .from('images')
        .select('*', { count: 'exact', head: true }),
      
      // Get unique categories from approved questions
      supabase
        .from('questions')
        .select('category_id')
        .eq('status', 'approved')
        .not('category_id', 'is', null)
    ])

    // Calculate unique categories count
    const uniqueCategories = questionsWithCategories
      ? [...new Set(questionsWithCategories.map(q => q.category_id))].length
      : 0

    // Log any errors but don't fail the request
    if (questionError) {
      console.error('Error fetching question count:', questionError)
    }
    if (imageError) {
      console.error('Error fetching image count:', imageError)
    }
    if (categoryError) {
      console.error('Error fetching category data:', categoryError)
    }

    const stats = {
      questions: questionCount || 0,
      images: imageCount || 0,
      categories: uniqueCategories || 0
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
