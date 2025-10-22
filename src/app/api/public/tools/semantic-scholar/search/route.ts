import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = searchParams.get('limit') || '10'

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 })
    }

    // Semantic Scholar API endpoint
    // Using the bulk search endpoint to find review articles on pathology topics
    const semanticScholarUrl = new URL('https://api.semanticscholar.org/graph/v1/paper/search')
    semanticScholarUrl.searchParams.append('query', query)
    semanticScholarUrl.searchParams.append('limit', limit)
    semanticScholarUrl.searchParams.append('fields', 'paperId,title,authors,year,venue,citationCount,abstract,isOpenAccess,openAccessPdf,publicationTypes,journal,publicationDate')

    // Filter for review articles by adding keywords
    const reviewQuery = `${query} review pathology`
    semanticScholarUrl.searchParams.set('query', reviewQuery)

    console.log('Fetching from Semantic Scholar:', semanticScholarUrl.toString())

    // Prepare headers - add API key if available
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }

    // Optional: Add API key from environment variable if available
    if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
      headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY
    }

    const response = await fetch(semanticScholarUrl.toString(), {
      headers,
      // Add timeout
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Semantic Scholar API error:', response.status, errorText)

      // Handle rate limiting specifically
      if (response.status === 429) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded. Please wait a moment and try again. For frequent use, consider adding a Semantic Scholar API key to your environment variables.',
            rateLimited: true
          },
          { status: 429 }
        )
      }

      // Handle other errors
      return NextResponse.json(
        {
          error: `Failed to fetch from Semantic Scholar: ${response.statusText}`,
          status: response.status
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    // Filter and sort results to prioritize review articles
    const papers = data.data || []
    const reviewPapers = papers.filter((paper: any) => {
      const title = paper.title?.toLowerCase() || ''
      const abstract = paper.abstract?.toLowerCase() || ''
      const publicationTypes = paper.publicationTypes || []

      // Prioritize papers marked as reviews or with review keywords
      return (
        publicationTypes.includes('Review') ||
        title.includes('review') ||
        abstract.includes('systematic review') ||
        abstract.includes('literature review') ||
        abstract.includes('meta-analysis')
      )
    })

    // If we found review papers, use those; otherwise use all results
    const results = reviewPapers.length > 0 ? reviewPapers : papers

    // Sort by citation count (most cited first)
    results.sort((a: any, b: any) => (b.citationCount || 0) - (a.citationCount || 0))

    return NextResponse.json({
      total: results.length,
      papers: results.map((paper: any) => ({
        paperId: paper.paperId,
        title: paper.title,
        authors: paper.authors?.map((a: any) => a.name) || [],
        year: paper.year,
        venue: paper.venue,
        journal: paper.journal?.name || paper.venue,
        citationCount: paper.citationCount,
        abstract: paper.abstract,
        isOpenAccess: paper.isOpenAccess,
        openAccessPdf: paper.openAccessPdf?.url,
        publicationTypes: paper.publicationTypes || [],
        publicationDate: paper.publicationDate
      }))
    })

  } catch (error) {
    console.error('Error fetching from Semantic Scholar:', error)

    return NextResponse.json(
      { error: 'Failed to search Semantic Scholar API' },
      { status: 500 }
    )
  }
}
