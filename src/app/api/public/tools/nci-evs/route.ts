import { NextRequest, NextResponse } from 'next/server'

/**
 * NCI EVS (Enterprise Vocabulary Services) API Proxy
 *
 * Proxies requests to the NCI Thesaurus API to avoid CORS issues
 * and provide a consistent interface for the frontend.
 *
 * Features:
 * - Semantic type filtering for pathology-relevant terms
 * - Relevance scoring and ranking
 * - Smart filtering to reduce result noise
 *
 * API Documentation: https://api-evsrest.nci.nih.gov/
 */

const NCI_EVS_BASE_URL = 'https://api-evsrest.nci.nih.gov/api/v1'

// Pathology-relevant semantic types with priority scores
const PATHOLOGY_SEMANTIC_TYPES: { [key: string]: number } = {
  'Neoplastic Process': 500,
  'Disease or Syndrome': 400,
  'Pathologic Function': 350,
  'Finding': 300,
  'Anatomical Abnormality': 250,
  'Congenital Abnormality': 240,
  'Acquired Abnormality': 230,
  'Cell or Molecular Dysfunction': 220,
}

// Semantic types to exclude (not relevant for pathology)
const EXCLUDED_SEMANTIC_TYPES = [
  'Gene or Genome',
  'Amino Acid, Peptide, or Protein',
  'Clinical Drug',
  'Pharmacologic Substance',
  'Therapeutic or Preventive Procedure',
  'Laboratory Procedure',
  'Diagnostic Procedure',
  'Medical Device',
  'Research Device',
  'Biomedical or Dental Material',
  'Indicator, Reagent, or Diagnostic Aid',
]

interface NCIConcept {
  code: string
  name: string
  terminology: string
  version: string
  synonyms?: Array<{ name: string; type: string; source?: string }>
  definitions?: Array<{ definition: string; source?: string }>
  properties?: Array<{ type: string; value: string }>
}

interface ScoredConcept extends NCIConcept {
  relevanceScore: number
  semanticTypes: string[]
  matchReason?: string
}

/**
 * Extract semantic types from concept properties
 */
function getSemanticTypes(concept: NCIConcept): string[] {
  if (!concept.properties) return []

  return concept.properties
    .filter(prop => prop.type === 'Semantic_Type')
    .map(prop => prop.value)
}

/**
 * Calculate relevance score for a concept based on search term and semantic types
 */
function calculateRelevanceScore(concept: NCIConcept, searchTerm: string): { score: number; reason?: string } {
  let score = 0
  let matchReason: string | undefined

  const semanticTypes = getSemanticTypes(concept)
  const searchTermLower = searchTerm.toLowerCase()
  const conceptNameLower = concept.name.toLowerCase()

  // Check for exact abbreviation match in synonyms (highest priority)
  if (concept.synonyms) {
    const exactMatch = concept.synonyms.find(
      syn => syn.name.toLowerCase() === searchTermLower
    )
    if (exactMatch) {
      score += 1000
      matchReason = `Exact synonym match: "${exactMatch.name}"`
    }
  }

  // Check for exact name match
  if (conceptNameLower === searchTermLower) {
    score += 800
    matchReason = matchReason || 'Exact name match'
  }

  // Check for name starts with search term
  if (conceptNameLower.startsWith(searchTermLower)) {
    score += 600
    matchReason = matchReason || 'Name starts with search term'
  }

  // Semantic type priority
  for (const semType of semanticTypes) {
    if (PATHOLOGY_SEMANTIC_TYPES[semType]) {
      score += PATHOLOGY_SEMANTIC_TYPES[semType]
      matchReason = matchReason || `Pathology term: ${semType}`
    }
  }

  // Has definition (indicates well-documented term)
  if (concept.definitions && concept.definitions.length > 0) {
    score += 100
  }

  // Synonym count (more synonyms = more established term)
  if (concept.synonyms) {
    score += Math.min(concept.synonyms.length * 10, 100)
  }

  return { score, reason: matchReason }
}

/**
 * Filter concepts to only pathology-relevant terms
 */
function filterPathologyTerms(concepts: NCIConcept[], filterType: string = 'pathology'): NCIConcept[] {
  return concepts.filter(concept => {
    const semanticTypes = getSemanticTypes(concept)

    // Exclude non-pathology types
    const hasExcludedType = semanticTypes.some(type => EXCLUDED_SEMANTIC_TYPES.includes(type))
    if (hasExcludedType) return false

    // Apply filter type
    if (filterType === 'neoplasms') {
      return semanticTypes.includes('Neoplastic Process')
    } else if (filterType === 'diseases') {
      return semanticTypes.includes('Disease or Syndrome') || semanticTypes.includes('Neoplastic Process')
    } else if (filterType === 'pathology') {
      // Include any pathology-relevant semantic type
      return semanticTypes.some(type => PATHOLOGY_SEMANTIC_TYPES[type] !== undefined)
    }

    return true // 'all' filter type
  })
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const term = searchParams.get('term')
    const filterType = searchParams.get('filterType') || 'pathology'
    const maxResults = parseInt(searchParams.get('maxResults') || '10')
    const include = searchParams.get('include') || 'synonyms,definitions,properties'

    if (!term) {
      return NextResponse.json(
        { error: 'Search term is required' },
        { status: 400 }
      )
    }

    console.log(`[NCI EVS] Searching for: "${term}" (filter: ${filterType})`)
    const startTime = Date.now()

    // Fetch more results initially (50) so we can filter and rank
    const nciUrl = new URL(`${NCI_EVS_BASE_URL}/concept/ncit/search`)
    nciUrl.searchParams.set('term', term)
    nciUrl.searchParams.set('include', include)
    nciUrl.searchParams.set('pageSize', '50') // Fetch 50, filter to top 10

    // Fetch from NCI EVS API
    const response = await fetch(nciUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[NCI EVS] API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        {
          error: `NCI EVS API error: ${response.status} ${response.statusText}`,
          status: response.status
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const rawConcepts: NCIConcept[] = data.concepts || []

    // Filter to pathology-relevant terms
    const filteredConcepts = filterPathologyTerms(rawConcepts, filterType)

    // Score and rank results
    const scoredConcepts: ScoredConcept[] = filteredConcepts.map(concept => {
      const { score, reason } = calculateRelevanceScore(concept, term)
      return {
        ...concept,
        relevanceScore: score,
        semanticTypes: getSemanticTypes(concept),
        matchReason: reason
      }
    })

    // Sort by relevance score (highest first)
    scoredConcepts.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Take top N results
    const topResults = scoredConcepts.slice(0, maxResults)

    const searchTime = Date.now() - startTime

    console.log(`[NCI EVS] Found ${data.total || 0} total, ${filteredConcepts.length} after filtering, returning top ${topResults.length} in ${searchTime}ms`)

    // Return results with metadata
    return NextResponse.json({
      success: true,
      concepts: topResults,
      total: data.total || 0,
      filtered_total: filteredConcepts.length,
      returned_count: topResults.length,
      metadata: {
        search_term: term,
        search_time_ms: searchTime,
        filter_type: filterType,
        max_results: maxResults,
        api_version: 'v1',
        terminology: 'ncit',
        filtering_enabled: true
      }
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400', // Cache for 1 hour
      }
    })

  } catch (error) {
    console.error('[NCI EVS] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}

// Support POST requests as well
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      term,
      filterType = 'pathology',
      maxResults = 10,
      include = 'synonyms,definitions,properties'
    } = body

    if (!term) {
      return NextResponse.json(
        { error: 'Search term is required' },
        { status: 400 }
      )
    }

    console.log(`[NCI EVS] POST search for: "${term}" (filter: ${filterType})`)
    const startTime = Date.now()

    // Fetch more results initially (50) so we can filter and rank
    const nciUrl = new URL(`${NCI_EVS_BASE_URL}/concept/ncit/search`)
    nciUrl.searchParams.set('term', term)
    nciUrl.searchParams.set('include', include)
    nciUrl.searchParams.set('pageSize', '50') // Fetch 50, filter to top N

    // Fetch from NCI EVS API
    const response = await fetch(nciUrl.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[NCI EVS] API error: ${response.status} ${response.statusText}`)
      return NextResponse.json(
        {
          error: `NCI EVS API error: ${response.status} ${response.statusText}`,
          status: response.status
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const rawConcepts: NCIConcept[] = data.concepts || []

    // Filter to pathology-relevant terms
    const filteredConcepts = filterPathologyTerms(rawConcepts, filterType)

    // Score and rank results
    const scoredConcepts: ScoredConcept[] = filteredConcepts.map(concept => {
      const { score, reason } = calculateRelevanceScore(concept, term)
      return {
        ...concept,
        relevanceScore: score,
        semanticTypes: getSemanticTypes(concept),
        matchReason: reason
      }
    })

    // Sort by relevance score (highest first)
    scoredConcepts.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Take top N results
    const topResults = scoredConcepts.slice(0, maxResults)

    const searchTime = Date.now() - startTime

    console.log(`[NCI EVS] Found ${data.total || 0} total, ${filteredConcepts.length} after filtering, returning top ${topResults.length} in ${searchTime}ms`)

    // Return results with metadata
    return NextResponse.json({
      success: true,
      concepts: topResults,
      total: data.total || 0,
      filtered_total: filteredConcepts.length,
      returned_count: topResults.length,
      metadata: {
        search_term: term,
        search_time_ms: searchTime,
        filter_type: filterType,
        max_results: maxResults,
        api_version: 'v1',
        terminology: 'ncit',
        filtering_enabled: true
      }
    })

  } catch (error) {
    console.error('[NCI EVS] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}

