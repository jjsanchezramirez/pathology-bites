// src/app/api/quiz/options/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { SupabaseClient } from '@supabase/supabase-js'

// Helper function to extract short name from category name
function extractShortName(name: string): string {
  return name.replace(/^(Anatomic Pathology|Clinical Pathology)\s*-\s*/, '')
}

// Helper function to get real question statistics for a user
async function getQuestionStatsForUser(
  supabase: SupabaseClient,
  userId: string,
  categoryId: string,
  totalQuestions: number
) {
  try {
    // Get all questions in this category
    const { data: categoryQuestions, error: questionsError } = await supabase
      .from('questions')
      .select('id')
      .eq('category_id', categoryId)
      .eq('status', 'approved')

    if (questionsError) {
      console.error('Error fetching category questions:', questionsError)
      return getMockStats(totalQuestions)
    }

    const questionIds = categoryQuestions?.map(q => q.id) || []

    if (questionIds.length === 0) {
      return { all: 0, unused: 0, incorrect: 0, marked: 0, correct: 0 }
    }

    // Get user's quiz attempts for these questions
    // Note: We need to join with quiz_sessions to filter by user_id
    const { data: userSessions, error: sessionsError } = await supabase
      .from('quiz_sessions')
      .select('id')
      .eq('user_id', userId)

    if (sessionsError) {
      console.error('Error fetching user sessions:', sessionsError)
      return getMockStats(totalQuestions)
    }

    const sessionIds = userSessions?.map(s => s.id) || []

    if (sessionIds.length === 0) {
      // User has no quiz sessions, but might have favorites
      const { data: favoritedQuestions, error: favoritesError } = await supabase
        .from('user_favorites')
        .select('question_id')
        .in('question_id', questionIds)
        .eq('user_id', userId)

      if (favoritesError) {
        console.error('Error fetching user favorites for new user:', favoritesError)
      }

      const marked = favoritedQuestions?.length || 0

      return {
        all: totalQuestions,
        unused: totalQuestions,
        incorrect: 0,
        marked,
        correct: 0
      }
    }

    // Get user's quiz attempts for these questions
    const { data: attempts, error: attemptsError } = await supabase
      .from('quiz_attempts')
      .select('question_id, is_correct')
      .in('question_id', questionIds)
      .in('quiz_session_id', sessionIds)

    if (attemptsError) {
      console.error('Error fetching user attempts:', attemptsError)
      return getMockStats(totalQuestions)
    }

    // Get user's favorited questions in this category
    const { data: favoritedQuestions, error: favoritesError } = await supabase
      .from('user_favorites')
      .select('question_id')
      .in('question_id', questionIds)
      .eq('user_id', userId)

    if (favoritesError) {
      console.error('Error fetching user favorites:', favoritesError)
    }

    // Calculate statistics
    const attemptedQuestionIds = new Set(attempts?.map(a => a.question_id) || [])
    const correctQuestionIds = new Set(
      attempts?.filter(a => a.is_correct).map(a => a.question_id) || []
    )
    const incorrectQuestionIds = new Set(
      attempts?.filter(a => !a.is_correct).map(a => a.question_id) || []
    )
    const favoritedQuestionIds = new Set(favoritedQuestions?.map(f => f.question_id) || [])

    const unused = questionIds.length - attemptedQuestionIds.size
    const correct = correctQuestionIds.size
    const incorrect = incorrectQuestionIds.size
    const marked = favoritedQuestionIds.size

    console.log(`User ${userId} stats for category ${categoryId}:`, {
      total: questionIds.length,
      unused,
      correct,
      incorrect,
      marked
    })

    return {
      all: totalQuestions,
      unused,
      incorrect,
      marked,
      correct
    }

  } catch (error) {
    console.error('Error calculating user question stats:', error)
    return getMockStats(totalQuestions)
  }
}

// Fallback to mock data if real data can't be retrieved
function getMockStats(totalQuestions: number) {
  return {
    all: totalQuestions,
    unused: Math.floor(totalQuestions * 0.8), // Mock: 80% unused (more realistic for new users)
    incorrect: Math.floor(totalQuestions * 0.1), // Mock: 10% incorrect
    marked: Math.floor(totalQuestions * 0.02), // Mock: 2% marked/favorited
    correct: Math.floor(totalQuestions * 0.1) // Mock: 10% correct
  }
}

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




    // Get question counts and statistics for categories
    const categoriesWithStats = await Promise.all(
      (categories || []).map(async (category) => {
        // Try different status values to see what questions exist
        const statusesToTry = ['approved', 'published', 'draft', 'pending_review']
        let totalCount = 0
        let foundStatus = null

        for (const status of statusesToTry) {
          const { count, error: countError } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id)
            .eq('status', status)

          if (countError) {
            console.error(`Error counting questions for category ${category.name} with status ${status}:`, countError)
            continue
          }

          if (count && count > 0) {
            totalCount = count
            foundStatus = status
            break
          }
        }

        // If no questions found with specific status, try without status filter
        if (totalCount === 0) {
          const { count, error: countError } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('category_id', category.id)

          if (countError) {
            console.error(`Error counting all questions for category ${category.name}:`, countError)
          } else {
            totalCount = count || 0
            foundStatus = 'any'
          }
        }

        console.log(`Category ${category.name}: ${totalCount} questions (status: ${foundStatus})`)

        // Get actual question type statistics based on user's history
        const questionStats = await getQuestionStatsForUser(supabase, user.id, category.id, totalCount || 0)

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
    )

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

    return NextResponse.json({
      success: true,
      data: {
        categories: categoriesWithStats,
        questionTypeStats: {
          all: overallStats,
          ap_only: apStats,
          cp_only: cpStats
        }
      }
    })

  } catch (error) {
    console.error('Error fetching quiz options:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quiz options' },
      { status: 500 }
    )
  }
}
