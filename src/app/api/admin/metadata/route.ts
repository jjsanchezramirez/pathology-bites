// src/app/api/admin/metadata/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

// Cache for metadata to reduce database load
let metadataCache: any = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth is handled by middleware

    // Check if we have fresh cached data
    if (metadataCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
      return NextResponse.json(metadataCache)
    }

    // Get all metadata in parallel to minimize latency
    const [
      categoriesResult,
      tagsResult,
      questionSetsResult,
      systemConfigResult
    ] = await Promise.all([
      // Categories with question counts (optimized single query)
      supabase.rpc('get_categories_with_counts'),

      // Tags with question counts (optimized single query)  
      supabase.rpc('get_tags_with_counts'),

      // Question sets with counts
      supabase.rpc('get_question_sets_with_counts'),

      // System configuration
      Promise.resolve({
        user_roles: ['admin', 'creator', 'reviewer', 'user'],
        question_types: ['multiple_choice', 'true_false', 'short_answer', 'essay'],
        difficulty_levels: ['beginner', 'intermediate', 'advanced', 'expert'],
        source_types: ['textbook', 'journal', 'case_study', 'lecture', 'other']
      })
    ])

    // Fallback to individual queries if RPC functions don't exist
    let categories = categoriesResult.data
    let tags = tagsResult.data  
    let questionSets = questionSetsResult.data

    if (categoriesResult.error) {
      // Fallback to optimized individual query
      const { data: cats } = await supabase
        .from('categories')
        .select('id, name, description, level, color, parent_id')
        .order('level, name')
        .limit(100)
      
      if (cats && cats.length > 0) {
        const categoryIds = cats.map(c => c.id)
        const { data: questionCounts } = await supabase
          .from('questions')
          .select('category_id')
          .in('category_id', categoryIds)

        const countMap = new Map<string, number>()
        questionCounts?.forEach(q => {
          if (q.category_id) {
            countMap.set(q.category_id, (countMap.get(q.category_id) || 0) + 1)
          }
        })

        categories = cats.map(cat => ({
          ...cat,
          question_count: countMap.get(cat.id) || 0
        }))
      } else {
        categories = []
      }
    }

    if (tagsResult.error) {
      // Fallback to optimized individual query
      const { data: tagData } = await supabase
        .from('tags')
        .select('id, name, description, color')
        .order('name')
        .limit(100)
      
      if (tagData && tagData.length > 0) {
        const tagIds = tagData.map(t => t.id)
        const { data: tagCounts } = await supabase
          .from('question_tags')
          .select('tag_id')
          .in('tag_id', tagIds)

        const countMap = new Map<string, number>()
        tagCounts?.forEach(qt => {
          if (qt.tag_id) {
            countMap.set(qt.tag_id, (countMap.get(qt.tag_id) || 0) + 1)
          }
        })

        tags = tagData.map(tag => ({
          ...tag,
          question_count: countMap.get(tag.id) || 0
        }))
      } else {
        tags = []
      }
    }

    if (questionSetsResult.error) {
      // Fallback to optimized individual query
      const { data: setData } = await supabase
        .from('sets')
        .select('id, name, description, source_type, is_active')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (setData && setData.length > 0) {
        const setIds = setData.map(s => s.id)
        const { data: setCounts } = await supabase
          .from('questions')
          .select('question_set_id')
          .in('question_set_id', setIds)

        const countMap = new Map<string, number>()
        setCounts?.forEach(q => {
          if (q.question_set_id) {
            countMap.set(q.question_set_id, (countMap.get(q.question_set_id) || 0) + 1)
          }
        })

        questionSets = setData.map(set => ({
          ...set,
          question_count: countMap.get(set.id) || 0
        }))
      } else {
        questionSets = []
      }
    }

    const metadata = {
      categories: categories || [],
      tags: tags || [],
      questionSets: questionSets || [],
      systemConfig: systemConfigResult,
      lastUpdated: new Date().toISOString(),
      // Add summary stats
      stats: {
        totalCategories: categories?.length || 0,
        totalTags: tags?.length || 0,
        totalQuestionSets: questionSets?.length || 0
      }
    }

    // Cache the response
    metadataCache = metadata
    cacheTimestamp = Date.now()

    return NextResponse.json(metadata)

  } catch (error) {
    console.error('Error in admin metadata API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Add a cache invalidation endpoint for when metadata changes
export async function DELETE(request: NextRequest) {
  try {
    // Auth is handled by middleware
    
    // Clear the cache
    metadataCache = null
    cacheTimestamp = 0
    
    return NextResponse.json({ message: 'Metadata cache cleared' })
  } catch (error) {
    console.error('Error clearing metadata cache:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}