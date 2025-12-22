/**
 * NCI EVS Medical Term Expansion Service
 *
 * Uses the NCI Enterprise Vocabulary Services (EVS) REST API to expand medical abbreviations
 * and find synonyms/variations of medical terms for better search matching.
 *
 * Features:
 * - NCI EVS REST API integration (NO API KEY REQUIRED!)
 * - 125,000+ biomedical concepts (strong in cancer/pathology)
 * - Aggressive caching (7 days) to minimize API calls
 * - Fallback to static abbreviation list
 * - Rate limiting protection
 *
 * API: https://api-evsrest.nci.nih.gov/
 * Docs: https://api-evsrest.nci.nih.gov/swagger-ui/index.html
 */

// Static fallback abbreviations (original hardcoded list)
const STATIC_ABBREVIATIONS: Record<string, string[]> = {
  'dlbcl': ['diffuse large b cell lymphoma'],
  'cll': ['chronic lymphocytic leukemia'],
  'aml': ['acute myeloid leukemia'],
  'all': ['acute lymphoblastic leukemia'],
  'cml': ['chronic myeloid leukemia'],
  'fl': ['follicular lymphoma'],
  'hl': ['hodgkin lymphoma', 'hodgkin\'s lymphoma'],
  'nhl': ['non hodgkin lymphoma', 'non-hodgkin lymphoma'],
  'mm': ['multiple myeloma'],
  'dcis': ['ductal carcinoma in situ'],
  'lcis': ['lobular carcinoma in situ'],
  'idc': ['invasive ductal carcinoma'],
  'ilc': ['invasive lobular carcinoma'],
  'hcc': ['hepatocellular carcinoma'],
  'crc': ['colorectal carcinoma'],
  'gist': ['gastrointestinal stromal tumor'],
  'scc': ['squamous cell carcinoma'],
  'bcc': ['basal cell carcinoma'],
  'rcc': ['renal cell carcinoma'],
  'tcc': ['transitional cell carcinoma'],
}

interface NCIEVSSearchResult {
  code: string // NCI concept code
  name: string // Preferred term
  synonyms?: Array<{
    name: string
    termType?: string // AB = abbreviation, SY = synonym, PT = preferred term
  }>
}

interface CachedExpansion {
  terms: string[]
  timestamp: number
  source: 'nci_evs' | 'static' | 'hybrid'
}

// Cache for NCI EVS expansions (7 day TTL to minimize API calls)
const expansionCache = new Map<string, CachedExpansion>()
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_CACHE_SIZE = 1000 // Prevent unbounded growth

// Rate limiting
let lastAPICall = 0
const MIN_API_INTERVAL = 100 // Min 100ms between calls

/**
 * Normalize text for caching and comparison
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Search NCI EVS API for term expansions
 * NO API KEY REQUIRED!
 */
async function searchNCIEVS(term: string): Promise<string[]> {
  // Rate limiting
  const now = Date.now()
  const timeSinceLastCall = now - lastAPICall
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_API_INTERVAL - timeSinceLastCall))
  }
  lastAPICall = Date.now()

  try {
    // NCI EVS search endpoint - no authentication needed!
    const searchUrl = new URL('https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search')
    searchUrl.searchParams.set('term', term)
    searchUrl.searchParams.set('limit', '10')
    searchUrl.searchParams.set('include', 'synonyms') // Include synonyms to get abbreviations!

    console.log(`[NCI EVS] Searching for: "${term}"`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

    const response = await fetch(searchUrl.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`[NCI EVS] API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const results: NCIEVSSearchResult[] = data?.concepts || []

    if (results.length === 0) {
      console.log(`[NCI EVS] No results for "${term}"`)
      return []
    }

    // Extract unique terms from results
    const expansions = new Set<string>()
    const abbreviations = new Set<string>()

    for (const result of results.slice(0, 5)) {
      // Add the main name
      const normalizedName = normalize(result.name)
      if (normalizedName !== normalize(term)) {
        expansions.add(normalizedName)
      }

      // Add synonyms and extract abbreviations
      if (result.synonyms) {
        for (const syn of result.synonyms) {
          const normalizedSyn = normalize(syn.name)

          // Prioritize abbreviations (termType: "AB")
          if (syn.termType === 'AB') {
            if (normalizedSyn !== normalize(term)) {
              abbreviations.add(normalizedSyn)
            }
          } else {
            // Add other synonyms (limited to first 3 per concept)
            if (normalizedSyn !== normalize(term) && expansions.size < 15) {
              expansions.add(normalizedSyn)
            }
          }
        }
      }
    }

    // Combine abbreviations first (higher priority), then expansions
    const allExpansions = [...Array.from(abbreviations), ...Array.from(expansions)].slice(0, 10)

    console.log(`[NCI EVS] Found ${allExpansions.length} expansions (${abbreviations.size} abbreviations)`)
    return allExpansions

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[NCI EVS] Request timeout')
    } else {
      console.error('[NCI EVS] Search failed:', error)
    }
    return []
  }
}

/**
 * Get expanded terms for a search query
 * Uses cache -> NCI EVS API -> static fallback in that order
 */
export async function expandSearchTerm(term: string): Promise<string[]> {
  const normalized = normalize(term)
  const results = [normalized] // Always include the original term

  // Check cache first
  const cached = expansionCache.get(normalized)
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[Expansion] Using cached ${cached.source} results for "${term}"`)
    return [...results, ...cached.terms]
  }

  // Try NCI EVS API (no API key needed!)
  const nciEvsTerms = await searchNCIEVS(term)

  // Get static fallback
  const staticTerms = STATIC_ABBREVIATIONS[normalized] || []

  // Combine and deduplicate
  const allTerms = new Set<string>()

  // Add NCI EVS results first (higher quality)
  nciEvsTerms.forEach(t => allTerms.add(normalize(t)))

  // Add static results
  staticTerms.forEach(t => allTerms.add(normalize(t)))

  const uniqueTerms = Array.from(allTerms).filter(t => t !== normalized)

  // Determine source for logging
  let source: 'nci_evs' | 'static' | 'hybrid'
  if (nciEvsTerms.length > 0 && staticTerms.length > 0) {
    source = 'hybrid'
  } else if (nciEvsTerms.length > 0) {
    source = 'nci_evs'
  } else {
    source = 'static'
  }

  // Cache the result
  if (uniqueTerms.length > 0) {
    // Manage cache size
    if (expansionCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest 20% of entries
      const entries = Array.from(expansionCache.entries())
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
      const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2)
      entries.slice(0, toRemove).forEach(([key]) => expansionCache.delete(key))
      console.log(`[Expansion] Cache cleanup: removed ${toRemove} old entries`)
    }

    expansionCache.set(normalized, {
      terms: uniqueTerms,
      timestamp: Date.now(),
      source
    })

    console.log(`[Expansion] Cached ${uniqueTerms.length} ${source} terms for "${term}"`)
  }

  results.push(...uniqueTerms)
  return results
}

/**
 * Clear the expansion cache (for testing or manual refresh)
 */
export function clearExpansionCache(): void {
  const size = expansionCache.size
  expansionCache.clear()
  console.log(`[Expansion] Cache cleared (${size} entries removed)`)
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  const entries = Array.from(expansionCache.entries())
  const sources = {
    nci_evs: 0,
    static: 0,
    hybrid: 0
  }

  entries.forEach(([_, value]) => {
    sources[value.source]++
  })

  return {
    total_entries: expansionCache.size,
    max_size: MAX_CACHE_SIZE,
    ttl_days: CACHE_TTL / (24 * 60 * 60 * 1000),
    sources,
    nci_evs_available: true // Always available, no API key needed!
  }
}
