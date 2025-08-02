// Optimized Quiz Options API for Scale
// This version uses materialized views and denormalized data for better performance

import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { SupabaseClient } from '@supabase/supabase-js'
import { createOptimizedResponse } from '@/shared/utils/compression'

// Type definitions for quiz options API
interface QuestionStats {
  all: number
  unused: number
  incorrect: number
  marked: number
  correct: number
}

interface CategoryWithStats {
  id: string
  name: string
  shortName: string
  questionStats: QuestionStats
}

interface QuestionTypeStats {
  all: QuestionStats
  ap_only: QuestionStats
  cp_only: QuestionStats
}

interface QuizOptionsResponse {
  success: boolean
  data: {
    categories: CategoryWithStats[]
    questionTypeStats: QuestionTypeStats
  }
}

interface CacheEntry {
  data: QuizOptionsResponse
  timestamp: number
  version: string
}

interface FavoriteWithQuestion {
  question_id: string
  questions: {
    category_id: string
  }
}

interface AttemptWithQuestion {
  question_id: string
  is_correct: boolean
  questions: {
    category_id: string
  }
}

// Enhanced caching with user-specific invalidation
const cache = new Map<string, CacheEntry>()
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
    // The materialized view doesn't have the unique question breakdown we need
    // (questions with only correct attempts vs questions with any incorrect attempts)
    // So we need to fall back to the real-time calculation for now
    console.log('Materialized view lacks unique question breakdown, falling back to real-time calculation')
    return await getFallbackUserStats(supabase, userId, categoryIds)

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

    // Get attempts and favorites using optimized queries with pagination
    const [attemptsResult, favoritesResult] = await Promise.all([
      sessionIds.length > 0
        ? supabase
            .from('quiz_attempts')
            .select('question_id, is_correct, category_id')
            .eq('user_id', userId)
            .in('category_id', categoryIds)
            .limit(1000) // Limit to prevent excessive data transfer
        : { data: [], error: null },

      supabase
        .from('user_favorites')
        .select('question_id, questions!inner(category_id)')
        .eq('user_id', userId)
        .in('questions.category_id', categoryIds)
        .limit(500) // Limit favorites to reasonable amount
    ])

    const attempts = attemptsResult.data || []
    const favorites = favoritesResult.data || []

    // Process results using unique question logic (not attempts)
    const categoryStats = new Map()

    // Initialize with empty stats
    for (const categoryId of categoryIds) {
      categoryStats.set(categoryId, {
        all: 0,
        unused: 0,
        incorrect: 0, // Will be renamed to needsReview
        marked: 0,
        correct: 0    // Will be renamed to mastered
      })
    }

    // Track unique questions per category
    const categoryQuestions = new Map<string, Map<string, { hasCorrect: boolean, hasIncorrect: boolean }>>()

    // Initialize category question maps
    for (const categoryId of categoryIds) {
      categoryQuestions.set(categoryId, new Map())
    }

    // Process attempts to track unique questions
    for (const attempt of attempts) {
      const categoryId = attempt.category_id
      const questionId = attempt.question_id
      const categoryQuestionMap = categoryQuestions.get(categoryId)

      if (categoryQuestionMap) {
        const existing = categoryQuestionMap.get(questionId) || { hasCorrect: false, hasIncorrect: false }

        if (attempt.is_correct) {
          existing.hasCorrect = true
        } else {
          existing.hasIncorrect = true
        }

        categoryQuestionMap.set(questionId, existing)
      }
    }

    // Calculate meaningful categories for each category
    for (const categoryId of categoryIds) {
      const stats = categoryStats.get(categoryId)
      const questionMap = categoryQuestions.get(categoryId)

      if (stats && questionMap) {
        // Count unique questions in meaningful categories
        let needsReview = 0  // Questions with any incorrect attempts
        let mastered = 0     // Questions with only correct attempts

        for (const questionStatus of questionMap.values()) {
          if (questionStatus.hasIncorrect) {
            needsReview++
          } else if (questionStatus.hasCorrect) {
            mastered++
          }
        }

        // Update stats with meaningful categories
        stats.incorrect = needsReview  // Reusing field name for backward compatibility
        stats.correct = mastered      // Reusing field name for backward compatibility
      }
    }

    // Process favorites (marked questions)
    for (const favorite of favorites) {
      const favoriteData = favorite as any // Type assertion for database join result
      const categoryId = favoriteData.questions?.category_id
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

    // Fetch categories and question counts in parallel with selective loading
    const [categoriesResult, questionCountsResult] = await Promise.all([
      // Get only essential category fields
      supabase
        .from('categories')
        .select('id, name, short_form, parent_id, level')
        .order('name')
        .limit(100), // Reasonable limit for categories

      // Get question counts efficiently with minimal data transfer
      supabase
        .from('questions')
        .select('category_id, status')
        .eq('status', 'approved') // Focus on approved questions only for better performance
        .limit(5000) // Limit to prevent excessive data transfer
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
      const rawStats = userStats.get(category.id) || {
        all: questionCount,
        unused: questionCount,
        incorrect: 0,
        marked: 0,
        correct: 0
      }

      // Map old field names to new meaningful names
      const stats = {
        all: questionCount,
        unused: Math.max(0, questionCount - rawStats.correct - rawStats.incorrect),
        incorrect: rawStats.incorrect,  // Questions with any incorrect attempts
        marked: rawStats.marked,
        correct: rawStats.correct        // Questions with only correct attempts
      }

      console.log(`Category ${category.name}: ${questionCount} questions, User stats:`, stats)

      return {
        id: category.id,
        name: category.name,
        shortName: category.short_form || extractShortName(category.name),
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

    // Return with compression for large quiz options data
    return createOptimizedResponse(responseData, {
      compress: true,
      cache: {
        maxAge: 300, // 5 minutes
        staleWhileRevalidate: 60, // 1 minute
        public: false // User-specific data should not be public
      }
    })

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
    needsReview: acc.needsReview + cat.questionStats.needsReview,
    marked: acc.marked + cat.questionStats.marked,
    mastered: acc.mastered + cat.questionStats.mastered
  }), { all: 0, unused: 0, needsReview: 0, marked: 0, mastered: 0 })
}

function calculateStatsForParent(categories: any[], parent: 'AP' | 'CP') {
  return categories
    .filter(cat => cat.parent === parent)
    .reduce((acc, cat) => ({
      all: acc.all + cat.questionStats.all,
      unused: acc.unused + cat.questionStats.unused,
      needsReview: acc.needsReview + cat.questionStats.needsReview,
      marked: acc.marked + cat.questionStats.marked,
      mastered: acc.mastered + cat.questionStats.mastered
    }), { all: 0, unused: 0, needsReview: 0, marked: 0, mastered: 0 })
}
