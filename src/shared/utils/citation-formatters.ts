// Citation formatting utilities for different academic styles
// Uses comprehensive NLM journal abbreviations database (~37,000 journals)

import { CitationData } from './citation-extractor'
import { R2_PUBLIC_URLS } from './r2-direct-access'

/**
 * NLM journal abbreviations database
 * Loaded from the comprehensive NLM journal list
 */
let JOURNAL_ABBREVIATIONS: Record<string, string> = {}

/**
 * Load journal abbreviations from JSON file
 */
const STORAGE_KEY = 'nlm-journal-abbreviations'
const STORAGE_VERSION = '2025.1'

async function loadJournalAbbreviations(): Promise<void> {
  // Only load in browser environment to avoid SSR issues
  if (typeof window === 'undefined') {
    console.log('Skipping journal abbreviations load during SSR')
    return
  }

  try {
    // Check if already loaded in memory
    if (Object.keys(JOURNAL_ABBREVIATIONS).length > 0) {
      console.log('Journal abbreviations already loaded in memory, skipping...')
      return
    }

    // Try to load from localStorage first (fastest)
    try {
      const cached = localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const { version, data, timestamp } = JSON.parse(cached)
        const age = Date.now() - timestamp
        const oneWeek = 7 * 24 * 60 * 60 * 1000
        
        if (version === STORAGE_VERSION && age < oneWeek && data?.abbreviations) {
          JOURNAL_ABBREVIATIONS = data.abbreviations
          console.log(`✅ Loaded ${Object.keys(JOURNAL_ABBREVIATIONS).length} abbreviations from localStorage cache`)
          return
        }
      }
    } catch {
      console.log('localStorage cache miss or invalid')
    }

    // Fetch from R2 if not cached
    const r2Url = R2_PUBLIC_URLS.NLM_JOURNAL_ABBREVIATIONS_JSON

    console.log('🔄 Loading NLM journal abbreviations from R2:', r2Url)

    const response = await fetch(r2Url, {
      headers: {
        'Accept': 'application/json'
      },
      cache: 'force-cache'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    JOURNAL_ABBREVIATIONS = data.abbreviations || {}

    // Cache in localStorage for future sessions
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        data,
        timestamp: Date.now()
      }))
    } catch (storageError) {
      console.log('Failed to cache in localStorage:', storageError)
    }

    console.log(`✅ Loaded ${Object.keys(JOURNAL_ABBREVIATIONS).length} journal abbreviations from R2 and cached`)
  } catch (error) {
    console.error('⚠️ Failed to load NLM journal abbreviations:', error)
    
    // Keep abbreviations empty - use journal names as-is
    JOURNAL_ABBREVIATIONS = {}
  }
}

// Initialize abbreviations on module load (with fallback for build time)
loadJournalAbbreviations().catch(() => {
  // Fallback is already handled in the function
})

/**
 * Check if journal abbreviations are loaded
 */
export function isJournalAbbreviationsLoaded(): boolean {
  return Object.keys(JOURNAL_ABBREVIATIONS).length > 100 // Should have many entries if properly loaded
}

/**
 * Manually reload journal abbreviations (useful for error recovery)
 */
export function reloadJournalAbbreviations(): Promise<void> {
  return loadJournalAbbreviations()
}

/**
 * Get statistics about loaded abbreviations
 */
export function getJournalAbbreviationStats(): { total: number; sampleEntries: string[] } {
  const entries = Object.keys(JOURNAL_ABBREVIATIONS)
  return {
    total: entries.length,
    sampleEntries: entries.slice(0, 5)
  }
}

/**
 * Force reload journal abbreviations (for debugging)
 */
export async function forceReloadJournalAbbreviations(): Promise<void> {
  // Clear existing abbreviations
  JOURNAL_ABBREVIATIONS = {}

  // Force reload
  await loadJournalAbbreviations()

  console.log('🔄 Force reloaded journal abbreviations:', Object.keys(JOURNAL_ABBREVIATIONS).length, 'entries')
}

/**
 * Helper function to format edition numbers for citations
 */
function formatEditionForCitation(value: string): string {
  if (!value) return ''

  // If it's just a number, format it properly for display
  const num = parseInt(value.trim())
  if (!isNaN(num) && num > 0) {
    let suffix = 'th'
    if (num % 10 === 1 && num % 100 !== 11) suffix = 'st'
    else if (num % 10 === 2 && num % 100 !== 12) suffix = 'nd'
    else if (num % 10 === 3 && num % 100 !== 13) suffix = 'rd'

    return `${num}${suffix} ed.`
  }

  // Return as-is if not a simple number (user might have typed "3rd ed." manually)
  return value
}

/**
 * Normalize text by removing diacritics and special characters
 * Exported for testing and potential reuse
 */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')                    // Decompose characters with diacritics
    .replace(/[\u0300-\u036f]/g, '')     // Remove diacritical marks
    .replace(/[øØ]/g, 'o')               // Handle special cases like Ø
    .replace(/[æÆ]/g, 'ae')              // Handle æ ligature
    .replace(/[œŒ]/g, 'oe')              // Handle œ ligature
    .replace(/[ßẞ]/g, 'ss')              // Handle German ß
    .replace(/[^\w\s]/g, '')             // Remove special characters except word chars and spaces
    .replace(/\s+/g, ' ')                // Normalize whitespace
    .trim()
    .toLowerCase()
}

/**
 * Decode HTML entities in text
 */
function decodeHtmlEntities(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  }
  
  return text.replace(/&[a-zA-Z0-9#]+;/g, (entity) => htmlEntities[entity] || entity)
}

/**
 * Helper function to abbreviate journal names using the NLM database
 */
function abbreviateJournal(journalName: string): string {
  if (!journalName) return ''

  // Decode HTML entities first
  const decodedJournal = decodeHtmlEntities(journalName)

  // Debug logging
  console.log(`🔍 Attempting to abbreviate journal: "${journalName}"`)
  if (decodedJournal !== journalName) {
    console.log(`🔤 Decoded to: "${decodedJournal}"`)
  }
  console.log(`📊 Available abbreviations: ${Object.keys(JOURNAL_ABBREVIATIONS).length}`)

  // Direct lookup first (try both original and decoded)
  const directMatch = JOURNAL_ABBREVIATIONS[journalName] || JOURNAL_ABBREVIATIONS[decodedJournal]
  if (directMatch) {
    console.log(`✅ Direct match found: "${decodedJournal}" → "${directMatch}"`)
    return directMatch
  }

  // Try case-insensitive lookup (use decoded version)
  const lowerJournal = decodedJournal.toLowerCase()
  for (const [title, abbr] of Object.entries(JOURNAL_ABBREVIATIONS)) {
    if (title.toLowerCase() === lowerJournal) {
      return abbr
    }
  }

  // Try normalized lookup (handles diacritics and special characters)
  const normalizedInput = normalizeText(decodedJournal)
  for (const [title, abbr] of Object.entries(JOURNAL_ABBREVIATIONS)) {
    if (normalizeText(title) === normalizedInput) {
      return abbr
    }
  }

  // Try matching where database entry might have subtitle but input doesn't
  for (const [title, abbr] of Object.entries(JOURNAL_ABBREVIATIONS)) {
    const cleanedDbTitle = title.toLowerCase()
      .replace(/\s*:\s*.*$/, '')  // Remove subtitle from database entry
      .trim()
    if (cleanedDbTitle === lowerJournal) {
      return abbr
    }
  }

  // Try normalized matching with subtitle removal
  for (const [title, abbr] of Object.entries(JOURNAL_ABBREVIATIONS)) {
    const cleanedDbTitle = normalizeText(title.replace(/\s*:\s*.*$/, ''))
    if (cleanedDbTitle === normalizedInput) {
      return abbr
    }
  }

  // Try partial matching (remove common prefixes/suffixes) - use decoded version
  const cleanedJournal = decodedJournal
    .replace(/^(The|An|A)\s+/i, '')  // Remove articles
    .replace(/\s*:\s*.*$/, '')        // Remove subtitles after colon
    .replace(/\s*\([^)]*\)$/, '')     // Remove parenthetical info
    .trim()

  if (cleanedJournal !== decodedJournal) {
    const cleanedMatch = JOURNAL_ABBREVIATIONS[cleanedJournal]
    if (cleanedMatch) return cleanedMatch

    // Try case-insensitive on cleaned version
    const lowerCleaned = cleanedJournal.toLowerCase()
    for (const [title, abbr] of Object.entries(JOURNAL_ABBREVIATIONS)) {
      if (title.toLowerCase() === lowerCleaned) {
        return abbr
      }
    }

    // Try normalized matching on cleaned version
    const normalizedCleaned = normalizeText(cleanedJournal)
    for (const [title, abbr] of Object.entries(JOURNAL_ABBREVIATIONS)) {
      if (normalizeText(title) === normalizedCleaned) {
        return abbr
      }
    }
  }
  
  // If no match found, return original title
  console.log(`❌ No abbreviation found for: "${journalName}" - returning original`)
  return journalName
}

/**
 * Helper function to parse and format author names
 */
function parseAuthorName(authorString: string): { first: string; middle: string; last: string } {
  // Handle various formats: "Last, First Middle", "First Middle Last", "Last, F. M.", etc.
  if (authorString.includes(',')) {
    const [last, firstMiddle] = authorString.split(',').map(s => s.trim())
    const names = firstMiddle.split(/\s+/)
    const first = names[0] || ''
    const middle = names.slice(1).join(' ')
    return { first, middle, last }
  } else {
    const names = authorString.split(/\s+/)
    const last = names[names.length - 1] || ''
    const first = names[0] || ''
    const middle = names.slice(1, -1).join(' ')
    return { first, middle, last }
  }
}

/**
 * Helper function to abbreviate first and middle names
 */
function abbreviateName(name: string): string {
  return name.split(/\s+/)
    .filter(n => n.length > 0)
    .map(n => n.charAt(0).toUpperCase())
    .join('')
}

/**
 * Helper function to convert title to sentence case
 */
function toSentenceCase(title: string): string {
  if (!title) return ''
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase()
}

/**
 * Helper function to format page numbers
 */
function formatPages(pages: string, style: 'p' | 'pp' | 'none'): string {
  if (!pages) return ''
  
  switch (style) {
    case 'p':
      return pages.includes('-') ? `pp. ${pages}` : `p. ${pages}`
    case 'pp':
      return `pp. ${pages}`
    case 'none':
      return pages
    default:
      return pages
  }
}

/**
 * Helper function to clean up extra spaces and punctuation
 */
function cleanCitation(citation: string): string {
  return citation
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/\s+\./g, '.') // Remove spaces before periods
    .replace(/\.\./g, '.') // Replace double periods with single period
    .replace(/\s+,/g, ',') // Remove spaces before commas
    .replace(/,,/g, ',') // Replace double commas with single comma
    .replace(/\s*;\s*/g, ';') // Clean semicolon spacing
    .trim()
}

/**
 * Format citation in APA style (7th edition)
 */
export function formatAPA(data: CitationData): string {
  const authors = formatAuthorsAPA(data.authors)
  const year = `(${data.year})`
  const title = data.title.endsWith('.') ? data.title : `${data.title}.`
  
  let citation = ''
  switch (data.type) {
    case 'journal':
      citation = formatJournalAPA(authors, year, title, data)
      break
    case 'book':
      citation = formatBookAPA(authors, year, title, data)
      break
    case 'website':
      citation = formatWebsiteAPA(authors, year, title, data)
      break
    default:
      citation = formatWebsiteAPA(authors, year, title, data)
  }
  
  return cleanCitation(citation)
}

/**
 * Format citation in MLA style (9th edition)
 */
export function formatMLA(data: CitationData): string {
  const authors = formatAuthorsMLA(data.authors)
  const title = formatTitleMLA(data.title, data.type)
  
  let citation = ''
  switch (data.type) {
    case 'journal':
      citation = formatJournalMLA(authors, title, data)
      break
    case 'book':
      citation = formatBookMLA(authors, title, data)
      break
    case 'website':
      citation = formatWebsiteMLA(authors, title, data)
      break
    default:
      citation = formatWebsiteMLA(authors, title, data)
  }
  
  return cleanCitation(citation)
}

/**
 * Format citation in AMA style (11th edition)
 */
export function formatAMA(data: CitationData): string {
  const authors = formatAuthorsAMA(data.authors)
  const title = data.title.endsWith('.') ? data.title : `${data.title}.`

  let citation = ''
  switch (data.type) {
    case 'journal':
      citation = formatJournalAMA(authors, title, data)
      break
    case 'book':
      citation = formatBookAMA(authors, title, data)
      break
    case 'website':
      citation = formatWebsiteAMA(authors, title, data)
      break
    default:
      citation = formatWebsiteAMA(authors, title, data)
  }

  return cleanCitation(citation)
}

/**
 * Format citation in Vancouver style
 */
export function formatVancouver(data: CitationData): string {
  const authors = formatAuthorsVancouver(data.authors)
  const title = data.title.endsWith('.') ? data.title : `${data.title}.`

  let citation = ''
  switch (data.type) {
    case 'journal':
      citation = formatJournalVancouver(authors, title, data)
      break
    case 'book':
      citation = formatBookVancouver(authors, title, data)
      break
    case 'website':
      citation = formatWebsiteVancouver(authors, title, data)
      break
    default:
      citation = formatWebsiteVancouver(authors, title, data)
  }

  return cleanCitation(citation)
}

// APA Formatting Functions
function formatAuthorsAPA(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Author'

  const formattedAuthors = authors.map(author => {
    const { first, middle, last } = parseAuthorName(author)
    const firstInitial = first ? `${first.charAt(0).toUpperCase()}.` : ''
    const middleInitial = middle ? ` ${middle.charAt(0).toUpperCase()}.` : ''
    return `${last}, ${firstInitial}${middleInitial}`.trim()
  })

  if (formattedAuthors.length === 1) return formattedAuthors[0]
  if (formattedAuthors.length === 2) return `${formattedAuthors[0]} & ${formattedAuthors[1]}`
  if (formattedAuthors.length <= 6) {
    const lastAuthor = formattedAuthors[formattedAuthors.length - 1]
    const otherAuthors = formattedAuthors.slice(0, -1).join(', ')
    return `${otherAuthors}, & ${lastAuthor}`
  }
  // More than 6 authors - list first 6, then et al.
  const first6 = formattedAuthors.slice(0, 6).join(', ')
  return `${first6}, et al.`
}

function formatJournalAPA(authors: string, year: string, title: string, data: CitationData): string {
  const journal = data.journal ? `*${data.journal}*` : '*Unknown Journal*'
  const volume = data.volume ? `*${data.volume}*` : ''
  const issue = data.issue ? `(${data.issue})` : ''
  const pages = data.pages ? `, ${data.pages}` : ''
  const doi = data.doi ? ` https://doi.org/${data.doi}` : ''
  
  return `${authors} ${year} ${title} ${journal}, ${volume}${issue}${pages}.${doi}`
}

function formatBookAPA(authors: string, year: string, title: string, data: CitationData): string {
  const publisher = typeof data.publisher === 'string' ? data.publisher : 'Unknown Publisher'
  const edition = data.edition ? ` (${formatEditionForCitation(data.edition)})` : ''

  return `${authors} ${year} *${title.replace(/\.$/, '')}*${edition}. ${publisher}.`
}

function formatWebsiteAPA(authors: string, year: string, title: string, data: CitationData): string {
  const siteName = data.publisher || 'Website'
  const url = data.url || ''
  const accessDate = data.accessDate ? new Date(data.accessDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) : ''
  
  let citation = `${authors} ${year} ${title} *${siteName}*.`
  if (url) citation += ` ${url}`
  if (accessDate) citation += ` (accessed ${accessDate})`
  
  return citation
}

// MLA Formatting Functions
function formatAuthorsMLA(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Author'

  const formattedAuthors = authors.map((author, index) => {
    const { first, middle, last } = parseAuthorName(author)

    if (index === 0) {
      // First author: Last, First Middle
      const fullFirst = middle ? `${first} ${middle}` : first
      return `${last}, ${fullFirst}`.trim()
    } else {
      // Subsequent authors: First Middle Last
      const fullFirst = middle ? `${first} ${middle}` : first
      return `${fullFirst} ${last}`.trim()
    }
  })

  if (formattedAuthors.length === 1) return formattedAuthors[0]
  if (formattedAuthors.length === 2) return `${formattedAuthors[0]} and ${formattedAuthors[1]}`

  // More than 2 authors - use et al.
  return `${formattedAuthors[0]} et al.`
}

function formatTitleMLA(title: string, type: string): string {
  if (type === 'journal') {
    return `"${title.replace(/\.$/, '')}"`
  } else {
    return `*${title.replace(/\.$/, '')}*`
  }
}

function formatJournalMLA(authors: string, title: string, data: CitationData): string {
  const journal = data.journal ? `*${data.journal}*` : '*Unknown Journal*'
  const volume = data.volume ? `, vol. ${data.volume}` : ''
  const issue = data.issue ? `, no. ${data.issue}` : ''
  const year = `, ${data.year}`
  const pages = data.pages ? `, ${formatPages(data.pages, 'pp')}` : ''
  const doi = data.doi ? `, doi:${data.doi}` : ''
  
  return `${authors}. ${title} ${journal}${volume}${issue}${year}${pages}${doi}.`
}

function formatBookMLA(authors: string, title: string, data: CitationData): string {
  const publisher = typeof data.publisher === 'string' ? data.publisher : 'Unknown Publisher'
  const year = data.year
  const edition = data.edition ? `, ${formatEditionForCitation(data.edition)}` : ''

  return `${authors}. ${title}${edition} ${publisher}, ${year}.`
}

function formatWebsiteMLA(authors: string, title: string, data: CitationData): string {
  const siteName = data.publisher || 'Website'
  const year = data.year
  const url = data.url || ''
  const accessDate = data.accessDate ? new Date(data.accessDate).toLocaleDateString('en-US', { 
    day: 'numeric',
    month: 'short', 
    year: 'numeric'
  }) : ''
  
  let citation = `${authors}. ${title} *${siteName}*, ${year}`
  if (url) citation += `, ${url}`
  if (accessDate) citation += `. Accessed ${accessDate}`
  citation += '.'
  
  return citation
}

// AMA Formatting Functions
function formatAuthorsAMA(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Author'
  
  const formattedAuthors = authors.map(author => {
    const { first, middle, last } = parseAuthorName(author)
    const firstInitial = abbreviateName(first)
    const middleInitial = abbreviateName(middle)
    return `${last} ${firstInitial}${middleInitial}`.trim()
  })
  
  if (formattedAuthors.length === 1) return formattedAuthors[0]
  if (formattedAuthors.length <= 6) return formattedAuthors.join(', ')
  
  // More than 6 authors
  const first3 = formattedAuthors.slice(0, 3).join(', ')
  return `${first3}, et al`
}

function formatJournalAMA(authors: string, title: string, data: CitationData): string {
  const journal = abbreviateJournal(data.journal || 'Unknown Journal')
  const year = data.year
  const volume = data.volume || ''
  const issue = data.issue ? `(${data.issue})` : ''
  const pages = data.pages ? `:${data.pages}` : ''
  const doi = data.doi ? ` doi:${data.doi}` : ''

  return `${authors}. ${toSentenceCase(title)} *${journal}*. ${year};${volume}${issue}${pages}.${doi}`
}

function formatBookAMA(authors: string, title: string, data: CitationData): string {
  const publisher = typeof data.publisher === 'string' ? data.publisher : 'Unknown Publisher'
  const year = data.year
  const edition = data.edition ? ` ${formatEditionForCitation(data.edition)}` : ''

  return `${authors}. *${toSentenceCase(title.replace(/\.$/, ''))}*${edition} ${publisher}; ${year}.`
}

function formatWebsiteAMA(authors: string, title: string, data: CitationData): string {
  const siteName = data.publisher || 'Website'
  const year = data.year
  const url = data.url || ''
  const accessDate = data.accessDate ? new Date(data.accessDate).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) : ''
  
  let citation = `${authors}. ${toSentenceCase(title)} *${siteName}*. ${year}.`
  if (url) citation += ` ${url}.`
  if (accessDate) citation += ` Accessed ${accessDate}.`
  
  return citation
}

// Vancouver Formatting Functions
function formatAuthorsVancouver(authors: string[]): string {
  if (authors.length === 0) return 'Unknown Author'
  
  const formattedAuthors = authors.map(author => {
    const { first, middle, last } = parseAuthorName(author)
    const firstInitial = abbreviateName(first)
    const middleInitial = abbreviateName(middle)
    return `${last} ${firstInitial}${middleInitial}`.trim()
  })
  
  if (formattedAuthors.length === 1) return formattedAuthors[0]
  if (formattedAuthors.length <= 6) return formattedAuthors.join(', ')

  // More than 6 authors
  const first6 = formattedAuthors.slice(0, 6).join(', ')
  return `${first6}, et al`
}

function formatJournalVancouver(authors: string, title: string, data: CitationData): string {
  const journal = abbreviateJournal(data.journal || 'Unknown Journal')
  const year = data.year
  const volume = data.volume || ''
  const issue = data.issue ? `(${data.issue})` : ''
  const pages = data.pages ? `:${data.pages}` : ''
  const doi = data.doi ? ` doi: ${data.doi}` : ''

  return `${authors}. ${toSentenceCase(title)} ${journal}. ${year};${volume}${issue}${pages}.${doi}`
}

function formatBookVancouver(authors: string, title: string, data: CitationData): string {
  const publisher = typeof data.publisher === 'string' ? data.publisher : 'Unknown Publisher'
  const year = data.year
  const edition = data.edition ? ` ${formatEditionForCitation(data.edition)}` : ''

  return `${authors}. ${toSentenceCase(title.replace(/\.$/, ''))}${edition} ${publisher}; ${year}.`
}

function formatWebsiteVancouver(authors: string, title: string, data: CitationData): string {
  const siteName = data.publisher || 'Website'
  const year = data.year
  const url = data.url || ''
  const accessDate = data.accessDate ? new Date(data.accessDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }) : ''

  let citation = `${authors}. ${toSentenceCase(title)} ${siteName}. ${year}.`
  if (url) citation += ` Available from: ${url}.`
  if (accessDate) citation += ` [cited ${accessDate}].`

  return citation
}