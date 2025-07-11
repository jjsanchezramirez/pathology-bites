// src/app/api/public/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { withRateLimit, generalAPIRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(generalAPIRateLimiter)

export const GET = rateLimitedHandler(async function() {
  try {
    const supabase = await createClient()

    // Get published questions count directly
    const { count: questionCount, error: questionError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    // Get total images count
    const { count: imageCount, error: imageError } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })

    // Get category count
    const { count: categoryCount, error: categoryError } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })

    // Log any errors but don't fail the request
    if (questionError) {
      console.error('Error fetching question count:', questionError)
    }
    if (imageError) {
      console.error('Error fetching image count:', imageError)
    }
    if (categoryError) {
      console.error('Error fetching category count:', categoryError)
    }

    return NextResponse.json({
      success: true,
      data: {
        questions: questionCount || 0,
        images: imageCount || 0,
        categories: categoryCount || 0
      }
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
