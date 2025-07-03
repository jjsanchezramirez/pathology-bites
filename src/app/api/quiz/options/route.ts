// src/app/api/quiz/options/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get categories with question counts
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        description,
        parent_id,
        level,
        color
      `)
      .order('name')

    if (categoriesError) {
      throw categoriesError
    }

    // Get question sets with question counts
    const { data: questionSets, error: questionSetsError } = await supabase
      .from('sets')
      .select(`
        id,
        name,
        description,
        source_type,
        is_active
      `)
      .eq('is_active', true)
      .order('name')

    if (questionSetsError) {
      throw questionSetsError
    }

    // Get tags
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select(`
        id,
        name
      `)
      .order('name')

    if (tagsError) {
      throw tagsError
    }

    // Get question counts for categories
    const categoriesWithCounts = await Promise.all(
      (categories || []).map(async (category) => {
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', category.id)
          .eq('status', 'published')

        return {
          ...category,
          questionCount: count || 0
        }
      })
    )

    // Get question counts for question sets
    const questionSetsWithCounts = await Promise.all(
      (questionSets || []).map(async (questionSet) => {
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('question_set_id', questionSet.id)
          .eq('status', 'published')

        return {
          ...questionSet,
          questionCount: count || 0
        }
      })
    )

    // Get question counts for tags
    const tagsWithCounts = await Promise.all(
      (tags || []).map(async (tag) => {
        const { count } = await supabase
          .from('question_tags')
          .select('*', { count: 'exact', head: true })
          .eq('tag_id', tag.id)

        return {
          ...tag,
          questionCount: count || 0
        }
      })
    )

    // Get total question count
    const { count: totalQuestions } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')

    // Get difficulty breakdown
    const { data: difficultyBreakdown, error: difficultyError } = await supabase
      .from('questions')
      .select('difficulty')
      .eq('status', 'published')

    if (difficultyError) {
      throw difficultyError
    }

    const difficultyCounts = (difficultyBreakdown || []).reduce((acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      success: true,
      data: {
        categories: categoriesWithCounts,
        questionSets: questionSetsWithCounts,
        tags: tagsWithCounts,
        totalQuestions: totalQuestions || 0,
        difficultyCounts: {
          easy: difficultyCounts.easy || 0,
          medium: difficultyCounts.medium || 0,
          hard: difficultyCounts.hard || 0
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
