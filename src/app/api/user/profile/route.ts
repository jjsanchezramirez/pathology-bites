// src/app/api/user/profile/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

/**
 * GET /api/user/profile
 * Fetch the current user's profile information
 * 
 * Returns:
 * - id: User ID
 * - email: User email
 * - role: User role (admin, creator, reviewer, user)
 * - first_name: User's first name
 * - last_name: User's last name
 * - institution: User's institution
 * - user_type: User type (student, resident, faculty, other)
 * - status: User status (active, inactive, suspended, deleted)
 * - created_at: Account creation timestamp
 * - updated_at: Last update timestamp
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch user profile from users table
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, first_name, last_name, institution, user_type, status, created_at, updated_at')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[UserProfile API] Error fetching user profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      )
    }

    if (!userProfile) {
      console.error('[UserProfile API] User profile not found for user:', user.id)
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: userProfile
    })
  } catch (error) {
    console.error('[UserProfile API] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

