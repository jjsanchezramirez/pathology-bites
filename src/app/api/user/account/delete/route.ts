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
      .select('id, email, first_name, last_name, role')
      .eq('id', user.id)
      .single()

    if (userError) {
      console.error('Error fetching user data:', userError)
      return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 })
    }

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
          timestamp: new Date().toISOString()
        }
      })

    // Delete user from auth system - this will automatically trigger deletion from public.users
    // and cleanup of related data via the handle_deleted_user() trigger function
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
