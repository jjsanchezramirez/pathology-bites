import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory cache for Semantic Scholar references
const referencesCache = new Map<string, { references: string[], timestamp: number }>()
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL_MS = 1100 // 1.1 seconds to respect 1 req/sec limit

/**
 * Sleep function for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * High-impact pathology and medical journals
 */
const PATHOLOGY_JOURNALS = [
  // Top-tier pathology journals
  'American Journal of Surgical Pathology',
  'Modern Pathology',
  'Journal of Pathology',
  'Histopathology',
  'Archives of Pathology & Laboratory Medicine',
  'Human Pathology',
  'American Journal of Clinical Pathology',
  'Diagnostic Pathology',
  'Virchows Archiv',
  'Journal of Clinical Pathology',
  'Pathology',
  'Pathology International',
  'Applied Immunohistochemistry & Molecular Morphology',

  // High-impact medical journals that publish pathology content
  'New England Journal of Medicine',
  'The Lancet',
  'JAMA',
  'Nature Medicine',
  'Nature Reviews Disease Primers',
  'Cell',
  'Science',
  'Nature',
  'BMJ',
  'Annals of Internal Medicine',
  'PLOS Medicine',
  'Journal of the American College of Cardiology',
  'Blood',
  'Clinical Cancer Research',
  'Cancer Research'
]

/**
 * Check if venue/journal is pathology-related
 */
function isPathologyJournal(venueName: string): boolean {
  const lowerVenue = venueName.toLowerCase()
  return PATHOLOGY_JOURNALS.some(journal =>
    lowerVenue.includes(journal.toLowerCase())
  ) || lowerVenue.includes('pathology') || lowerVenue.includes('histology')
}

/**
 * Format references from papers, prioritizing pathology journals
 */
function formatReferences(papers: any[]): string[] {
  // Sort papers: pathology journals first, then by citation count
  const sortedPapers = papers.sort((a, b) => {
    const aVenue = a.journal?.name || a.venue || ''
    const bVenue = b.journal?.name || b.venue || ''
    const aIsPathology = isPathologyJournal(aVenue)
    const bIsPathology = isPathologyJournal(bVenue)

    // Prioritize pathology journals
    if (aIsPathology && !bIsPathology) return -1
    if (!aIsPathology && bIsPathology) return 1

    // Then sort by citation count
    const aCitations = a.citationCount || 0
    const bCitations = b.citationCount || 0
    return bCitations - aCitations
  })

  return sortedPapers.slice(0, 3).map((paper: any) => {
    const authors = paper.authors?.slice(0, 2).map((a: any) => a.name).join(', ') || 'Unknown'
    const year = paper.year || 'Unknown'
    const title = paper.title || 'Unknown'
    const venue = paper.journal?.name || paper.venue || 'Unknown'

    return `${authors} (${year}). ${title}. ${venue}.`
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { searchTerms } = body

    if (!searchTerms || !searchTerms.trim()) {
      return NextResponse.json(
        { error: 'Search terms are required' },
        { status: 400 }
      )
    }

    // Use the provided search terms directly (they come from category + lesson + title)
    // Don't add extra "pathology" - it's already implied by our filters
    const searchQuery = searchTerms.trim()
    const cacheKey = searchQuery.toLowerCase().trim()

    // Check cache first
    const cached = referencesCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
      console.log(`[Fetch References] Using cached references for: "${searchQuery}"`)
      return NextResponse.json({
        success: true,
        references: cached.references,
        cached: true
      })
    }

    console.log(`[Fetch References] Fetching from Semantic Scholar for: "${searchQuery}"`)

    // Rate limiting: ensure at least 1.1 seconds between requests
    const timeSinceLastRequest = Date.now() - lastRequestTime
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
      const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest
      console.log(`[Fetch References] Rate limiting: waiting ${waitTime}ms`)
      await sleep(waitTime)
    }

    const semanticScholarUrl = new URL('https://api.semanticscholar.org/graph/v1/paper/search')
    semanticScholarUrl.searchParams.append('query', searchQuery)
    semanticScholarUrl.searchParams.append('limit', '10') // Get more results to filter for pathology journals
    semanticScholarUrl.searchParams.append('fields', 'title,authors,year,venue,journal,publicationDate,citationCount')

    // Filter by publication year (last 15 years) and minimum citations for quality
    semanticScholarUrl.searchParams.append('year', '2010-') // Papers from 2010 onwards
    semanticScholarUrl.searchParams.append('minCitationCount', '5') // At least 5 citations for quality

    // Fields of study filter - focus on Medicine and Biology
    semanticScholarUrl.searchParams.append('fieldsOfStudy', 'Medicine,Biology')

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    // Optional: Add API key if available
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY
    }

    // Update last request time
    lastRequestTime = Date.now()

    const response = await fetch(semanticScholarUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      console.warn(`[Fetch References] Semantic Scholar API error: ${response.status}`)

      // If rate limited, try one retry after waiting
      if (response.status === 429) {
        console.log('[Fetch References] Rate limited, waiting 2 seconds before retry...')
        await sleep(2000)
        lastRequestTime = Date.now()

        const retryResponse = await fetch(semanticScholarUrl.toString(), {
          headers,
          signal: AbortSignal.timeout(10000)
        })

        if (!retryResponse.ok) {
          console.warn(`[Fetch References] Retry also failed: ${retryResponse.status}`)
          return NextResponse.json(
            {
              success: false,
              error: 'Rate limited. Please wait a moment and try again.',
              references: []
            },
            { status: 429 }
          )
        }

        const retryData = await retryResponse.json()
        const retryPapers = retryData.data || []
        const references = formatReferences(retryPapers)

        // Cache the results
        if (references.length > 0) {
          referencesCache.set(cacheKey, {
            references,
            timestamp: Date.now()
          })
        }

        return NextResponse.json({
          success: true,
          references,
          cached: false
        })
      }

      return NextResponse.json(
        {
          success: false,
          error: `Failed to fetch references: ${response.statusText}`,
          references: []
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const papers = data.data || []
    const references = formatReferences(papers)

    // Cache the results
    if (references.length > 0) {
      referencesCache.set(cacheKey, {
        references,
        timestamp: Date.now()
      })
      console.log(`[Fetch References] Successfully fetched and cached ${references.length} references`)
    } else {
      console.log('[Fetch References] No references found')
    }

    return NextResponse.json({
      success: true,
      references,
      cached: false
    })

  } catch (error) {
    console.error('[Fetch References] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch references',
        references: []
      },
      { status: 500 }
    )
  }
}
