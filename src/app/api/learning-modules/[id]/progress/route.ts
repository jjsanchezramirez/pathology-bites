// src/app/api/learning-modules/[id]/progress/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: moduleId } = await params
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { 
      action, // 'start_session', 'update_progress', 'complete_module'
      sections_viewed,
      completion_percentage,
      self_rating,
      confidence_level,
      feedback,
      found_helpful,
      learning_path_id,
      assessment_score
    } = body

    if (action === 'start_session') {
      // Create a new module session
      const { data: session, error } = await supabase
        .from('module_sessions')
        .insert({
          user_id: user.id,
          module_id: moduleId,
          learning_path_id: learning_path_id || null,
          accessed_via: learning_path_id ? 'learning_path' : 'direct',
          user_agent: request.headers.get('user-agent'),
          ip_address: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     '127.0.0.1'
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating module session:', error)
        return NextResponse.json(
          { error: 'Failed to start session' },
          { status: 500 }
        )
      }

      return NextResponse.json({ data: session })

    } else if (action === 'update_progress') {
      // Update the latest session with progress
      const { data: latestSession } = await supabase
        .from('module_sessions')
        .select('id')
        .eq('user_id', user.id)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestSession) {
        const { error } = await supabase
          .from('module_sessions')
          .update({
            sections_viewed: sections_viewed || [],
            completion_percentage: completion_percentage || 0
          })
          .eq('id', latestSession.id)

        if (error) {
          console.error('Error updating session progress:', error)
        }
      }

      return NextResponse.json({ message: 'Progress updated' })

    } else if (action === 'complete_module') {
      // End the current session
      const { data: latestSession } = await supabase
        .from('module_sessions')
        .select('id, started_at')
        .eq('user_id', user.id)
        .eq('module_id', moduleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (latestSession) {
        const endTime = new Date()
        const startTime = new Date(latestSession.started_at)
        const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60))

        await supabase
          .from('module_sessions')
          .update({
            ended_at: endTime.toISOString(),
            duration_minutes: durationMinutes,
            completion_percentage: 100
          })
          .eq('id', latestSession.id)
      }

      // Get the current attempt number
      const { data: existingAttempts } = await supabase
        .from('module_attempts')
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('module_id', moduleId)
        .order('attempt_number', { ascending: false })
        .limit(1)

      const attemptNumber = (existingAttempts?.[0]?.attempt_number || 0) + 1

      // Create a module attempt record
      const { data: attempt, error } = await supabase
        .from('module_attempts')
        .insert({
          user_id: user.id,
          module_id: moduleId,
          attempt_number: attemptNumber,
          completed_at: new Date().toISOString(),
          time_spent_minutes: latestSession ? 
            Math.round((new Date().getTime() - new Date(latestSession.started_at).getTime()) / (1000 * 60)) : 
            null,
          completion_status: 'completed',
          assessment_score: assessment_score || null,
          self_rating: self_rating || null,
          confidence_level: confidence_level || null,
          feedback: feedback || null,
          found_helpful: found_helpful || null,
          learning_path_id: learning_path_id || null,
          prerequisite_check_passed: true
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating module attempt:', error)
        return NextResponse.json(
          { error: 'Failed to complete module' },
          { status: 500 }
        )
      }

      return NextResponse.json({ data: attempt })

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Unexpected error in module progress API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: moduleId } = await params
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get user's sessions for this module
    const { data: sessions, error: sessionsError } = await supabase
      .from('module_sessions')
      .select('*')
      .eq('module_id', moduleId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('Error fetching module sessions:', sessionsError)
      return NextResponse.json(
        { error: 'Failed to fetch progress' },
        { status: 500 }
      )
    }

    // Get user's attempts for this module
    const { data: attempts, error: attemptsError } = await supabase
      .from('module_attempts')
      .select('*')
      .eq('module_id', moduleId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (attemptsError) {
      console.error('Error fetching module attempts:', attemptsError)
      return NextResponse.json(
        { error: 'Failed to fetch progress' },
        { status: 500 }
      )
    }

    const progress = {
      sessions: sessions || [],
      attempts: attempts || [],
      latest_attempt: attempts?.[0] || null,
      is_completed: attempts?.some(a => a.completion_status === 'completed') || false,
      best_score: attempts?.reduce((max, a) => 
        Math.max(max, a.assessment_score || 0), 0) || null,
      total_time_spent: sessions?.reduce((total, s) => 
        total + (s.duration_minutes || 0), 0) || 0,
      completion_count: attempts?.filter(a => a.completion_status === 'completed').length || 0
    }

    return NextResponse.json({ data: progress })

  } catch (error) {
    console.error('Unexpected error fetching module progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
