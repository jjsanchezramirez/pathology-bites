/**
 * Unified Client-Side Context Search
 * 
 * This module bridges the pure-client-context-search with the unified medical search algorithm,
 * maintaining the same interface while providing enhanced medical intelligence.
 */

import { dataManager, type EducationalContent } from './client-data-manager'
import { 
  extractMedicalTerms, 
  calculateUnifiedMatchScore, 
  assessSearchQuality, 
  shouldRejectResult,
  SEARCH_PRESETS,
  type MedicalSearchOptions
} from './unified-medical-search'

interface ContextSearchResult {
  success: boolean
  context?: EducationalContent
  shouldReject: boolean
  metadata: {
    searched_at: string
    search_time_ms: number
    diagnosis: string
    category?: string
    subcategory?: string
    context_found: boolean
    context_quality: string
    files_searched: number
    client_side: true
    cache_hits: number
    network_requests: number
    search_algorithm?: string
    medical_terms_count?: number
    unified_scoring?: boolean
  }
}

interface EnhancedSearchResult {
  content: EducationalContent
  score: number
  filename: string
  lesson: string
  topic: string
  medicalTerms: any
  matchDetails: any
}

/**
 * Enhanced pure client-side context search using unified medical algorithm
 */
export async function findContextUnifiedClient(
  diagnosis: string,
  category?: string,
  subcategory?: string,
  searchMode: 'wsiQuestions' | 'diagnosticSearch' | 'general' = 'wsiQuestions'
): Promise<ContextSearchResult> {
  const startTime = Date.now()
  let cacheHits = 0
  let networkRequests = 0
  
  try {
    console.log(`[Unified Client Context] 🚀 Starting enhanced search for: ${diagnosis}`)
    console.log(`[Unified Client Context] Mode: ${searchMode}, Category: ${category || 'Not specified'}`)

    // Extract medical terms using unified algorithm
    const medicalTerms = extractMedicalTerms(diagnosis)
    console.log(`[Unified Client Context] Extracted medical terms:`, {
      exactPhrases: medicalTerms.exactPhrases.length,
      medicalTerms: medicalTerms.medicalTerms.length,
      keyWords: medicalTerms.keyWords.length,
      synonyms: medicalTerms.synonyms.length,
      organSystem: medicalTerms.organSystem
    })

    // Get search options based on mode
    const searchOptions = SEARCH_PRESETS[searchMode]
    console.log(`[Unified Client Context] Using ${searchMode} search preset`)

    // Get targeted files (smart selection)
    const targetFiles = dataManager.getTargetedFiles(category || '', subcategory || '', diagnosis)
    console.log(`[Unified Client Context] Will search ${targetFiles.length} targeted files`)

    let bestMatch: EnhancedSearchResult | null = null
    let filesSearched = 0

    // Search through targeted files
    for (const filename of targetFiles) {
      try {
        console.log(`[Unified Client Context] Loading ${filename}...`)
        
        // Check if already cached
        const wasCached = dataManager.getCacheStatus().contentFiles.files.includes(filename.replace('.json', ''))
        
        const data = await dataManager.loadContentFile(filename)
        
        if (wasCached) {
          cacheHits++
          console.log(`[Unified Client Context] ✅ ${filename} loaded from cache`)
        } else {
          networkRequests++
          console.log(`[Unified Client Context] 📥 ${filename} downloaded from R2`)
        }
        
        if (!data || !data.subject || !data.subject.lessons) {
          console.warn(`[Unified Client Context] Invalid data structure in ${filename}`)
          continue
        }

        filesSearched++
        
        // Search through all content in this file
        for (const [lessonName, lessonData] of Object.entries(data.subject.lessons)) {
          if (lessonData && typeof lessonData === 'object' && 'topics' in lessonData) {
            const topics = (lessonData as any).topics
            
            for (const [topicName, topicData] of Object.entries(topics)) {
              if (topicData && typeof topicData === 'object' && 'content' in topicData) {
                const contentText = JSON.stringify((topicData as any).content)
                
                // Use unified medical search algorithm
                const { score, matchDetails } = calculateUnifiedMatchScore(
                  medicalTerms,
                  topicName,
                  lessonName,
                  contentText,
                  category,
                  subcategory,
                  searchOptions
                )

                if (score > 0) {
                  const content: EducationalContent = {
                    category: data.category,
                    subject: data.subject.name,
                    lesson: lessonName,
                    topic: topicName,
                    content: (topicData as any).content
                  }

                  if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { 
                      content, 
                      score, 
                      filename, 
                      lesson: lessonName, 
                      topic: topicName,
                      medicalTerms,
                      matchDetails
                    }
                    console.log(`[Unified Client Context] New best match: ${filename} - ${lessonName} - ${topicName} (score: ${score})`)
                    
                    // Early termination for excellent matches
                    if (searchOptions.enableEarlyTermination && score >= (searchOptions.earlyTerminationScore || 150000)) {
                      console.log(`[Unified Client Context] Excellent match found (score: ${score}) - terminating search early`)
                      break
                    }
                  }
                }
              }
            }
          }
          
          // Break out of lesson loop if we found excellent match and early termination is enabled
          if (searchOptions.enableEarlyTermination && bestMatch && bestMatch.score >= (searchOptions.earlyTerminationScore || 150000)) {
            break
          }
        }
        
      } catch (error) {
        console.warn(`[Unified Client Context] Error loading ${filename}:`, error)
        continue
      }
      
      // Break out of file loop if we found excellent match and early termination is enabled
      if (searchOptions.enableEarlyTermination && bestMatch && bestMatch.score >= (searchOptions.earlyTerminationScore || 150000)) {
        break
      }
    }

    const searchTime = Date.now() - startTime
    console.log(`[Unified Client Context] ✅ Enhanced search completed in ${searchTime}ms`)
    console.log(`[Unified Client Context] 📊 Cache efficiency: ${cacheHits} cache hits, ${networkRequests} network requests`)

    // Quality assessment using unified algorithm
    const quality = bestMatch ? assessSearchQuality(bestMatch.score, searchOptions) : 'none'
    const shouldReject = !bestMatch || shouldRejectResult(bestMatch.score, quality, searchOptions)
    
    console.log(`[Unified Client Context] Quality: ${quality}, Should reject: ${shouldReject}`)
    
    if (bestMatch) {
      console.log(`[Unified Client Context] Best match: ${bestMatch.topic} (${bestMatch.content.subject}) - Score: ${bestMatch.score}`)
      console.log(`[Unified Client Context] Match details:`, bestMatch.matchDetails)
    }

    return {
      success: true,
      context: bestMatch?.content || undefined,
      shouldReject,
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
        diagnosis,
        category,
        subcategory,
        context_found: !!bestMatch,
        context_quality: quality,
        files_searched: filesSearched,
        client_side: true,
        cache_hits: cacheHits,
        network_requests: networkRequests,
        search_algorithm: 'unified_medical_search_v2',
        medical_terms_count: Object.keys(medicalTerms).reduce((acc, key) => acc + (medicalTerms[key as keyof typeof medicalTerms] as any[]).length, 0),
        unified_scoring: true
      }
    }

  } catch (error) {
    const searchTime = Date.now() - startTime
    console.error('[Unified Client Context] Error during search:', error)
    
    return {
      success: false,
      shouldReject: true,
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
        diagnosis,
        category,
        subcategory,
        context_found: false,
        context_quality: 'error',
        files_searched: 0,
        client_side: true,
        cache_hits: cacheHits,
        network_requests: networkRequests,
        search_algorithm: 'unified_medical_search_v2',
        medical_terms_count: 0,
        unified_scoring: true
      }
    }
  }
}

/**
 * Backwards compatibility wrapper that maintains the same interface as pure-client-context-search
 * but provides enhanced medical search capabilities
 */
export async function findContextPureClientEnhanced(
  diagnosis: string,
  category?: string,
  subcategory?: string
): Promise<ContextSearchResult> {
  return await findContextUnifiedClient(diagnosis, category, subcategory, 'wsiQuestions')
}

/**
 * Performance comparison function - runs both old and new algorithms for testing
 */
export async function compareSearchAlgorithms(
  diagnosis: string,
  category?: string,
  subcategory?: string
): Promise<{
  unified: ContextSearchResult
  legacy: ContextSearchResult
  comparison: {
    scoreDifference: number
    timeDifference: number
    qualityImprovement: boolean
    algorithmPreference: 'unified' | 'legacy' | 'equivalent'
  }
}> {
  // Import legacy search function
  const { findContextPureClient: legacySearch } = await import('./pure-client-context-search')
  
  // Run both searches in parallel
  const [unifiedResult, legacyResult] = await Promise.all([
    findContextUnifiedClient(diagnosis, category, subcategory, 'wsiQuestions'),
    legacySearch(diagnosis, category, subcategory)
  ])
  
  // Calculate comparison metrics
  const scoreDifference = (unifiedResult.context ? 1 : 0) - (legacyResult.context ? 1 : 0)
  const timeDifference = unifiedResult.metadata.search_time_ms - legacyResult.metadata.search_time_ms
  const qualityImprovement = unifiedResult.metadata.context_quality !== legacyResult.metadata.context_quality
  
  let algorithmPreference: 'unified' | 'legacy' | 'equivalent'
  if (unifiedResult.context && !legacyResult.context) {
    algorithmPreference = 'unified'
  } else if (!unifiedResult.context && legacyResult.context) {
    algorithmPreference = 'legacy'
  } else if (unifiedResult.metadata.context_quality === 'excellent' && legacyResult.metadata.context_quality !== 'excellent') {
    algorithmPreference = 'unified'
  } else if (legacyResult.metadata.context_quality === 'excellent' && unifiedResult.metadata.context_quality !== 'excellent') {
    algorithmPreference = 'legacy'
  } else {
    algorithmPreference = 'equivalent'
  }
  
  console.log(`[Search Comparison] Unified: ${unifiedResult.metadata.context_quality}, Legacy: ${legacyResult.metadata.context_quality}, Preference: ${algorithmPreference}`)
  
  return {
    unified: unifiedResult,
    legacy: legacyResult,
    comparison: {
      scoreDifference,
      timeDifference,
      qualityImprovement,
      algorithmPreference
    }
  }
}