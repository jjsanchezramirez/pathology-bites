// src/app/api/user/account/delete/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Create Supabase client with service role for admin operations
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createSupabaseClient(supabaseUrl, supabaseServiceKey)
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json({ error: 'Password is required for account deletion' }, { status: 400 })
    }

    // Verify password before deletion
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: password
    })

    if (signInError) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
    }

    // Get user data before deletion for audit purposes
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, role, user_type')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

    // Determine deletion type based on role
    const isContentCreator = ['admin', 'creator', 'reviewer'].includes(userData.role)
    const deletionType = isContentCreator ? 'soft_delete' : 'hard_delete'

    // Create audit log before deletion
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'account_deletion',
        table_name: 'users',
        record_id: user.id,
        old_values: userData,
        new_values: null,
        metadata: {
          self_deletion: true,
          deletion_type: deletionType,
          timestamp: new Date().toISOString()
        }
      })

    /**
     * USER DELETION NOTE:
     * User deletion is handled AUTOMATICALLY by database triggers.
     * When a user is deleted from auth.users, the following cascade occurs:
     *
     * 1. Trigger: on_auth_user_deleted (AFTER DELETE on auth.users)
     *    - Calls: handle_auth_user_deletion()
     *    - For admin/creator/reviewer: SOFT DELETE (sets deleted_at, status='deleted')
     *    - For student/user: HARD DELETE (deletes from all user-related tables)
     *
     * 2. If hard delete, Trigger: trigger_handle_user_deletion (BEFORE DELETE on public.users)
     *    - Calls: handle_user_deletion()
     *    - Explicitly deletes from: user_settings, user_favorites, user_achievements,
     *      performance_analytics, notification_states, quiz_sessions, quiz_attempts,
     *      module_sessions, module_attempts, user_learning
     *
     * See: Database functions handle_auth_user_deletion() and handle_user_deletion()
     */

    // Delete user from auth system - triggers will handle the cascade
    try {
      const adminClient = createAdminClient()
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(user.id)

      if (authDeleteError) {
        console.error('Error deleting user from auth:', authDeleteError)
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
      }
    } catch (authDeleteError) {
      console.error('Error deleting user from auth:', authDeleteError)
      return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
    }

    // Sign out the user to clear their session
    try {
      await supabase.auth.signOut()
    } catch (signOutError) {
      console.error('Error signing out user after deletion:', signOutError)
      // Don't fail the request if sign out fails
    }

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    })

  } catch (error) {
    console.error('Error in account deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
