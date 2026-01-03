// src/app/api/public/stats/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/public/stats
 * Returns public statistics about the platform
 * No authentication required - uses the v_public_stats view
 */
export async function GET() {
  try {
    // Create a Supabase client with anon key for public access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Query the public stats view
    const { data, error } = await supabase
      .from('v_public_stats')
      .select('*')
      .single()

    if (error) {
      console.error('Error fetching public stats:', error)
      // Return fallback data on error
      return NextResponse.json({
        success: true,
        data: {
          expertQuestions: 0,
          categories: 0
        }
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
        }
      })
    }

    // Transform the data to match the expected format
    const stats = {
      expertQuestions: data.total_questions || 0,
      categories: data.total_categories || 0
    }

    return NextResponse.json({
      success: true,
      data: stats
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // Cache for 5 minutes
      }
    })

  } catch (error) {
    console.error('Public stats API error:', error)
    return NextResponse.json({
      success: true,
      data: {
        expertQuestions: 0,
        categories: 0
      }
    }, {
      status: 200, // Return 200 with fallback data instead of error
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120', // Shorter cache on error
      }
    })
  }
}

