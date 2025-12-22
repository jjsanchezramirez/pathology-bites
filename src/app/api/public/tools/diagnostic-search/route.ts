/**
 * Diagnostic Search API - Simplified and Optimized
 *
 * Uses pre-built search index (~154KB) instead of loading all files (~40MB)
 * - Fast initial load (99.6% bandwidth reduction)
 * - Simple matching algorithm (exact → starts-with → contains)
 * - Disambiguation support for multiple matches
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'
import { simpleSearchV2 } from './simple-search-v2'
import { getTopicContent } from './simple-search-v2'
import { parseContentWithAI } from './ai-content-parser'
import { createClient } from '@/shared/services/server'

export const maxDuration = 30

/**
 * Search for relevant images in the library
 */
interface ImageSearchResult {
  id: string
  url: string
  description: string | null
  alt_text: string | null
  category: string
  relevanceScore: number
}

interface ImageData {
  id: string
  url: string
  description: string | null
  alt_text: string | null
  category: string
}

async function searchRelevantImages(entity: string): Promise<{ images: ImageSearchResult[], count: number, searchTime: number }> {
  const startTime = Date.now()

  try {
    const supabase = await createClient()

    // Search images in pathology-relevant categories
    const { data, error } = await supabase
      .from('images')
      .select('id, url, description, alt_text, category')
      .in('category', ['microscopic', 'gross'])
      .or(`description.ilike.%${entity}%,alt_text.ilike.%${entity}%`)
      .limit(20) // Fetch 20, score and return top 8

    if (error) {
      console.error('[Image Search] Error:', error)
      return { images: [], count: 0, searchTime: Date.now() - startTime }
    }

    if (!data || data.length === 0) {
      return { images: [], count: 0, searchTime: Date.now() - startTime }
    }

    // Score each image by relevance
    const scoredImages = (data as ImageData[]).map((img): ImageSearchResult => {
      let score = 0
      const entityLower = entity.toLowerCase()
      const descLower = (img.description || '').toLowerCase()
      const altLower = (img.alt_text || '').toLowerCase()

      // Exact match in description or alt text
      if (descLower === entityLower || altLower === entityLower) {
        score += 1000
      }
      // Starts with search term
      else if (descLower.startsWith(entityLower) || altLower.startsWith(entityLower)) {
        score += 600
      }
      // Contains search term
      else if (descLower.includes(entityLower) || altLower.includes(entityLower)) {
        score += 300
      }

      // Category bonus (microscopic images are typically more relevant)
      if (img.category === 'microscopic') {
        score += 100
      } else if (img.category === 'gross') {
        score += 50
      }

      // Has description bonus
      if (img.description && img.description.length > 10) {
        score += 50
      }

      return {
        ...img,
        relevanceScore: score
      }
    })

    // Sort by relevance score (highest first)
    scoredImages.sort((a: ImageSearchResult, b: ImageSearchResult) => b.relevanceScore - a.relevanceScore)

    // Return top 8 images
    const topImages = scoredImages.slice(0, 8)

    const searchTime = Date.now() - startTime
    console.log(`[Image Search] Found ${data.length} images, returning top ${topImages.length} in ${searchTime}ms`)

    return {
      images: topImages,
      count: data.length,
      searchTime
    }

  } catch (error) {
    console.error('[Image Search] Error:', error)
    return { images: [], count: 0, searchTime: Date.now() - startTime }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { entity, fileName, topicName, lessonName } = body

    if (!entity || typeof entity !== 'string' || entity.trim().length < 2) {
      return NextResponse.json(
        { error: 'Valid diagnostic entity is required (minimum 2 characters)' },
        { status: 400 }
      )
    }

    const cleanEntity = entity.trim()
    console.log(`[Diagnostic Search] Searching for: ${cleanEntity}`)

    // Search for relevant images in parallel with text search
    const imageSearchPromise = searchRelevantImages(cleanEntity)

    // If specific topic requested (after disambiguation), load that content directly
    if (fileName && topicName && lessonName) {
      try {
        const rawContent = await getTopicContent(fileName, topicName, lessonName)

        // Parse content with AI and wait for image search
        console.log(`[Diagnostic Search] Parsing content with AI for ${topicName}`)
        const [parsedContent, imageResults] = await Promise.all([
          parseContentWithAI(rawContent, cleanEntity),
          imageSearchPromise
        ])

        return createOptimizedResponse({
          success: true,
          type: 'single_match',
          entity: cleanEntity,
          match: {
            topic: topicName,
            lesson: lessonName,
            fileName: fileName,
          },
          results: parsedContent || { error: 'AI parsing failed', raw_content: rawContent },
          related_images: imageResults.images,
          metadata: {
            searched_at: new Date().toISOString(),
            search_time_ms: Date.now() - startTime,
            entity: cleanEntity,
            source: 'direct_load',
            ai_organized: !!parsedContent,
            ai_model: parsedContent?.ai_metadata?.model,
            ai_generation_time_ms: parsedContent?.ai_metadata?.generation_time_ms,
            token_usage: parsedContent?.ai_metadata?.token_usage,
            image_search: {
              found: imageResults.count,
              returned: imageResults.images.length,
              search_time_ms: imageResults.searchTime
            }
          }
        }, {
          compress: true,
          cache: {
            maxAge: 3600,
            staleWhileRevalidate: 600,
            public: false
          }
        })
      } catch (err) {
        console.error('[Diagnostic Search] Error:', err)
        return NextResponse.json(
          { error: 'Failed to load topic content' },
          { status: 500 }
        )
      }
    }

    // Perform search and wait for image results
    const [result, imageResults] = await Promise.all([
      simpleSearchV2(cleanEntity),
      imageSearchPromise
    ])

    // No matches found
    if (result.type === 'none') {
      return createOptimizedResponse({
        success: false,
        type: 'no_matches',
        message: 'No matches found',
        suggestions: [
          'Check spelling',
          'Try using an abbreviation (e.g., DLBCL, CLL, AML)',
          'Try a more general term',
        ],
        related_images: imageResults.images, // Still show images even if no text matches
        metadata: {
          searched_at: new Date().toISOString(),
          search_time_ms: result.searchTime,
          entity: cleanEntity,
          index_size: result.indexSize,
          image_search: {
            found: imageResults.count,
            returned: imageResults.images.length,
            search_time_ms: imageResults.searchTime
          }
        }
      }, {
        compress: true,
        cache: {
          maxAge: 300, // 5 minutes for failed searches
          staleWhileRevalidate: 60,
          public: false
        }
      })
    }

    // Multiple matches - disambiguation needed
    if (result.type === 'multiple') {
      return createOptimizedResponse({
        success: true,
        type: 'disambiguation_needed',
        message: `Found ${result.totalMatches} possible matches. Please select one:`,
        options: result.options,
        related_images: imageResults.images,
        metadata: {
          searched_at: new Date().toISOString(),
          search_time_ms: result.searchTime,
          entity: cleanEntity,
          total_matches: result.totalMatches,
          index_size: result.indexSize,
          image_search: {
            found: imageResults.count,
            returned: imageResults.images.length,
            search_time_ms: imageResults.searchTime
          }
        }
      }, {
        compress: true,
        cache: {
          maxAge: 3600,
          staleWhileRevalidate: 600,
          public: false
        }
      })
    }

    // Single match found - parse with AI
    console.log(`[Diagnostic Search] Parsing content with AI for ${result.entry!.topicName}`)
    const parsedContent = await parseContentWithAI(result.content, cleanEntity)

    return createOptimizedResponse({
      success: true,
      type: 'single_match',
      entity: cleanEntity,
      match: {
        topic: result.entry!.topicName,
        lesson: result.entry!.lessonName,
        category: result.entry!.category,
        subcategory: result.entry!.subcategory,
        fileName: result.entry!.fileName,
        match_type: result.matchType,
      },
      results: parsedContent || { error: 'AI parsing failed', raw_content: result.content },
      related_images: imageResults.images,
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: Date.now() - startTime,
        entity: cleanEntity,
        index_size: result.indexSize,
        match_type: result.matchType,
        ai_organized: !!parsedContent,
        ai_model: parsedContent?.ai_metadata?.model,
        ai_generation_time_ms: parsedContent?.ai_metadata?.generation_time_ms,
        token_usage: parsedContent?.ai_metadata?.token_usage,
        image_search: {
          found: imageResults.count,
          returned: imageResults.images.length,
          search_time_ms: imageResults.searchTime
        }
      }
    }, {
      compress: true,
      cache: {
        maxAge: 3600, // 1 hour for successful searches
        staleWhileRevalidate: 600,
        public: false
      }
    })

  } catch (error) {
    const searchTime = Date.now() - startTime
    console.error('[Diagnostic Search] Error:', error)

    return NextResponse.json({
      error: 'Failed to search diagnostic entity',
      details: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
      }
    }, { status: 500 })
  }
}
