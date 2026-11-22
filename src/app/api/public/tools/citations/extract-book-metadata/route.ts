import { NextRequest, NextResponse } from 'next/server'
import { log } from "@/shared/utils/logging";

/**
 * @swagger
 * /api/public/tools/citations/extract-book-metadata:
 *   get:
 *     summary: Extract book metadata from ISBN
 *     description: Retrieve book metadata from the Google Books API using ISBN. Results are cached for 24 hours.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: query
 *         name: isbn
 *         required: true
 *         schema:
 *           type: string
 *         description: ISBN-10 or ISBN-13 (hyphens and spaces are automatically removed)
 *         example: 978-0-596-52068-7
 *     responses:
 *       200:
 *         description: Successfully retrieved book metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Book title
 *                   example: JavaScript The Good Parts
 *                 authors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of authors
 *                   example: ["Douglas Crockford"]
 *                 year:
 *                   type: string
 *                   description: Publication year (4-digit)
 *                   example: "2008"
 *                 publisher:
 *                   type: string
 *                   description: Publisher name
 *                   example: O'Reilly Media
 *                 type:
 *                   type: string
 *                   enum: [book]
 *                   description: Content type (always "book")
 *                   example: book
 *       400:
 *         description: Bad request - ISBN is required or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: ISBN parameter is required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to extract book metadata
 */

// Server-side cache for ISBN lookups (24 hour TTL)
const isbnCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

function cleanExpiredISBNCache() {
  const now = Date.now()
  const keysToDelete: string[] = []

  isbnCache.forEach((entry, key) => {
    if (now - entry.timestamp > CACHE_TTL) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach(key => isbnCache.delete(key))

  // Keep cache size under 500 entries
  if (isbnCache.size > 500) {
    const entries = Array.from(isbnCache.entries())
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
    const toKeep = entries.slice(0, 500)
    isbnCache.clear()
    toKeep.forEach(([key, value]) => isbnCache.set(key, value))
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const isbn = searchParams.get('isbn')
    
    if (!isbn) {
      return NextResponse.json({ error: 'ISBN parameter is required' }, { status: 400 })
    }
    
    // Clean ISBN (remove hyphens and spaces)
    const cleanIsbn = isbn.replace(/[-\s]/g, '')

    if (!cleanIsbn || cleanIsbn.length < 10) {
      return NextResponse.json({ error: 'Invalid ISBN format' }, { status: 400 })
    }

    // Check server-side cache first
    const cached = isbnCache.get(cleanIsbn)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      log.debug(`[ISBN Cache] Hit: ${cleanIsbn}`)
      return NextResponse.json(cached.data)
    }

    // Clean expired cache entries periodically
    cleanExpiredISBNCache()

    // Google Books. Open Library was dropped (Nov 2026): it took ~7 s a lookup and pushed
    // the route past the edge timeout. Keyless Google Books is rate-limited per IP, so a
    // GOOGLE_BOOKS_API_KEY is used when set. The timeout keeps a slow upstream from
    // hanging the request; on failure the generic fallback below is returned.
    try {
      const key = process.env.GOOGLE_BOOKS_API_KEY
      const googleBooksUrl =
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}` +
        (key ? `&key=${encodeURIComponent(key)}` : '')

      const response = await fetch(googleBooksUrl, {
        headers: {
          'User-Agent': 'PathologyBites/1.0 (mailto:contact@pathologybites.com)'
        },
        signal: AbortSignal.timeout(5000),
      })
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.items && data.items.length > 0) {
          const book = data.items[0].volumeInfo

          // Ensure publisher is a string
          let publisher = 'Unknown Publisher'
          if (book.publisher && typeof book.publisher === 'string') {
            publisher = book.publisher
          }

          const result = {
            title: book.title || 'Unknown Title',
            authors: book.authors || ['Unknown Author'],
            year: extractYearFromDate(book.publishedDate),
            publisher: publisher,
            type: 'book'
          }

          // Cache the successful result
          isbnCache.set(cleanIsbn, {
            data: result,
            timestamp: Date.now()
          })
          log.debug(`[ISBN Cache] Stored: ${cleanIsbn}`)

          return NextResponse.json(result)
        }
      }
    } catch (error) {
      log.error('Google Books API error:', error)
    }
    
    // Lookup failed or found nothing: return a fallback response
    return NextResponse.json({
      title: 'Unknown Title',
      authors: ['Unknown Author'],
      year: new Date().getFullYear().toString(),
      publisher: 'Unknown Publisher',
      type: 'book'
    })
    
  } catch (error) {
    log.error('Error extracting book metadata:', error)
    
    return NextResponse.json(
      { error: 'Failed to extract book metadata' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to extract year from various date formats
 */
function extractYearFromDate(dateString: string): string {
  if (!dateString) return new Date().getFullYear().toString()
  
  const yearMatch = dateString.match(/\d{4}/)
  return yearMatch ? yearMatch[0] : new Date().getFullYear().toString()
}
