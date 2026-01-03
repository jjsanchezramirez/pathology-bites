import { getUserIdFromHeaders } from '@/shared/utils/auth-helpers'
// src/app/api/quiz/init/route.ts
// Batched endpoint for quiz page initialization
// Combines sessions + options into single request to reduce API calls

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

interface UserCategoryStats {
  category_id: string
  all_count: number
  unused_count: number
  incorrect_count: number
  marked_count: number
  correct_count: number
}

export async function GET(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log('[Quiz Init] Starting batched initialization', { requestId })
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Check authentication
    const userId = getUserIdFromHeaders(request)
    if (!userId) {
      console.error('[Quiz Init] Authentication error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const sessionLimit = parseInt(searchParams.get('sessionLimit') || '100', 10)

    // Execute all queries in parallel
    const [sessionsResult, categoriesResult] = await Promise.all([
      // 1. Fetch recent quiz sessions for title generation
      supabase
        .from('quiz_sessions')
        .select('title')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(sessionLimit),

      // 2. Fetch categories
      supabase
        .from('categories')
        .select('id, name, short_form, parent_id, level')
        .order('name')
        .limit(100)
    ])

    // Check for errors
    if (sessionsResult.error) {
      console.error('[Quiz Init] Sessions error:', sessionsResult.error)
      throw new Error('Failed to fetch quiz sessions')
    }

    if (categoriesResult.error) {
      console.error('[Quiz Init] Categories error:', categoriesResult.error)
      throw new Error('Failed to fetch categories')
    }

    // Extract session titles
    const sessionTitles = sessionsResult.data?.map(s => s.title) || []

    // Process categories
    const categories = categoriesResult.data || []
    const subcategories = categories.filter(cat => cat.level === 2)
    const parentCategories = categories.filter(cat => cat.level === 1)

    // Create parent lookup
    const parentLookup = new Map<string, string>()
    for (const parent of parentCategories) {
      parentLookup.set(parent.id, parent.name)
    }

    // Get category IDs for stats calculation
    const categoryIds = subcategories.map(cat => cat.id)

    // Fetch user stats using optimized database function
    const { data: userStatsData, error: statsError } = await supabase
      .rpc('get_user_category_stats', {
        p_user_id: userId,
        p_category_ids: categoryIds
      })

    if (statsError) {
      console.error('[Quiz Init] User stats error:', statsError)
      throw new Error('Failed to fetch user statistics')
    }

    // Create stats lookup map (category_id is UUID, convert to string for lookup)
    const statsMap = new Map<string, Omit<UserCategoryStats, 'category_id'>>()
    for (const stat of (userStatsData || [])) {
      const categoryId = typeof stat.category_id === 'string' ? stat.category_id : String(stat.category_id)
      statsMap.set(categoryId, {
        all: stat.all_count,
        unused: stat.unused_count,
        incorrect: stat.incorrect_count,
        marked: stat.marked_count,
        correct: stat.correct_count
      })
    }

    // Build categories with user stats
    const categoriesWithStats = subcategories.map((category) => {
      const stats = statsMap.get(category.id) || {
        all: 0,
        unused: 0,
        incorrect: 0,
        marked: 0,
        correct: 0
      }

      // Determine parent type
      const parentName = parentLookup.get(category.parent_id || '')
      const parent = parentName === 'Anatomic Pathology' ? 'AP' :
                    parentName === 'Clinical Pathology' ? 'CP' : 'AP'

      return {
        id: category.id,
        name: category.name,
        shortName: category.short_form || extractShortName(category.name),
        parent: parent as 'AP' | 'CP',
        questionStats: stats
      }
    })

    // Calculate overall statistics
    const overallStats = calculateOverallStats(categoriesWithStats)
    const apStats = calculateStatsForParent(categoriesWithStats, 'AP')
    const cpStats = calculateStatsForParent(categoriesWithStats, 'CP')

    const questionTypeStats = {
      all: overallStats,
      ap_only: apStats,
      cp_only: cpStats
    }

    const duration = Date.now() - startTime

    console.log('[Quiz Init] Completed successfully', {
      requestId,
      duration,
      sessionCount: sessionTitles.length,
      categoryCount: categoriesWithStats.length
    })

    return NextResponse.json({
      success: true,
      data: {
        sessions: {
          titles: sessionTitles,
          count: sessionTitles.length
        },
        options: {
          categories: categoriesWithStats,
          questionTypeStats
        }
      },
      meta: {
        requestId,
        duration,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    const duration = Date.now() - startTime
    console.error('[Quiz Init] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to initialize quiz data',
        details: error instanceof Error ? error.message : 'Unknown error',
        meta: {
          requestId,
          duration
        }
      },
      { status: 500 }
    )
  }
}

// Helper functions
function extractShortName(name: string): string {
  const match = name.match(/\(([^)]+)\)/)
  return match ? match[1] : name.split(' ').map(word => word[0]).join('').toUpperCase()
}

function calculateOverallStats(categories: unknown[]) {
  return categories.reduce((acc, cat) => ({
    all: acc.all + cat.questionStats.all,
    unused: acc.unused + cat.questionStats.unused,
    incorrect: acc.incorrect + cat.questionStats.incorrect,
    marked: acc.marked + cat.questionStats.marked,
    correct: acc.correct + cat.questionStats.correct
  }), { all: 0, unused: 0, incorrect: 0, marked: 0, correct: 0 })
}

function calculateStatsForParent(categories: unknown[], parent: 'AP' | 'CP') {
  return categories
    .filter(cat => cat.parent === parent)
    .reduce((acc, cat) => ({
      all: acc.all + cat.questionStats.all,
      unused: acc.unused + cat.questionStats.unused,
      incorrect: acc.incorrect + cat.questionStats.incorrect,
      marked: acc.marked + cat.questionStats.marked,
      correct: acc.correct + cat.questionStats.correct
    }), { all: 0, unused: 0, incorrect: 0, marked: 0, correct: 0 })
}

