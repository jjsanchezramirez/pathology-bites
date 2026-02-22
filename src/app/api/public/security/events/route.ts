import { getUserIdFromHeaders } from '@/shared/utils/auth/auth-helpers'
// src/app/api/public/security/events/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { SecurityEvent } from '@/features/auth/services/session-security'

/**
 * @swagger
 * /api/public/security/events:
 *   post:
 *     summary: Log a security event
 *     description: Record a security event for the authenticated user. High-severity events trigger additional alerts and logging.
 *     tags:
 *       - Public - Security
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - severity
 *               - timestamp
 *             properties:
 *               type:
 *                 type: string
 *                 description: Type of security event
 *                 example: session_hijack_attempt
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: Severity level of the event
 *                 example: high
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 description: ISO 8601 timestamp of when the event occurred
 *                 example: 2024-01-15T10:30:00Z
 *               details:
 *                 type: object
 *                 description: Additional event details
 *               userAgent:
 *                 type: string
 *                 description: User agent string (optional, will use request header if not provided)
 *     responses:
 *       200:
 *         description: Security event logged successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad request - invalid event structure
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid event structure
 *       401:
 *         description: Unauthorized - missing authentication
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const userId = getUserIdFromHeaders(request)
    if (!userId) {
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
        user_id: userId,
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
      console.warn(`High-severity security event for user ${userId}:`, event)
      
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

/**
 * @swagger
 * /api/public/security/events:
 *   get:
 *     summary: Retrieve security events
 *     description: Retrieve security events with optional filtering by user ID, severity, pagination. Intended for admin/debugging purposes.
 *     tags:
 *       - Public - Security
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: Filter by severity level
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of events to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset for pagination
 *     responses:
 *       200:
 *         description: Successfully retrieved security events
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 events:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       user_id:
 *                         type: string
 *                       event_type:
 *                         type: string
 *                       severity:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       details:
 *                         type: object
 *                       user_agent:
 *                         type: string
 *                       ip_address:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to fetch events
 */
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
