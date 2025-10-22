// Utility to parse and extract links from question references

export interface ParsedReference {
  text: string
  doi?: string
  pmid?: string
  url?: string
}

/**
 * Extract DOI from text
 * Matches patterns like:
 * - doi: 10.1234/example
 * - DOI: 10.1234/example
 * - https://doi.org/10.1234/example
 * - 10.1234/example (standalone)
 */
function extractDOI(text: string): string | undefined {
  // Match DOI patterns
  const doiPatterns = [
    /doi:\s*(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+[a-zA-Z0-9])/i,
    /https?:\/\/doi\.org\/(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+[a-zA-Z0-9])/i,
    /\b(10\.\d{4,}\/[-._;()\/:a-zA-Z0-9]+[a-zA-Z0-9])\b/
  ]

  for (const pattern of doiPatterns) {
    const match = text.match(pattern)
    if (match) {
      // Remove any trailing punctuation that might have been captured
      return match[1].replace(/[.,;:]+$/, '')
    }
  }

  return undefined
}

/**
 * Extract PMID from text
 * Matches patterns like:
 * - PMID: 12345678
 * - PMID 12345678
 * - PubMed ID: 12345678
 */
function extractPMID(text: string): string | undefined {
  const pmidPatterns = [
    /PMID:?\s*(\d{7,8})/i,
    /PubMed\s+ID:?\s*(\d{7,8})/i
  ]

  for (const pattern of pmidPatterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return undefined
}

/**
 * Extract URL from text
 * Matches http:// or https:// URLs
 */
function extractURL(text: string): string | undefined {
  const urlPattern = /(https?:\/\/[^\s]+)/
  const match = text.match(urlPattern)
  return match ? match[1] : undefined
}

/**
 * Parse a single reference line and extract metadata
 */
export function parseReference(reference: string): ParsedReference {
  const doi = extractDOI(reference)
  const pmid = extractPMID(reference)
  const url = extractURL(reference)

  return {
    text: reference.trim(),
    doi,
    pmid,
    url
  }
}

/**
 * Parse multiple references from a text block
 * Splits by newlines and parses each reference
 */
export function parseReferences(referencesText: string): ParsedReference[] {
  if (!referencesText || !referencesText.trim()) {
    return []
  }

  // Split by newlines and filter out empty lines
  const lines = referencesText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  return lines.map(parseReference)
}

/**
 * Get the primary link for a reference
 * Priority: DOI > PMID > URL
 */
export function getPrimaryLink(reference: ParsedReference): string | undefined {
  if (reference.doi) {
    return `https://doi.org/${reference.doi}`
  }
  if (reference.pmid) {
    return `https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`
  }
  if (reference.url) {
    return reference.url
  }
  return undefined
}

/**
 * Get PDF link if available
 * For now, this checks if the URL ends with .pdf
 * In the future, this could be enhanced to check Unpaywall API or other sources
 */
export function getPDFLink(reference: ParsedReference): string | undefined {
  // Check if URL is a direct PDF link
  if (reference.url && reference.url.toLowerCase().endsWith('.pdf')) {
    return reference.url
  }

  // For DOIs, we could potentially check Unpaywall API
  // For now, return undefined
  return undefined
}

/**
 * Get link type label for display
 */
export function getLinkTypeLabel(reference: ParsedReference): string {
  if (reference.doi) return 'DOI'
  if (reference.pmid) return 'PubMed'
  if (reference.url) return 'Link'
  return ''
}

