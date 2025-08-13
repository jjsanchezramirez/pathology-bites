// src/app/api/admin/notifications/system-update/route.ts
// API endpoint for admins to broadcast system update notifications

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/client'
import { notificationGenerators } from '@/shared/services/notification-generators'

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Auth is now handled by middleware

    // Parse request body
    const body = await request.json()
    const {
      title,
      message,
      updateType,
      severity = 'info',
      targetAudience = 'all'
    } = body

    // Validate required fields
    if (!title || !message || !updateType) {
      return NextResponse.json(
        { error: 'Missing required fields: title, message, updateType' },
        { status: 400 }
      )
    }

    // Validate updateType
    const validUpdateTypes = ['maintenance', 'feature', 'announcement', 'security']
    if (!validUpdateTypes.includes(updateType)) {
      return NextResponse.json(
        { error: 'Invalid updateType. Must be one of: ' + validUpdateTypes.join(', ') },
        { status: 400 }
      )
    }

    // Validate severity
    const validSeverities = ['info', 'warning', 'critical']
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity. Must be one of: ' + validSeverities.join(', ') },
        { status: 400 }
      )
    }

    // Validate targetAudience
    const validAudiences = ['all', 'admin', 'user', 'creator', 'reviewer']
    if (!validAudiences.includes(targetAudience)) {
      return NextResponse.json(
        { error: 'Invalid targetAudience. Must be one of: ' + validAudiences.join(', ') },
        { status: 400 }
      )
    }

    // Broadcast the system update
    await notificationGenerators.broadcastSystemUpdate(
      title,
      message,
      updateType,
      severity,
      targetAudience
    )

    return NextResponse.json(
      { 
        message: 'System update notification broadcasted successfully',
        data: {
          title,
          message,
          updateType,
          severity,
          targetAudience
        }
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error broadcasting system update:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve system updates (for admin management)
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()

    // Auth is now handled by middleware

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Fetch system updates
    const { data: updates, error: updatesError } = await supabase
      .from('system_updates')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (updatesError) {
      console.error('Error fetching system updates:', updatesError)
      return NextResponse.json(
        { error: 'Failed to fetch system updates' },
        { status: 500 }
      )
    }

    // Get total count
    const { count, error: countError } = await supabase
      .from('system_updates')
      .select('*', { count: 'exact', head: true })

    if (countError) {
      console.error('Error getting system updates count:', countError)
      return NextResponse.json(
        { error: 'Failed to get system updates count' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: updates,
      pagination: {
        page,
        limit,
        total: count || 0,
        hasMore: (count || 0) > page * limit
      }
    })

  } catch (error) {
    console.error('Error fetching system updates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
