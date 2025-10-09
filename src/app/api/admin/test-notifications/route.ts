// src/app/api/admin/test-notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { notificationsService } from '@/shared/services/service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Create test notifications
    await notificationsService.createTestNotifications()

    return NextResponse.json({ 
      success: true, 
      message: 'Test notifications created successfully' 
    })

  } catch (error) {
    console.error('Error creating test notifications:', error)
    return NextResponse.json(
      { error: 'Failed to create test notifications' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Use POST to create test notifications',
    endpoints: {
      'POST /api/admin/test-notifications': 'Create test notifications for all roles'
    }
  })
}
