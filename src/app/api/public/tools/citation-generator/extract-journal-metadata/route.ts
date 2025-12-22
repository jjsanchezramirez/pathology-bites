import { NextRequest, NextResponse } from 'next/server'

// Server-side cache for DOI lookups (24 hour TTL)
const doiCache = new Map<string, { data: any; timestamp: number }>()
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
            authors: work.author?.map((author: any) =>
              author.family && author.given
                ? `${author.family}, ${author.given}`
                : author.family || author.given || 'Unknown Author'
            ) || ['Unknown Author'],
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
