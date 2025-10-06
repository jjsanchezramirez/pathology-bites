// Citation metadata extraction utilities

export interface CitationData {
  title: string
  authors: string[]
  year: string
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  doi?: string
  url?: string
  publisher?: string
  edition?: string
  accessDate?: string
  type: 'journal' | 'book' | 'website'
}

// OpenLibrary API response types
interface OpenLibraryWork {
  title: string
  authors?: Array<{ name: string }>
  publish_date?: string
  publishers?: string[]
  edition_name?: string
}

interface OpenLibraryResponse {
  [isbn: string]: {
    title: string
    authors: Array<{ name: string }>
    publish_date: string
    publishers: string[]
    identifiers?: {
      isbn_10?: string[]
      isbn_13?: string[]
    }
  }
}

// CrossRef API response types
interface CrossRefWork {
  title: string[]
  author: Array<{ given: string; family: string }>
  published: { 'date-parts': number[][] }
  'container-title': string[]
  volume?: string
  issue?: string
  page?: string
  DOI: string
  URL?: string
}

interface CrossRefResponse {
  message: CrossRefWork
}

// PubMed API response types (simplified)
interface PubMedArticle {
  title: string
  authors: string[]
  journal: string
  year: string
  volume?: string
  issue?: string
  pages?: string
  doi?: string
}

/**
 * Extract metadata from a website URL by parsing HTML meta tags
 */
export async function extractWebsiteMetadata(url: string): Promise<CitationData> {
  try {
    // Validate URL format
    new URL(url)

    const response = await fetch(`/api/public/tools/citation-generator/extract-url-metadata?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch website metadata`)
    }

    const metadata = await response.json()

    return {
      title: metadata.title || extractTitleFromUrl(url),
      authors: Array.isArray(metadata.authors) && metadata.authors.length > 0
        ? metadata.authors
        : ['Unknown Author'],
      year: metadata.year || new Date().getFullYear().toString(),
      url: url,
      publisher: metadata.publisher || extractDomainFromUrl(url),
      accessDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
      type: 'website'
    }
  } catch (error) {
    console.error('Error extracting website metadata:', error)

    // Fallback to basic URL parsing
    return {
      title: extractTitleFromUrl(url),
      authors: ['Unknown Author'],
      year: new Date().getFullYear().toString(),
      url: url,
      publisher: extractDomainFromUrl(url),
      accessDate: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
      type: 'website'
    }
  }
}

/**
 * Extract metadata from book APIs using ISBN
 */
export async function extractBookMetadata(isbn: string): Promise<CitationData> {
  try {
    // Clean ISBN (remove hyphens and spaces)
    const cleanIsbn = isbn.replace(/[-\s]/g, '')

    if (!cleanIsbn || cleanIsbn.length < 10) {
      throw new Error('Invalid ISBN format')
    }

    const response = await fetch(`/api/public/tools/citation-generator/extract-book-metadata?isbn=${encodeURIComponent(cleanIsbn)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch book metadata`)
    }

    const metadata = await response.json()

    return {
      title: metadata.title || 'Unknown Title',
      authors: Array.isArray(metadata.authors) && metadata.authors.length > 0
        ? metadata.authors
        : ['Unknown Author'],
      year: metadata.year || new Date().getFullYear().toString(),
      publisher: metadata.publisher || 'Unknown Publisher',
      type: 'book'
    }
  } catch (error) {
    console.error('Error extracting book metadata:', error)

    // Fallback response
    return {
      title: 'Unknown Title',
      authors: ['Unknown Author'],
      year: new Date().getFullYear().toString(),
      publisher: 'Unknown Publisher',
      type: 'book'
    }
  }
}



/**
 * Extract metadata from journal APIs using DOI
 */
export async function extractJournalMetadata(doi: string): Promise<CitationData> {
  try {
    // Clean DOI (remove doi: prefix if present)
    const cleanDoi = doi.replace(/^doi:/, '').replace(/^https?:\/\/(dx\.)?doi\.org\//, '')

    if (!cleanDoi) {
      throw new Error('Invalid DOI format')
    }

    const response = await fetch(`/api/public/tools/citation-generator/extract-journal-metadata?doi=${encodeURIComponent(cleanDoi)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch journal metadata`)
    }

    const metadata = await response.json()

    return {
      title: metadata.title || 'Unknown Title',
      authors: Array.isArray(metadata.authors) && metadata.authors.length > 0
        ? metadata.authors
        : ['Unknown Author'],
      year: metadata.year || new Date().getFullYear().toString(),
      journal: metadata.journal || 'Unknown Journal',
      volume: metadata.volume,
      issue: metadata.issue,
      pages: metadata.pages,
      doi: metadata.doi || cleanDoi,
      url: metadata.url,
      type: 'journal'
    }
  } catch (error) {
    console.error('Error extracting journal metadata:', error)

    // Fallback response
    return {
      title: 'Unknown Article',
      authors: ['Unknown Author'],
      year: new Date().getFullYear().toString(),
      journal: 'Unknown Journal',
      doi: doi,
      type: 'journal'
    }
  }
}





/**
 * Helper function to extract domain from URL
 */
function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return 'Unknown Website'
  }
}

/**
 * Helper function to extract title from URL
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    
    // Try to extract meaningful title from path
    const segments = pathname.split('/').filter(segment => segment.length > 0)
    const lastSegment = segments[segments.length - 1]
    
    if (lastSegment && lastSegment !== 'index.html') {
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.(html?|php|aspx?)$/i, '')
        .replace(/\b\w/g, l => l.toUpperCase())
    }
    
    return urlObj.hostname.replace(/^www\./, '')
  } catch {
    return 'Web Page'
  }
}

/**
 * Main function to extract metadata based on input type
 */
export async function extractMetadata(input: string, type: 'url' | 'doi' | 'isbn'): Promise<CitationData> {
  switch (type) {
    case 'url':
      return extractWebsiteMetadata(input)
    case 'doi':
      return extractJournalMetadata(input)
    case 'isbn':
      return extractBookMetadata(input)
    default:
      throw new Error('Unsupported input type')
  }
}
