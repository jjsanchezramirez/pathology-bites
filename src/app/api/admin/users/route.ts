import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey
    })
    throw new Error('Missing required Supabase environment variables')
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is now handled by middleware

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '0')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const search = searchParams.get('search') || ''
    const roleFilter = searchParams.get('role') || 'all'
    const statusFilter = searchParams.get('status') || 'all'

    // Build query for counting
    let countQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    // Build query for data
    let dataQuery = supabase
      .from('users')
      .select('*')

    // Apply search filter
    if (search) {
      const searchPattern = `%${search}%`
      countQuery = countQuery.or(`email.ilike.${searchPattern},first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
      dataQuery = dataQuery.or(`email.ilike.${searchPattern},first_name.ilike.${searchPattern},last_name.ilike.${searchPattern}`)
    }

    // Apply role filter
    if (roleFilter !== 'all') {
      countQuery = countQuery.eq('role', roleFilter)
      dataQuery = dataQuery.eq('role', roleFilter)
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      countQuery = countQuery.eq('status', statusFilter)
      dataQuery = dataQuery.eq('status', statusFilter)
    }

    // Get total count
    const { count, error: countError } = await countQuery
    if (countError) {
      throw countError
    }

    // Calculate pagination
    const from = page * pageSize
    const to = from + pageSize - 1

    // Get paginated data
    const { data, error: dataError } = await dataQuery
      .order('created_at', { ascending: false })
      .range(from, to)

    if (dataError) {
      throw dataError
    }

    return NextResponse.json({
      users: data || [],
      totalUsers: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
      currentPage: page
    })

  } catch (error) {
    console.error('Error in admin users API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is now handled by middleware

    const body = await request.json()
    const { userId, updates } = body

    if (!userId || !updates) {
      return NextResponse.json({ error: 'Missing userId or updates' }, { status: 400 })
    }

    // Update user with service role to bypass RLS
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw error
    }

    // If role was updated, also update the user's auth metadata
    if (updates.role) {
      try {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          userId,
          {
            app_metadata: { role: updates.role }
          }
        )

        if (authError) {
          console.error('Error updating auth metadata:', authError)
          // Don't fail the request if auth metadata update fails
        }
      } catch (authUpdateError) {
        console.error('Error updating user auth metadata:', authUpdateError)
        // Don't fail the request if auth metadata update fails
      }
    }

    return NextResponse.json({ user: data })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is now handled by middleware
    const { data: { user } } = await supabase.auth.getUser() // Still need user ID for self-deletion check

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    // Validate userId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 })
    }

    // Prevent admin from deleting themselves
    if (userId === user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Check if the user to be deleted exists
    const { data: targetUser, error: targetUserError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('id', userId)
      .single()

    if (targetUserError || !targetUser) {
      console.error('Target user not found:', targetUserError)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Create admin client for auth operations
    let adminClient
    try {
      adminClient = createAdminClient()
    } catch (adminClientError) {
      console.error('Failed to create admin client:', adminClientError)
      return NextResponse.json({
        error: 'Server configuration error - unable to perform admin operations'
      }, { status: 500 })
    }

    // Delete user from auth - this will automatically trigger deletion from public.users
    // and cleanup of related data via the handle_deleted_user() trigger function
    try {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)

      if (authDeleteError) {
        console.error('Error deleting user from auth:', {
          error: authDeleteError,
          userId,
          targetUser: { id: targetUser.id, email: targetUser.email, role: targetUser.role }
        })

        // Provide more specific error messages based on the error type
        if (authDeleteError.message?.includes('not found')) {
          return NextResponse.json({ error: 'User not found in authentication system' }, { status: 404 })
        } else if (authDeleteError.message?.includes('permission')) {
          return NextResponse.json({ error: 'Insufficient permissions to delete user' }, { status: 403 })
        } else {
          return NextResponse.json({
            error: `Failed to delete user: ${authDeleteError.message || 'Unknown error'}`
          }, { status: 500 })
        }
      }

      console.log('Successfully deleted user:', { userId, email: targetUser.email })
      return NextResponse.json({ success: true, message: 'User deleted successfully' })

    } catch (authDeleteError) {
      console.error('Exception during user deletion:', {
        error: authDeleteError,
        userId,
        targetUser: { id: targetUser.id, email: targetUser.email, role: targetUser.role }
      })

      return NextResponse.json({
        error: `Failed to delete user: ${authDeleteError instanceof Error ? authDeleteError.message : 'Unknown error'}`
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Error in DELETE /api/admin/users:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
