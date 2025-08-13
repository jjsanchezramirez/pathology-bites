// src/app/api/security/events/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { SecurityEvent } from '@/features/auth/services/session-security'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse the security event
    const event: SecurityEvent = await request.json()

    // Validate the event structure
    if (!event.type || !event.severity || !event.timestamp) {
      return NextResponse.json(
        { error: 'Invalid event structure' },
        { status: 400 }
      )
    }

    // Get client IP and user agent
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Store the security event in the database
    const { error: insertError } = await supabase
      .from('security_events')
      .insert({
        user_id: user.id,
        event_type: event.type,
        severity: event.severity,
        timestamp: new Date(event.timestamp).toISOString(),
        details: event.details,
        user_agent: event.userAgent || userAgent,
        ip_address: clientIP,
        created_at: new Date().toISOString()
      })

    if (insertError) {
      console.error('Failed to store security event:', insertError)
      return NextResponse.json(
        { error: 'Failed to store event' },
        { status: 500 }
      )
    }

    // For high-severity events, you might want to trigger additional actions
    if (event.severity === 'high') {
      // Example: Send notification to admin, trigger additional security measures, etc.
      console.warn(`High-severity security event for user ${user.id}:`, event)
      
      // You could add additional logic here:
      // - Send email notifications
      // - Trigger account lockdown
      // - Alert security team
      // - Log to external security service
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Security event logging error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Optional: GET endpoint to retrieve security events for admin/debugging
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get query parameters
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')
    const severity = url.searchParams.get('severity')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // Build query
    let query = supabase
      .from('security_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (userId) {
      query = query.eq('user_id', userId)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data: events, error: queryError } = await query

    if (queryError) {
      console.error('Failed to fetch security events:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch events' },
        { status: 500 }
      )
    }

    return NextResponse.json({ events })

  } catch (error) {
    console.error('Security events fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
