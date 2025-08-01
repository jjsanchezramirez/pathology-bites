// Optimized Quiz Options API for Scale
// This version uses materialized views and denormalized data for better performance

import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { SupabaseClient } from '@supabase/supabase-js'

// Enhanced caching with user-specific invalidation
const cache = new Map<string, { data: any; timestamp: number; version: string }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Get user's last activity timestamp for cache invalidation
async function getUserCacheVersion(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data } = await supabase
    .from('quiz_sessions')
    .select('updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  
  return data?.updated_at || 'never'
}

// Optimized function using materialized view for user statistics
async function getOptimizedUserStats(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: string[]
) {
  try {
    // Use materialized view for pre-calculated statistics
    const { data: userStats, error: statsError } = await supabase
      .from('user_category_stats')
      .select('category_id, total_attempts, correct_attempts, incorrect_attempts, unique_questions_attempted')
      .eq('user_id', userId)
      .in('category_id', categoryIds)

    if (statsError) {
      console.error('Error fetching user stats from materialized view:', statsError)
      // Fallback to real-time calculation
      return await getFallbackUserStats(supabase, userId, categoryIds)
    }

    // Get user favorites efficiently
    const { data: favorites, error: favoritesError } = await supabase
      .from('user_favorites')
      .select('question_id, questions!inner(category_id)')
      .eq('user_id', userId)
      .in('questions.category_id', categoryIds)

    if (favoritesError) {
      console.error('Error fetching user favorites:', favoritesError)
    }

    // Process results into the expected format
    const categoryStats = new Map<string, {
      all: number
      unused: number
      incorrect: number
      marked: number
      correct: number
    }>()

    // Initialize all categories
    for (const categoryId of categoryIds) {
      categoryStats.set(categoryId, {
        all: 0,
        unused: 0,
        incorrect: 0,
        marked: 0,
        correct: 0
      })
    }

    // Process user statistics
    for (const stat of userStats || []) {
      const categoryId = stat.category_id
      const stats = categoryStats.get(categoryId)
      if (stats) {
        stats.correct = stat.correct_attempts || 0
        stats.incorrect = stat.incorrect_attempts || 0
        // unused = total questions in category - unique questions attempted
        // This will be calculated after we get question counts
      }
    }

    // Process favorites
    const favoritesByCategory = new Map<string, number>()
    for (const favorite of favorites || []) {
      const categoryId = (favorite as any).questions.category_id
      favoritesByCategory.set(categoryId, (favoritesByCategory.get(categoryId) || 0) + 1)
    }

    // Add favorites to stats
    for (const [categoryId, count] of favoritesByCategory) {
      const stats = categoryStats.get(categoryId)
      if (stats) {
        stats.marked = count
      }
    }

    return categoryStats

  } catch (error) {
    console.error('Error in optimized user stats:', error)
    return await getFallbackUserStats(supabase, userId, categoryIds)
  }
}

// Fallback to original method if materialized view fails
async function getFallbackUserStats(
  supabase: SupabaseClient,
  userId: string,
  categoryIds: string[]
) {
  try {
    // Get user's quiz sessions
    const { data: userSessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', userId)

    if (sessionsError) {
      console.error('Error fetching user sessions in fallback:', sessionsError)
      return new Map()
    }

    const sessionIds = userSessions?.map(s => s.id) || []

    // Get attempts and favorites using the denormalized fields
    const [attemptsResult, favoritesResult] = await Promise.all([
      sessionIds.length > 0
        ? supabase
            .from('quiz_attempts')
            .select('question_id, is_correct, category_id')
            .eq('user_id', userId)
            .in('category_id', categoryIds)
        : { data: [], error: null },

      supabase
        .from('user_favorites')
        .select('question_id, questions!inner(category_id)')
        .eq('user_id', userId)
        .in('questions.category_id', categoryIds)
    ])

    const attempts = attemptsResult.data || []
    const favorites = favoritesResult.data || []

    // Process results similar to optimized version
    const categoryStats = new Map()

    // Initialize with empty stats
    for (const categoryId of categoryIds) {
      categoryStats.set(categoryId, {
        all: 0,
        unused: 0,
        incorrect: 0,
        marked: 0,
        correct: 0
      })
    }

    // Process attempts
    for (const attempt of attempts) {
      const categoryId = attempt.category_id
      const stats = categoryStats.get(categoryId)
      if (stats) {
        if (attempt.is_correct) {
          stats.correct++
        } else {
          stats.incorrect++
        }
      }
    }

    // Process favorites
    for (const favorite of favorites) {
      const categoryId = (favorite as any).questions.category_id
      const stats = categoryStats.get(categoryId)
      if (stats) {
        stats.marked++
      }
    }

    return categoryStats
  } catch (error) {
    console.error('Error in fallback user stats:', error)
    // Return empty stats as last resort
    const categoryStats = new Map()
    for (const categoryId of categoryIds) {
      categoryStats.set(categoryId, {
        all: 0,
        unused: 0,
        incorrect: 0,
        marked: 0,
        correct: 0
      })
    }
    return categoryStats
  }
}

export async function GET() {
  const startTime = Date.now()
  
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Quiz options API - Authentication error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Optimized Quiz options API - User authenticated:', user.id)

    // Check cache with version validation
    const cacheKey = `quiz-options-${user.id}`
    const userVersion = await getUserCacheVersion(supabase, user.id)
    const cached = cache.get(cacheKey)
    
    if (cached && 
        Date.now() - cached.timestamp < CACHE_TTL && 
        cached.version === userVersion) {
      console.log('Returning cached quiz options (version match)')
      return NextResponse.json(cached.data)
    }

    // Fetch categories and question counts in parallel
    const [categoriesResult, questionCountsResult] = await Promise.all([
      // Get categories
      supabase
        .from('categories')
        .select('id, name, parent_id, level')
        .order('name'),
      
      // Get question counts efficiently
      supabase
        .from('questions')
        .select('category_id, status')
        .eq('status', 'approved') // Focus on approved questions only for better performance
    ])

    if (categoriesResult.error) {
      console.error('Error fetching categories:', categoriesResult.error)
      throw categoriesResult.error
    }

    if (questionCountsResult.error) {
      console.error('Error fetching question counts:', questionCountsResult.error)
      throw questionCountsResult.error
    }

    const categories = categoriesResult.data || []
    const questionCounts = questionCountsResult.data || []

    // Process categories and question counts
    const subcategories = categories.filter(cat => cat.level === 2)
    const parentCategories = categories.filter(cat => cat.level === 1)
    
    // Create parent lookup
    const parentLookup = new Map<string, string>()
    for (const parent of parentCategories) {
      parentLookup.set(parent.id, parent.name)
    }

    // Count questions by category
    const categoryQuestionCounts = new Map<string, number>()
    for (const question of questionCounts) {
      const categoryId = question.category_id
      categoryQuestionCounts.set(categoryId, (categoryQuestionCounts.get(categoryId) || 0) + 1)
    }

    console.log(`Found ${subcategories.length} categories with ${questionCounts.length} total questions`)

    // Get optimized user statistics
    const categoryIds = subcategories.map(cat => cat.id)
    const userStats = await getOptimizedUserStats(supabase, user.id, categoryIds)

    // Build final categories with stats
    const categoriesWithStats = subcategories.map((category) => {
      const questionCount = categoryQuestionCounts.get(category.id) || 0
      const stats = userStats.get(category.id) || {
        all: questionCount,
        unused: questionCount,
        incorrect: 0,
        marked: 0,
        correct: 0
      }

      // Update 'all' and 'unused' with actual question count
      stats.all = questionCount
      stats.unused = Math.max(0, questionCount - stats.correct - stats.incorrect)

      const parentName = parentLookup.get(category.parent_id || '')
      const parent = parentName === 'Anatomic Pathology' ? 'AP' :
                    parentName === 'Clinical Pathology' ? 'CP' : 'AP'

      console.log(`Category ${category.name}: ${questionCount} questions, User stats:`, stats)

      return {
        id: category.id,
        name: category.name,
        shortName: extractShortName(category.name),
        parent: parent as 'AP' | 'CP',
        questionStats: stats
      }
    })

    // Calculate overall statistics
    const overallStats = calculateOverallStats(categoriesWithStats)
    const apStats = calculateStatsForParent(categoriesWithStats, 'AP')
    const cpStats = calculateStatsForParent(categoriesWithStats, 'CP')

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

    // Cache with version
    cache.set(cacheKey, { 
      data: responseData, 
      timestamp: Date.now(),
      version: userVersion
    })

    const duration = Date.now() - startTime
    console.log(`Optimized API completed in ${duration}ms`)

    return NextResponse.json(responseData)

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`Quiz options API error after ${duration}ms:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions (same as original)
function extractShortName(name: string): string {
  const match = name.match(/\(([^)]+)\)/)
  return match ? match[1] : name.split(' ').map(word => word[0]).join('').toUpperCase()
}

function calculateOverallStats(categories: any[]) {
  return categories.reduce((acc, cat) => ({
    all: acc.all + cat.questionStats.all,
    unused: acc.unused + cat.questionStats.unused,
    incorrect: acc.incorrect + cat.questionStats.incorrect,
    marked: acc.marked + cat.questionStats.marked,
    correct: acc.correct + cat.questionStats.correct
  }), { all: 0, unused: 0, incorrect: 0, marked: 0, correct: 0 })
}

function calculateStatsForParent(categories: any[], parent: 'AP' | 'CP') {
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
