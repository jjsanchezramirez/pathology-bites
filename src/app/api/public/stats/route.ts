// src/app/api/public/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { withRateLimit, generalAPIRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(generalAPIRateLimiter)

export const GET = rateLimitedHandler(async function() {
  try {
    const supabase = await createClient()

    // Get approved questions count directly (published questions are now 'approved')
    const { count: questionCount, error: questionError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')

    // Get total images count
    const { count: imageCount, error: imageError } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })

    // Get unique categories from approved questions
    const { data: questionsWithCategories, error: categoryError } = await supabase
      .from('questions')
      .select('category_id')
      .eq('status', 'approved')
      .not('category_id', 'is', null)

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

    return NextResponse.json({
      success: true,
      data: {
        questions: questionCount || 0,
        images: imageCount || 0,
        categories: uniqueCategories || 0
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
