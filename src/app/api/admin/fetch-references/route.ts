import { NextRequest, NextResponse } from 'next/server'
import { PATHOLOGY_JOURNALS } from '@/lib/constants/pathology-journals'

/**
 * Semantic Scholar API route for fetching academic references
 * Optimized for pathology research with advanced filtering options
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const searchTerms = body.searchTerms

    if (!searchTerms || typeof searchTerms !== 'string') {
      return NextResponse.json(
        { error: 'searchTerms is required in request body' },
        { status: 400 }
      )
    }

    // Build Semantic Scholar API URL
    const semanticScholarUrl = new URL('https://api.semanticscholar.org/graph/v1/paper/search')
    semanticScholarUrl.searchParams.append('query', searchTerms)
    semanticScholarUrl.searchParams.append('limit', '5') // Limit to 5 references for question creation
    semanticScholarUrl.searchParams.append(
      'fields',
      'paperId,title,authors,year,venue,journal,publicationDate,citationCount,isOpenAccess,openAccessPdf'
    )

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY
    }

    const response = await fetch(semanticScholarUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limited by Semantic Scholar. Please try again later.' },
          { status: 429 }
        )
      }
      throw new Error(`Semantic Scholar API error: ${response.status}`)
    }

    const data = await response.json()
    const papers = data.data || []

    // Format references as strings
    const references = papers.map((paper: any) => {
      const authors = paper.authors?.map((a: any) => a.name).slice(0, 3).join(', ') || 'Unknown'
      const moreAuthors = paper.authors?.length > 3 ? ' et al.' : ''
      const year = paper.year || 'n.d.'
      const title = paper.title || 'Untitled'
      const venue = paper.venue || paper.journal?.name || ''
      const venueText = venue ? ` ${venue}.` : ''
      const url = `https://www.semanticscholar.org/paper/${paper.paperId}`

      return `${authors}${moreAuthors}. (${year}). ${title}.${venueText} ${url}`
    })

    return NextResponse.json({
      success: true,
      references,
      cached: false
    })

  } catch (error) {
    console.error('Semantic Scholar API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch references from Semantic Scholar' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = searchParams.get('limit') || '20'
    const sortBy = searchParams.get('sortBy') || 'citations'
    const minCitations = parseInt(searchParams.get('minCitations') || '0')
    const onlyOpenAccess = searchParams.get('onlyOpenAccess') === 'true'
    const onlyReviews = searchParams.get('onlyReviews') === 'true'
    const yearRange = searchParams.get('yearRange') || 'all'
    const venue = searchParams.get('venue') || ''
    const publicationType = searchParams.get('publicationType') || ''

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    // Build Semantic Scholar API URL
    const semanticScholarUrl = new URL('https://api.semanticscholar.org/graph/v1/paper/search')
    semanticScholarUrl.searchParams.append('query', query)
    semanticScholarUrl.searchParams.append('limit', limit)
    semanticScholarUrl.searchParams.append(
      'fields',
      'paperId,title,authors,year,venue,journal,publicationDate,citationCount,influentialCitationCount,abstract,isOpenAccess,openAccessPdf,publicationTypes'
    )

    // Add year range filter if specified
    const currentYear = new Date().getFullYear()
    if (yearRange === 'last5') {
      const startYear = currentYear - 5
      semanticScholarUrl.searchParams.append('year', `${startYear}-`)
    } else if (yearRange === 'last10') {
      const startYear = currentYear - 10
      semanticScholarUrl.searchParams.append('year', `${startYear}-`)
    }

    // Add venue filter if specified (but not for 'pathology-journals' - we'll filter that client-side)
    if (venue && venue !== 'pathology-journals') {
      semanticScholarUrl.searchParams.append('venue', venue)
    }

    // Add publication type filter if specified
    if (publicationType) {
      semanticScholarUrl.searchParams.append('publicationTypes', publicationType)
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY
    }

    const response = await fetch(semanticScholarUrl.toString(), {
      headers,
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`Semantic Scholar API error: ${response.status}`)
    }

    const data = await response.json()
    let papers = data.data || []

    // Apply filters
    if (onlyReviews) {
      papers = papers.filter((paper: any) => {
        const title = paper.title?.toLowerCase() || ''
        const abstract = paper.abstract?.toLowerCase() || ''
        const publicationTypes = paper.publicationTypes || []
        return (
          publicationTypes.includes('Review') ||
          title.includes('review') ||
          abstract.includes('systematic review') ||
          abstract.includes('meta-analysis')
        )
      })
    }

    if (onlyOpenAccess) {
      papers = papers.filter((paper: any) => paper.isOpenAccess === true)
    }

    if (minCitations > 0) {
      papers = papers.filter((paper: any) => (paper.citationCount || 0) >= minCitations)
    }

    // Filter by pathology journals if specified
    if (venue === 'pathology-journals') {
      papers = papers.filter((paper: any) => {
        const paperVenue = paper.venue || paper.journal?.name || ''
        return PATHOLOGY_JOURNALS.some(journal =>
          paperVenue.toLowerCase().includes(journal.toLowerCase()) ||
          journal.toLowerCase().includes(paperVenue.toLowerCase())
        )
      })
    }

    // Sort results based on sortBy parameter
    switch (sortBy) {
      case 'citations':
        papers.sort((a: any, b: any) => (b.citationCount || 0) - (a.citationCount || 0))
        break
      case 'year-desc':
        papers.sort((a: any, b: any) => (b.year || 0) - (a.year || 0))
        break
      case 'year-asc':
        papers.sort((a: any, b: any) => (a.year || 0) - (b.year || 0))
        break
      case 'relevance':
        // Keep original order from Semantic Scholar (already sorted by relevance)
        break
      default:
        papers.sort((a: any, b: any) => (b.citationCount || 0) - (a.citationCount || 0))
    }

    const results = papers

    return NextResponse.json({
      total: results.length,
      papers: results.map((paper: any) => ({
        paperId: paper.paperId,
        title: paper.title,
        authors: paper.authors?.map((a: any) => a.name) || [],
        year: paper.year,
        venue: paper.venue,
        journal: paper.journal?.name || paper.venue,
        publicationDate: paper.publicationDate,
        citationCount: paper.citationCount,
        influentialCitationCount: paper.influentialCitationCount,
        abstract: paper.abstract,
        isOpenAccess: paper.isOpenAccess,
        openAccessPdf: paper.openAccessPdf?.url,
        publicationTypes: paper.publicationTypes || [],
        url: `https://www.semanticscholar.org/paper/${paper.paperId}`
      }))
    })
  } catch (error) {
    console.error('Semantic Scholar API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch papers from Semantic Scholar' },
      { status: 500 }
    )
  }
}
