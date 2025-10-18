import { createClient } from '@/shared/services/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/reviewers
 * 
 * Get list of available reviewers (users with admin or reviewer role)
 * Optionally includes workload (number of pending questions assigned)
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all users with admin or reviewer role
    const { data: reviewers, error: reviewersError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .in('role', ['admin', 'reviewer'])
      .eq('status', 'active')
      .order('first_name', { ascending: true })

    if (reviewersError) {
      console.error('Error fetching reviewers:', reviewersError)
      return NextResponse.json(
        { error: 'Failed to fetch reviewers' },
        { status: 500 }
      )
    }

    // Get workload for each reviewer (count of pending_review questions)
    const reviewerIds = reviewers.map(r => r.id)
    
    const { data: workloadData, error: workloadError } = await supabase
      .from('questions')
      .select('reviewer_id')
      .in('reviewer_id', reviewerIds)
      .eq('status', 'pending_review')

    if (workloadError) {
      console.error('Error fetching workload:', workloadError)
      // Continue without workload data
    }

    // Calculate workload per reviewer
    const workloadMap = new Map<string, number>()
    if (workloadData) {
      workloadData.forEach(q => {
        if (q.reviewer_id) {
          workloadMap.set(q.reviewer_id, (workloadMap.get(q.reviewer_id) || 0) + 1)
        }
      })
    }

    // Format response with workload
    const reviewersWithWorkload = reviewers.map(reviewer => ({
      id: reviewer.id,
      email: reviewer.email,
      first_name: reviewer.first_name,
      last_name: reviewer.last_name,
      full_name: reviewer.first_name
        ? reviewer.last_name
          ? `${reviewer.first_name} ${reviewer.last_name}`
          : reviewer.first_name
        : reviewer.email,
      role: reviewer.role,
      pending_count: workloadMap.get(reviewer.id) || 0,
    }))

    return NextResponse.json({
      reviewers: reviewersWithWorkload,
    })

  } catch (error) {
    console.error('Unexpected error fetching reviewers:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

