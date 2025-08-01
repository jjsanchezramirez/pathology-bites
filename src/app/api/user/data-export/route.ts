// src/app/api/user/data-export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile data
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
    }

    // Get user settings
    const { data: userSettingsData, error: settingsError } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single()

    const userSettings = userSettingsData?.settings

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError)
    }

    // Get quiz sessions
    const { data: quizSessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (sessionsError) {
      console.error('Error fetching quiz sessions:', sessionsError)
    }

    // Get quiz attempts
    const { data: quizAttempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select(`
        *,
        quiz_sessions!inner(user_id),
        questions(title, category_id),
        question_options(text, is_correct)
      `)
      .eq('quiz_sessions.user_id', user.id)
      .order('created_at', { ascending: false })

    if (attemptsError) {
      console.error('Error fetching quiz attempts:', attemptsError)
    }

    // Get user favorites
    const { data: favorites, error: favoritesError } = await supabase
      .from('user_favorites')
      .select(`
        *,
        questions(title, category_id)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (favoritesError) {
      console.error('Error fetching favorites:', favoritesError)
    }

    // Get question flags created by user
    const { data: questionFlags, error: flagsError } = await supabase
      .from('question_flags')
      .select(`
        *,
        questions(title, category_id)
      `)
      .eq('flagged_by', user.id)
      .order('created_at', { ascending: false })

    if (flagsError) {
      console.error('Error fetching question flags:', flagsError)
    }

    // Get question reports created by user
    const { data: questionReports, error: reportsError } = await supabase
      .from('question_reports')
      .select(`
        *,
        questions(title, category_id)
      `)
      .eq('reported_by', user.id)
      .order('created_at', { ascending: false })

    if (reportsError) {
      console.error('Error fetching question reports:', reportsError)
    }

    // Compile all user data
    const userData = {
      export_info: {
        generated_at: new Date().toISOString(),
        user_id: user.id,
        export_type: 'complete_user_data'
      },
      profile: userProfile,
      settings: userSettings || null,
      quiz_data: {
        sessions: quizSessions || [],
        attempts: quizAttempts || [],
        total_sessions: quizSessions?.length || 0,
        total_attempts: quizAttempts?.length || 0
      },
      favorites: favorites || [],
      question_flags: questionFlags || [],
      question_reports: questionReports || [],
      statistics: {
        total_quiz_sessions: quizSessions?.length || 0,
        total_quiz_attempts: quizAttempts?.length || 0,
        total_favorites: favorites?.length || 0,
        total_flags_created: questionFlags?.length || 0,
        total_reports_created: questionReports?.length || 0,
        account_created: userProfile?.created_at,
        last_updated: userProfile?.updated_at
      }
    }

    // Create audit log for data export
    await supabase
      .from('audit_logs')
      .insert({
        user_id: user.id,
        action: 'data_export',
        table_name: 'users',
        record_id: user.id,
        metadata: {
          export_timestamp: new Date().toISOString(),
          data_types_exported: [
            'profile',
            'settings',
            'quiz_sessions',
            'quiz_attempts',
            'favorites',
            'question_flags',
            'question_reports'
          ]
        }
      })

    return NextResponse.json({
      success: true,
      data: userData
    })

  } catch (error) {
    console.error('Error in data export:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
