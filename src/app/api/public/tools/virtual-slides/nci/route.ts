import { NextRequest, NextResponse } from 'next/server'

/**
 * API Proxy for NCI EVS Term Expansion
 * Proxies requests to avoid CORS issues when calling from the browser
 */

// Static fallback abbreviations
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
  'aitl': ['angioimmunoblastic t cell lymphoma'],
  'ptc': ['papillary thyroid carcinoma'],
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchNCIEVS(term: string): Promise<string[]> {
  try {
    const searchUrl = new URL('https://api-evsrest.nci.nih.gov/api/v1/concept/ncit/search')
    searchUrl.searchParams.set('term', term)
    searchUrl.searchParams.set('limit', '10')
    searchUrl.searchParams.set('include', 'synonyms')

    console.log(`[NCI EVS Proxy] Searching for: "${term}"`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(searchUrl.toString(), {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.warn(`[NCI EVS Proxy] API error: ${response.status}`)
      return []
    }

    const data = await response.json()
    const results = data?.concepts || []

    if (results.length === 0) {
      return []
    }

    const expansions = new Set<string>()
    const abbreviations = new Set<string>()

    // Only use top 2 concepts to reduce duplicate searches
    for (const result of results.slice(0, 2)) {
      const normalizedName = normalize(result.name)
      if (normalizedName !== normalize(term)) {
        expansions.add(normalizedName)
      }

      if (result.synonyms) {
        for (const syn of result.synonyms) {
          const normalizedSyn = normalize(syn.name)

          // Prioritize abbreviations (AB)
          if (syn.termType === 'AB') {
            if (normalizedSyn !== normalize(term)) {
              abbreviations.add(normalizedSyn)
            }
          } else {
            // Limit regular synonyms to 3 per concept (down from 15)
            if (normalizedSyn !== normalize(term) && expansions.size < 3) {
              expansions.add(normalizedSyn)
            }
          }
        }
      }
    }

    // Reduce from 10 to 5 total expansion terms
    const allExpansions = [...Array.from(abbreviations), ...Array.from(expansions)].slice(0, 5)
    console.log(`[NCI EVS Proxy] Found ${allExpansions.length} expansions`)
    return allExpansions

  } catch (error) {
    console.error('[NCI EVS Proxy] Search failed:', error)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const term = searchParams.get('term')

    if (!term) {
      return NextResponse.json(
        { error: 'Search term is required' },
        { status: 400 }
      )
    }

    const normalized = normalize(term)

    // Try NCI EVS API
    const nciEvsTerms = await searchNCIEVS(term)

    // Get static fallback
    const staticTerms = STATIC_ABBREVIATIONS[normalized] || []

    // Combine and deduplicate
    const allTerms = new Set<string>()
    nciEvsTerms.forEach(t => allTerms.add(normalize(t)))
    staticTerms.forEach(t => allTerms.add(normalize(t)))

    const uniqueTerms = Array.from(allTerms).filter(t => t !== normalized)

    // Determine source
    let source: 'nci_evs' | 'static' | 'hybrid'
    if (nciEvsTerms.length > 0 && staticTerms.length > 0) {
      source = 'hybrid'
    } else if (nciEvsTerms.length > 0) {
      source = 'nci_evs'
    } else {
      source = 'static'
    }

    return NextResponse.json({
      success: true,
      term: normalized,
      expansions: [normalized, ...uniqueTerms],
      source,
      count: uniqueTerms.length + 1
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=86400', // 7 days
      }
    })

  } catch (error) {
    console.error('[NCI EVS Proxy] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'An error occurred',
        success: false
      },
      { status: 500 }
    )
  }
}
