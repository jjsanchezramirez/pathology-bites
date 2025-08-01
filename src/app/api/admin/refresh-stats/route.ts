// Background job to refresh user category statistics
// This endpoint can be called periodically to keep the materialized view updated

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Stats refresh - Authentication error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || userProfile?.role !== 'admin') {
      console.error('Stats refresh - Not admin:', profileError)
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    console.log('Starting materialized view refresh...')
    const startTime = Date.now()

    // Refresh the materialized view
    const { error: refreshError } = await supabase.rpc('refresh_user_category_stats')

    if (refreshError) {
      console.error('Error refreshing materialized view:', refreshError)
      return NextResponse.json({ 
        error: 'Failed to refresh statistics',
        details: refreshError.message 
      }, { status: 500 })
    }

    const duration = Date.now() - startTime
    console.log(`Materialized view refreshed successfully in ${duration}ms`)

    return NextResponse.json({
      success: true,
      message: 'User category statistics refreshed successfully',
      duration: `${duration}ms`
    })

  } catch (error) {
    console.error('Stats refresh error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check the status of the materialized view
export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get basic stats about the materialized view
    const { data: stats, error: statsError } = await supabase
      .from('user_category_stats')
      .select('user_id, category_id')
      .limit(1000)

    if (statsError) {
      console.error('Error fetching stats info:', statsError)
      return NextResponse.json({ 
        error: 'Failed to fetch statistics info',
        details: statsError.message 
      }, { status: 500 })
    }

    // Count unique users and categories
    const uniqueUsers = new Set(stats?.map(s => s.user_id) || []).size
    const uniqueCategories = new Set(stats?.map(s => s.category_id) || []).size
    const totalRecords = stats?.length || 0

    return NextResponse.json({
      success: true,
      materialized_view_stats: {
        total_records: totalRecords,
        unique_users: uniqueUsers,
        unique_categories: uniqueCategories,
        last_checked: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Stats info error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
