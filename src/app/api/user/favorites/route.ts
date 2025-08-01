// src/app/api/user/favorites/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

// GET /api/user/favorites - Get user's favorite questions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('category_id')
    const limit = searchParams.get('limit')
    const offset = searchParams.get('offset')

    // Build query
    let query = supabase
      .from('user_favorites')
      .select(`
        id,
        question_id,
        created_at,
        questions!inner (
          id,
          title,
          category_id,
          status,
          difficulty,
          categories (
            id,
            name
          )
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Filter by category if specified
    if (categoryId) {
      query = query.eq('questions.category_id', categoryId)
    }

    // Add pagination if specified
    if (limit) {
      const limitNum = parseInt(limit)
      const offsetNum = offset ? parseInt(offset) : 0
      query = query.range(offsetNum, offsetNum + limitNum - 1)
    }

    const { data: favorites, error } = await query

    if (error) {
      console.error('Error fetching user favorites:', error)
      return NextResponse.json({ error: 'Failed to fetch favorites' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: favorites || []
    })

  } catch (error) {
    console.error('Error in user favorites GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/user/favorites - Add a question to favorites
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { question_id } = await request.json()

    if (!question_id) {
      return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
    }

    // Check if question exists and is accessible
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id, status')
      .eq('id', question_id)
      .single()

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    if (question.status !== 'approved' && question.status !== 'published') {
      return NextResponse.json({ error: 'Question not available' }, { status: 403 })
    }

    // Add to favorites (will fail if already exists due to unique constraint)
    const { data: favorite, error } = await supabase
      .from('user_favorites')
      .insert({
        user_id: user.id,
        question_id
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Question already in favorites' }, { status: 409 })
      }
      console.error('Error adding to favorites:', error)
      return NextResponse.json({ error: 'Failed to add to favorites' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: favorite
    })

  } catch (error) {
    console.error('Error in user favorites POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/user/favorites - Remove a question from favorites
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { question_id } = await request.json()

    if (!question_id) {
      return NextResponse.json({ error: 'question_id is required' }, { status: 400 })
    }

    // Remove from favorites
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('question_id', question_id)

    if (error) {
      console.error('Error removing from favorites:', error)
      return NextResponse.json({ error: 'Failed to remove from favorites' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Removed from favorites'
    })

  } catch (error) {
    console.error('Error in user favorites DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
