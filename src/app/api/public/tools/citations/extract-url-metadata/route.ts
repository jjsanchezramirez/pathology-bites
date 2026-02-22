import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

/**
 * @swagger
 * /api/public/tools/citations/extract-url-metadata:
 *   get:
 *     summary: Extract metadata from a URL
 *     description: Extract citation metadata from a webpage URL including title, authors, publication year, publisher, description, and content type. Uses Open Graph, Twitter Cards, Schema.org, and other metadata sources.
 *     tags:
 *       - Public - Tools
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *           format: uri
 *         description: URL of the webpage to extract metadata from
 *         example: https://example.com/article
 *     responses:
 *       200:
 *         description: Successfully extracted metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 title:
 *                   type: string
 *                   description: Page or article title
 *                   example: Sample Article Title
 *                 authors:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: List of authors
 *                   example: ["John Doe", "Jane Smith"]
 *                 year:
 *                   type: string
 *                   description: Publication year (4-digit)
 *                   example: "2024"
 *                 publisher:
 *                   type: string
 *                   description: Publisher or website domain
 *                   example: example.com
 *                 description:
 *                   type: string
 *                   description: Page description or summary
 *                 type:
 *                   type: string
 *                   enum: [academic, website]
 *                   description: Content type (academic paper or general website)
 *                   example: website
 *       400:
 *         description: Bad request - URL parameter is required or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: URL parameter is required
 *       500:
 *         description: Internal server error or failed to fetch URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to extract metadata from the provided URL
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')
    
    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 })
    }
    
    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }
    
    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CitationBot/1.0; +https://pathologybites.com)'
      },
      // Add timeout
      signal: AbortSignal.timeout(10000)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Extract metadata from various sources
    const metadata = {
      title: extractTitle($),
      authors: extractAuthors($),
      year: extractYear($),
      publisher: extractPublisher($, url),
      description: extractDescription($),
      type: extractType($)
    }
    
    return NextResponse.json(metadata)
    
  } catch (error) {
    console.error('Error extracting metadata:', error)
    
    return NextResponse.json(
      { error: 'Failed to extract metadata from the provided URL' },
      { status: 500 }
    )
  }
}

function extractTitle($: cheerio.CheerioAPI): string {
  // Try multiple sources for title
  const sources = [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
    'meta[property="dc.title"]',
    'meta[name="citation_title"]',
    'title',
    'h1'
  ]
  
  for (const selector of sources) {
    const element = $(selector).first()
    let title = ''
    
    if (selector.startsWith('meta')) {
      title = element.attr('content') || ''
    } else {
      title = element.text().trim()
    }
    
    if (title && title.length > 0) {
      return title
    }
  }
  
  return 'Untitled'
}

function extractAuthors($: cheerio.CheerioAPI): string[] {
  const authors: string[] = []
  
  // Try citation meta tags first (for academic papers)
  $('meta[name="citation_author"]').each((_, element) => {
    const author = $(element).attr('content')
    if (author) authors.push(author)
  })
  
  if (authors.length > 0) return authors
  
  // Try other meta tags
  const authorSources = [
    'meta[name="author"]',
    'meta[property="article:author"]',
    'meta[name="twitter:creator"]',
    'meta[property="dc.creator"]'
  ]
  
  for (const selector of authorSources) {
    const content = $(selector).attr('content')
    if (content) {
      // Split by common delimiters
      const splitAuthors = content.split(/[,;]/).map(a => a.trim()).filter(a => a.length > 0)
      if (splitAuthors.length > 0) {
        return splitAuthors
      }
    }
  }
  
  // Try structured data (JSON-LD)
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonLd = JSON.parse($(element).html() || '{}')
      if (jsonLd.author) {
        if (Array.isArray(jsonLd.author)) {
          authors.push(...jsonLd.author.map((a: unknown) => (a as { name?: string }).name || a))
        } else if (typeof jsonLd.author === 'object' && jsonLd.author.name) {
          authors.push(jsonLd.author.name)
        } else if (typeof jsonLd.author === 'string') {
          authors.push(jsonLd.author)
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }
  })
  
  return authors.length > 0 ? authors : ['Unknown Author']
}

function extractYear($: cheerio.CheerioAPI): string {
  // Try publication date meta tags
  const dateSources = [
    'meta[name="citation_publication_date"]',
    'meta[property="article:published_time"]',
    'meta[name="pubdate"]',
    'meta[property="dc.date"]',
    'meta[name="date"]'
  ]
  
  for (const selector of dateSources) {
    const dateContent = $(selector).attr('content')
    if (dateContent) {
      const yearMatch = dateContent.match(/\d{4}/)
      if (yearMatch) return yearMatch[0]
    }
  }
  
  // Try structured data
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonLd = JSON.parse($(element).html() || '{}')
      const dateFields = ['datePublished', 'dateCreated', 'dateModified']
      
      for (const field of dateFields) {
        if (jsonLd[field]) {
          const yearMatch = jsonLd[field].match(/\d{4}/)
          if (yearMatch) return yearMatch[0]
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }
  })
  
  // Fallback to current year
  return new Date().getFullYear().toString()
}

function extractPublisher($: cheerio.CheerioAPI, url: string): string {
  // Try publisher meta tags
  const publisherSources = [
    'meta[name="citation_publisher"]',
    'meta[property="article:publisher"]',
    'meta[name="publisher"]',
    'meta[property="dc.publisher"]'
  ]
  
  for (const selector of publisherSources) {
    const publisher = $(selector).attr('content')
    if (publisher) return publisher
  }
  
  // Try structured data
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonLd = JSON.parse($(element).html() || '{}')
      if (jsonLd.publisher) {
        if (typeof jsonLd.publisher === 'object' && jsonLd.publisher.name) {
          return jsonLd.publisher.name
        } else if (typeof jsonLd.publisher === 'string') {
          return jsonLd.publisher
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }
  })
  
  // Fallback to domain name
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return 'Unknown Publisher'
  }
}

function extractDescription($: cheerio.CheerioAPI): string {
  const descriptionSources = [
    'meta[name="description"]',
    'meta[property="og:description"]',
    'meta[name="twitter:description"]',
    'meta[property="dc.description"]'
  ]
  
  for (const selector of descriptionSources) {
    const description = $(selector).attr('content')
    if (description) return description
  }
  
  return ''
}

function extractType($: cheerio.CheerioAPI): string {
  // Check for academic paper indicators
  const academicIndicators = [
    'meta[name="citation_journal_title"]',
    'meta[name="citation_conference_title"]',
    'meta[name="citation_doi"]'
  ]
  
  for (const selector of academicIndicators) {
    if ($(selector).length > 0) {
      return 'academic'
    }
  }
  
  // Check structured data
  let foundAcademic = false
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const jsonLd = JSON.parse($(element).html() || '{}')
      if (jsonLd['@type']) {
        const type = jsonLd['@type'].toLowerCase()
        if (type.includes('article') || type.includes('scholarlyarticle')) {
          foundAcademic = true
          return false // Break out of each loop
        }
      }
    } catch {
      // Ignore JSON parsing errors
    }
  })

  if (foundAcademic) {
    return 'academic'
  }
  
  return 'website'
}
