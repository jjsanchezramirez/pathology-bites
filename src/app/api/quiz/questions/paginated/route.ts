// src/app/api/quiz/questions/paginated/route.ts
/**
 * Paginated questions API endpoint for optimized data loading
 * Implements selective field loading and pagination to reduce bandwidth
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

interface PaginationParams {
  page: number
  limit: number
  category_id?: string
  difficulty?: string
  status?: string
  search?: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    
    const params: PaginationParams = {
      page: Math.max(1, parseInt(searchParams.get('page') || '1')),
      limit: Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10'))), // Max 50 per page
      category_id: searchParams.get('category_id') || undefined,
      difficulty: searchParams.get('difficulty') || undefined,
      status: searchParams.get('status') || 'approved', // Default to approved only
      search: searchParams.get('search') || undefined
    }

    // Calculate offset
    const offset = (params.page - 1) * params.limit

    // Build optimized query with selective field loading
    let query = supabase
      .from('questions')
      .select(`
        id,
        title,
        stem,
        difficulty,
        status,
        category_id,
        question_options!inner(
          id,
          text,
          is_correct
        )
      `, { count: 'exact' }) // Get total count for pagination
      .eq('status', params.status)
      .range(offset, offset + params.limit - 1)
      .order('created_at', { ascending: false })

    // Apply filters
    if (params.category_id) {
      query = query.eq('category_id', params.category_id)
    }

    if (params.difficulty) {
      query = query.eq('difficulty', params.difficulty)
    }

    if (params.search) {
      query = query.or(`title.ilike.%${params.search}%,stem.ilike.%${params.search}%`)
    }

    const { data: questions, error, count } = await query

    if (error) {
      console.error('Error fetching paginated questions:', error)
      throw error
    }

    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / params.limit)

    const result = {
      data: questions || [],
      pagination: {
        page: params.page,
        limit: params.limit,
        totalItems,
        totalPages,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1
      },
      filters: {
        category_id: params.category_id,
        difficulty: params.difficulty,
        status: params.status,
        search: params.search
      },
      performance: {
        queryOptimized: true,
        fieldsSelected: 'minimal',
        compressionEnabled: true
      }
    }

    // Return with compression and caching
    return createOptimizedResponse(result, {
      compress: true,
      cache: {
        maxAge: 600, // 10 minutes
        staleWhileRevalidate: 300, // 5 minutes
        public: false // User-specific data
      }
    })

  } catch (error) {
    console.error('Paginated questions API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * POST endpoint for bulk question operations (if needed)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { action, questionIds } = await request.json()

    if (!action || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { error: 'Invalid request. Requires action and questionIds array.' },
        { status: 400 }
      )
    }

    // Limit bulk operations to prevent excessive resource usage
    if (questionIds.length > 100) {
      return NextResponse.json(
        { error: 'Bulk operations limited to 100 questions at a time' },
        { status: 400 }
      )
    }

    let result
    switch (action) {
      case 'mark_favorite':
        // Add to favorites (with conflict handling)
        const favoriteInserts = questionIds.map(questionId => ({
          user_id: user.id,
          question_id: questionId
        }))
        
        result = await supabase
          .from('user_favorites')
          .upsert(favoriteInserts, { onConflict: 'user_id,question_id' })
        break

      case 'unmark_favorite':
        // Remove from favorites
        result = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', user.id)
          .in('question_id', questionIds)
        break

      case 'get_minimal_data':
        // Get minimal question data for bulk operations
        result = await supabase
          .from('questions')
          .select('id, title, difficulty, status')
          .in('id', questionIds)
          .limit(100)
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported: mark_favorite, unmark_favorite, get_minimal_data' },
          { status: 400 }
        )
    }

    if (result.error) {
      throw result.error
    }

    return createOptimizedResponse({
      success: true,
      action,
      affectedCount: result.data?.length || 0,
      data: result.data
    }, {
      compress: true,
      cache: {
        maxAge: 0, // Don't cache bulk operations
        public: false
      }
    })

  } catch (error) {
    console.error('Bulk questions operation error:', error)
    return NextResponse.json(
      { 
        error: 'Bulk operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
