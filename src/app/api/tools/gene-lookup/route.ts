import { NextRequest, NextResponse } from 'next/server'

// Cache for gene lookup results with 1-hour TTL
const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const geneCache = new Map<string, { data: any, timestamp: number }>()

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const geneSymbol = searchParams.get('symbol')

  if (!geneSymbol) {
    return NextResponse.json(
      { error: 'Gene symbol is required' },
      { status: 400 }
    )
  }

  try {
    const cacheKey = geneSymbol.trim().toUpperCase()
    const now = Date.now()

    // Check cache first
    const cached = geneCache.get(cacheKey)
    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return NextResponse.json({ 
        data: cached.data,
        cached: true
      })
    }
    // Fetch from both APIs in parallel
    const [hugoResponse, harmonizomeResponse] = await Promise.all([
      fetch(`https://rest.genenames.org/fetch/symbol/${geneSymbol.trim()}`, {
        headers: {
          'Accept': 'application/xml',
          'User-Agent': 'PathologyBites/1.0'
        }
      }),
      fetch(`https://amp.pharm.mssm.edu/Harmonizome/api/1.0/gene/${geneSymbol.trim()}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PathologyBites/1.0'
        }
      })
    ])

    // Process HGNC response
    if (!hugoResponse.ok) {
      throw new Error(`HGNC API error: ${hugoResponse.statusText}`)
    }

    const hugoData = await hugoResponse.text()
    
    // Check if gene was found
    if (hugoData.includes('numFound="0"')) {
      return NextResponse.json(
        { error: 'Gene not found in HGNC database.' },
        { status: 404 }
      )
    }

    // Process Harmonizome response (optional)
    let harmonizomeData = null
    if (harmonizomeResponse.ok) {
      try {
        harmonizomeData = await harmonizomeResponse.json()
        if (harmonizomeData.status === 400) {
          harmonizomeData = null
        }
      } catch {
        // Ignore harmonizome errors, use HGNC data only
        harmonizomeData = null
      }
    }

    // Parse HGNC XML data
    const hugoGeneInfo = parseHGNCData(hugoData)
    
    // Parse Harmonizome data if available
    const harmonizomeGeneInfo = harmonizomeData ? parseHarmonizomeData(harmonizomeData) : { aliasSymbols: [], description: '' }
    
    // Combine the data
    const combinedGeneInfo = {
      ...hugoGeneInfo,
      aliasSymbols: [...new Set([...hugoGeneInfo.aliasSymbols, ...harmonizomeGeneInfo.aliasSymbols])],
      description: hugoGeneInfo.description || harmonizomeGeneInfo.description || ''
    }

    // Cache the result
    geneCache.set(cacheKey, {
      data: combinedGeneInfo,
      timestamp: now
    })

    // Clean up old cache entries (keep only last 1000 entries)
    if (geneCache.size > 1000) {
      const entries = Array.from(geneCache.entries())
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
      const toKeep = entries.slice(0, 1000)
      geneCache.clear()
      toKeep.forEach(([key, value]) => geneCache.set(key, value))
    }

    return NextResponse.json({ data: combinedGeneInfo })

  } catch (error) {
    console.error('Gene lookup error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch gene information' },
      { status: 500 }
    )
  }
}

function parseHGNCData(xmlData: string) {
  // Parse XML using DOMParser would require a browser environment
  // For server-side, we'll use regex parsing or a server-compatible XML parser
  
  // Extract basic gene information using regex
  const symbolMatch = xmlData.match(/<str name="symbol">([^<]+)<\/str>/)
  const nameMatch = xmlData.match(/<str name="name">([^<]+)<\/str>/)
  const locationMatch = xmlData.match(/<str name="location">([^<]+)<\/str>/)
  const hgncIdMatch = xmlData.match(/<str name="hgnc_id">([^<]+)<\/str>/)
  const entrezIdMatch = xmlData.match(/<str name="entrez_id">([^<]+)<\/str>/)
  const ensemblIdMatch = xmlData.match(/<str name="ensembl_gene_id">([^<]+)<\/str>/)
  
  // Extract alias symbols
  const aliasMatches = xmlData.match(/<arr name="alias_symbol">([\s\S]*?)<\/arr>/)
  const aliasSymbols: string[] = []
  if (aliasMatches) {
    const aliasContent = aliasMatches[1]
    const aliases = aliasContent.match(/<str>([^<]+)<\/str>/g)
    if (aliases) {
      aliases.forEach(alias => {
        const match = alias.match(/<str>([^<]+)<\/str>/)
        if (match) aliasSymbols.push(match[1])
      })
    }
  }

  // Extract previous names
  const prevMatches = xmlData.match(/<arr name="prev_name">([\s\S]*?)<\/arr>/)
  const previousNames: string[] = []
  if (prevMatches) {
    const prevContent = prevMatches[1]
    const prevs = prevContent.match(/<str>([^<]+)<\/str>/g)
    if (prevs) {
      prevs.forEach(prev => {
        const match = prev.match(/<str>([^<]+)<\/str>/)
        if (match) previousNames.push(match[1])
      })
    }
  }

  return {
    hgncId: hgncIdMatch?.[1] || '',
    geneName: symbolMatch?.[1] || '',
    geneProduct: nameMatch?.[1] || '',
    previousNames,
    aliasSymbols,
    chromosomeLocation: locationMatch?.[1] || '',
    description: '',
    // Keep original fields for database links
    symbol: symbolMatch?.[1] || '',
    entrezId: entrezIdMatch?.[1] || '',
    ensemblId: ensemblIdMatch?.[1] || ''
  }
}

function parseHarmonizomeData(data: any) {
  return {
    aliasSymbols: data.synonyms || [],
    description: data.description || ''
  }
}

// Cache management endpoint
export async function DELETE() {
  geneCache.clear()
  
  return NextResponse.json({
    success: true,
    message: 'Gene lookup cache cleared'
  })
}
