import { NextRequest, NextResponse } from 'next/server'

/**
 * @swagger
 * /api/public/tools/citations/extract-journal-metadata:
 *   get:
 *     summary: Extract journal article metadata from DOI
 *     description: Retrieve journal article metadata from CrossRef API using DOI. Results are cached for 24 hours.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: query
 *         name: doi
 *         required: true
 *         schema:
 *           type: string
 *         description: Digital Object Identifier (DOI) with or without prefix (doi:, https://doi.org/, etc.)
 *         example: 10.1038/nature12373
 *     responses:
 *       200:
 *         description: Successfully retrieved journal article metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Article title
 *                   example: Sample Journal Article Title
 *                 authors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of authors in "LastName, FirstName" format
 *                   example: ["Smith, John", "Doe, Jane"]
 *                 year:
 *                   type: string
 *                   description: Publication year (4-digit)
 *                   example: "2023"
 *                 journal:
 *                   type: string
 *                   description: Journal name
 *                   example: Nature
 *                 volume:
 *                   type: string
 *                   description: Journal volume number
 *                   example: "500"
 *                 issue:
 *                   type: string
 *                   description: Journal issue number
 *                   example: "7462"
 *                 pages:
 *                   type: string
 *                   description: Page range
 *                   example: "175-179"
 *                 doi:
 *                   type: string
 *                   description: Cleaned DOI (without prefix)
 *                   example: 10.1038/nature12373
 *                 url:
 *                   type: string
 *                   description: Full DOI URL
 *                   example: https://doi.org/10.1038/nature12373
 *                 type:
 *                   type: string
 *                   enum: [journal]
 *                   description: Content type (always "journal")
 *                   example: journal
 *       400:
 *         description: Bad request - DOI is required or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: DOI parameter is required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to extract journal metadata
 */

// Server-side cache for DOI lookups (24 hour TTL)
const doiCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function cleanExpiredDOICache() {
  const now = Date.now()
  const keysToDelete: string[] = []

  doiCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach(key => doiCache.delete(key))

  // Keep cache size under 500 entries
  if (doiCache.size > 500) {
    const entries = Array.from(doiCache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    const toKeep = entries.slice(0, 500)
    doiCache.clear()
    toKeep.forEach(([key, value]) => doiCache.set(key, value))
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const doi = searchParams.get('doi')
    
    if (!doi) {
      return NextResponse.json({ error: 'DOI parameter is required' }, { status: 400 })
    }
    
    // Clean DOI (remove doi: prefix if present)
    const cleanDoi = doi.replace(/^doi:/, '').replace(/^https?:\/\/(dx\.)?doi\.org\//, '')

    if (!cleanDoi) {
      return NextResponse.json({ error: 'Invalid DOI format' }, { status: 400 })
    }

    // Check server-side cache first
    const cached = doiCache.get(cleanDoi)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[DOI Cache] Hit: ${cleanDoi}`)
      return NextResponse.json(cached.data)
    }

    // Clean expired cache entries periodically
    cleanExpiredDOICache()

    // Try CrossRef first
    try {
      const crossRefUrl = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`
      const response = await fetch(crossRefUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PathologyBites/1.0 (mailto:contact@pathologybites.com)'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const work = data.message

        if (work) {
          const result = {
            title: work.title?.[0] || 'Unknown Title',
            authors: work.author?.map((author: unknown) => {
              const typedAuthor = author as { family?: string; given?: string };
              return typedAuthor.family && typedAuthor.given
                ? `${typedAuthor.family}, ${typedAuthor.given}`
                : typedAuthor.family || typedAuthor.given || 'Unknown Author';
            }) || ['Unknown Author'],
            year: work.published?.['date-parts']?.[0]?.[0]?.toString() || new Date().getFullYear().toString(),
            journal: work['container-title']?.[0] || 'Unknown Journal',
            volume: work.volume,
            issue: work.issue,
            pages: work.page,
            doi: cleanDoi,
            url: work.URL,
            type: 'journal'
          }

          // Cache the successful result
          doiCache.set(cleanDoi, {
            data: result,
            timestamp: Date.now()
          })
          console.log(`[DOI Cache] Stored: ${cleanDoi}`)

          return NextResponse.json(result)
        }
      }
    } catch (error) {
      console.error('CrossRef API error:', error)
    }
    
    // Fallback response if CrossRef fails
    // In a real implementation, you could try PubMed here
    return NextResponse.json({
      title: 'Unknown Article',
      authors: ['Unknown Author'],
      year: new Date().getFullYear().toString(),
      journal: 'Unknown Journal',
      doi: cleanDoi,
      type: 'journal'
    })
    
  } catch (error) {
    console.error('Error extracting journal metadata:', error)
    
    return NextResponse.json(
      { error: 'Failed to extract journal metadata' },
      { status: 500 }
    )
  }
}
