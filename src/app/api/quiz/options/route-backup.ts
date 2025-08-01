// src/app/api/quiz/options/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { SupabaseClient } from '@supabase/supabase-js'

// Helper function to extract short name from category name
function extractShortName(name: string): string {
  return name.replace(/^(Anatomic Pathology|Clinical Pathology)\s*-\s*/, '')
}

// Optimized function to get user statistics for all categories at once
async function getAllUserStats(
  supabase: SupabaseClient,
  userId: string,
  categoryQuestionCounts: Map<string, number>
) {
  try {
    // Get all user's quiz sessions
    const { data: userSessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', userId)

    if (sessionsError) {
      console.error('Error fetching user sessions:', sessionsError)
      return new Map()
    }

    const sessionIds = userSessions?.map(s => s.id) || []

    // Get all user's quiz attempts and favorites in parallel
    const [attemptsResult, favoritesResult] = await Promise.all([
      // Get all user's quiz attempts with category info
      sessionIds.length > 0
        ? supabase
            .from('quiz_attempts')
            .select(`
              question_id,
              is_correct,
              questions!inner(category_id)
            `)
            .in('quiz_session_id', sessionIds)
        : { data: [], error: null },

      // Get all user's favorites with category info
      supabase
        .from('user_favorites')
        .select(`
          question_id,
          questions!inner(category_id)
        `)
        .eq('user_id', userId)
    ])

    if (attemptsResult.error) {
      console.error('Error fetching user attempts:', attemptsResult.error)
    }

    if (favoritesResult.error) {
      console.error('Error fetching user favorites:', favoritesResult.error)
    }

    const attempts = attemptsResult.data || []
    const favorites = favoritesResult.data || []

    // Group attempts and favorites by category
    const categoryStats = new Map<string, {
      all: number
      unused: number
      incorrect: number
      marked: number
      correct: number
    }>()

    // Initialize stats for all categories
    for (const [categoryId, questionCount] of categoryQuestionCounts) {
      categoryStats.set(categoryId, {
        all: questionCount,
        unused: questionCount,
        incorrect: 0,
        marked: 0,
        correct: 0
      })
    }

    // Process attempts by category
    const attemptsByCategory = new Map<string, Set<string>>()
    const correctByCategory = new Map<string, Set<string>>()
    const incorrectByCategory = new Map<string, Set<string>>()

    for (const attempt of attempts) {
      const categoryId = (attempt as any).questions.category_id
      const questionId = attempt.question_id

      if (!attemptsByCategory.has(categoryId)) {
        attemptsByCategory.set(categoryId, new Set())
        correctByCategory.set(categoryId, new Set())
        incorrectByCategory.set(categoryId, new Set())
      }

      attemptsByCategory.get(categoryId)!.add(questionId)

      if (attempt.is_correct) {
        correctByCategory.get(categoryId)!.add(questionId)
      } else {
        incorrectByCategory.get(categoryId)!.add(questionId)
      }
    }

    // Process favorites by category
    const favoritesByCategory = new Map<string, Set<string>>()
    for (const favorite of favorites) {
      const categoryId = (favorite as any).questions.category_id
      const questionId = favorite.question_id

      if (!favoritesByCategory.has(categoryId)) {
        favoritesByCategory.set(categoryId, new Set())
      }
      favoritesByCategory.get(categoryId)!.add(questionId)
    }

    // Calculate final stats for each category
    for (const [categoryId, stats] of categoryStats) {
      const attempted = attemptsByCategory.get(categoryId)?.size || 0
      const correct = correctByCategory.get(categoryId)?.size || 0
      const incorrect = incorrectByCategory.get(categoryId)?.size || 0
      const marked = favoritesByCategory.get(categoryId)?.size || 0

      stats.unused = stats.all - attempted
      stats.correct = correct
      stats.incorrect = incorrect
      stats.marked = marked

      console.log(`User ${userId} stats for category ${categoryId}:`, {
        total: stats.all,
        unused: stats.unused,
        correct: stats.correct,
        incorrect: stats.incorrect,
        marked: stats.marked
      })
    }

    return categoryStats

  } catch (error) {
    console.error('Error calculating user question stats:', error)
    return new Map()
  }
}



// Simple in-memory cache for quiz options (5 minute TTL)
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET() {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Quiz options API - Authentication error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Quiz options API - User authenticated:', user.id)

    // Check cache first (skip cache if ?nocache=1 is present)
    const cacheKey = `quiz-options-${user.id}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('Returning cached quiz options (cached', Math.round((Date.now() - cached.timestamp) / 1000), 'seconds ago)')
      return NextResponse.json(cached.data)
    }

    // Get all categories first to understand the structure
    const { data: allCategories, error: allCategoriesError } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        description,
        parent_id,
        level,
        color
      `)
      .order('level, name')

    if (allCategoriesError) {
      console.error('Error fetching categories:', allCategoriesError)
      console.error('Categories error details:', {
        message: allCategoriesError.message,
        details: allCategoriesError.details,
        hint: allCategoriesError.hint,
        code: allCategoriesError.code
      })

      // If it's an RLS error, try to provide helpful information
      if (allCategoriesError.code === '42501' || allCategoriesError.message?.includes('RLS')) {
        console.error('RLS policy may be blocking access to categories table')
      }

      throw allCategoriesError
    }

    console.log('All categories found:', allCategories?.length || 0)
    console.log('Categories by level:', allCategories?.reduce((acc, cat) => {
      acc[cat.level] = (acc[cat.level] || 0) + 1
      return acc
    }, {} as Record<number, number>))

    // Get subcategories (level 2) - these are the actual pathology categories
    const categories = allCategories?.filter(cat => cat.level === 2) || []

    // Get parent categories (level 1) - these should be AP and CP
    const parentCategories = allCategories?.filter(cat => cat.level === 1) || []

    console.log('Subcategories found:', categories.length)
    console.log('Parent categories found:', parentCategories.length)

    // Create parent lookup
    const parentLookup = new Map(parentCategories?.map(p => [p.id, p.name]) || [])




    // Get question counts for all categories in a single optimized query
    const { data: questionCounts, error: questionCountsError } = await supabase
      .from('questions')
      .select('category_id, status')
      .in('category_id', categories?.map(c => c.id) || [])

    if (questionCountsError) {
      console.error('Error fetching question counts:', questionCountsError)
      throw questionCountsError
    }

    // Process question counts by category and status
    const categoryQuestionCounts = new Map<string, number>()
    const categoryStatusInfo = new Map<string, string>()

    // Initialize all categories with 0 count
    for (const category of categories || []) {
      categoryQuestionCounts.set(category.id, 0)
      categoryStatusInfo.set(category.id, 'none')
    }

    // Count questions by category and determine best status
    const statusPriority = ['approved', 'published', 'draft', 'pending_review']
    const categoryStatusCounts = new Map<string, Map<string, number>>()

    for (const question of questionCounts || []) {
      const categoryId = question.category_id
      const status = question.status

      if (!categoryStatusCounts.has(categoryId)) {
        categoryStatusCounts.set(categoryId, new Map())
      }

      const statusCounts = categoryStatusCounts.get(categoryId)!
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
    }

    // Determine final counts and status for each category
    for (const [categoryId, statusCounts] of categoryStatusCounts) {
      let bestStatus = 'any'
      let totalCount = 0

      // Try status priority order
      for (const status of statusPriority) {
        const count = statusCounts.get(status) || 0
        if (count > 0) {
          totalCount = count
          bestStatus = status
          break
        }
      }

      // If no priority status found, use total count
      if (totalCount === 0) {
        totalCount = Array.from(statusCounts.values()).reduce((sum, count) => sum + count, 0)
        bestStatus = 'any'
      }

      categoryQuestionCounts.set(categoryId, totalCount)
      categoryStatusInfo.set(categoryId, bestStatus)

      const category = categories?.find(c => c.id === categoryId)
      console.log(`Category ${category?.name}: ${totalCount} questions (status: ${bestStatus})`)
    }

    // Get user statistics for all categories at once
    const userStats = await getAllUserStats(supabase, user.id, categoryQuestionCounts)

    // Build final categories with stats
    const categoriesWithStats = (categories || []).map((category) => {
      const questionCount = categoryQuestionCounts.get(category.id) || 0
      const questionStats = userStats.get(category.id) || {
        all: questionCount,
        unused: questionCount,
        incorrect: 0,
        marked: 0,
        correct: 0
      }

      const parentName = parentLookup.get(category.parent_id || '')
      const parent = parentName === 'Anatomic Pathology' ? 'AP' :
                    parentName === 'Clinical Pathology' ? 'CP' : 'AP' // Default to AP

      return {
        id: category.id,
        name: category.name,
        shortName: extractShortName(category.name),
        parent: parent as 'AP' | 'CP',
        questionStats
      }
    })

    // Calculate overall statistics
    const overallStats = categoriesWithStats.reduce((acc, category) => {
      acc.all += category.questionStats.all
      acc.unused += category.questionStats.unused
      acc.incorrect += category.questionStats.incorrect
      acc.marked += category.questionStats.marked
      acc.correct += category.questionStats.correct
      return acc
    }, { all: 0, unused: 0, incorrect: 0, marked: 0, correct: 0 })

    // Calculate AP and CP specific stats
    const apStats = categoriesWithStats
      .filter(c => c.parent === 'AP')
      .reduce((acc, category) => {
        acc.all += category.questionStats.all
        acc.unused += category.questionStats.unused
        acc.incorrect += category.questionStats.incorrect
        acc.marked += category.questionStats.marked
        acc.correct += category.questionStats.correct
        return acc
      }, { all: 0, unused: 0, incorrect: 0, marked: 0, correct: 0 })

    const cpStats = categoriesWithStats
      .filter(c => c.parent === 'CP')
      .reduce((acc, category) => {
        acc.all += category.questionStats.all
        acc.unused += category.questionStats.unused
        acc.incorrect += category.questionStats.incorrect
        acc.marked += category.questionStats.marked
        acc.correct += category.questionStats.correct
        return acc
      }, { all: 0, unused: 0, incorrect: 0, marked: 0, correct: 0 })

    console.log('Final stats:', {
      categories: categoriesWithStats.length,
      overall: overallStats,
      ap: apStats,
      cp: cpStats
    })

    const responseData = {
      success: true,
      data: {
        categories: categoriesWithStats,
        questionTypeStats: {
          all: overallStats,
          ap_only: apStats,
          cp_only: cpStats
        }
      }
    }

    // Cache the result
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error fetching quiz options:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quiz options' },
      { status: 500 }
    )
  }
}
