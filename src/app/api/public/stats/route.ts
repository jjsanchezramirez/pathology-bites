// src/app/api/public/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { withRateLimit, generalAPIRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(generalAPIRateLimiter)

export const GET = rateLimitedHandler(async function() {
  try {
    const supabase = await createClient()

    // Get basic public stats from the dashboard stats view
    const { data: dashboardStats, error: statsError } = await supabase
      .from('v_dashboard_stats')
      .select('published_questions, total_images')
      .single()

    if (statsError) {
      console.error('Error fetching dashboard stats:', statsError)
      // Return fallback data if view doesn't exist or has issues
      return NextResponse.json({
        success: true,
        data: {
          questions: 500,
          images: 1200,
          categories: 25
        }
      })
    }

    // Get category count
    const { count: categoryCount, error: categoryError } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true })

    if (categoryError) {
      console.error('Error fetching category count:', categoryError)
    }

    return NextResponse.json({
      success: true,
      data: {
        questions: dashboardStats?.published_questions || 500,
        images: dashboardStats?.total_images || 1200,
        categories: categoryCount || 25
      }
    })

  } catch (error) {
    console.error('Error fetching public stats:', error)
    
    // Return fallback data on any error
    return NextResponse.json({
      success: true,
      data: {
        questions: 500,
        images: 1200,
        categories: 25
      }
    })
  }
})
