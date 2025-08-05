// src/shared/utils/common-data-preloader.ts
/**
 * Pre-loading utility for common genes and citation data
 * Optimizes user experience by caching frequently accessed data
 */

// Common pathology-related genes that users frequently search
export const COMMON_GENES = [
  'TP53', 'BRCA1', 'BRCA2', 'EGFR', 'KRAS', 'PIK3CA', 'AKT1', 'PTEN',
  'MYC', 'RB1', 'CDKN2A', 'MLH1', 'MSH2', 'MSH6', 'PMS2', 'APC',
  'VHL', 'NF1', 'NF2', 'ATM', 'CHEK2', 'PALB2', 'RAD51C', 'RAD51D',
  'BRIP1', 'CDH1', 'STK11', 'SMAD4', 'DCC', 'CTNNB1'
]

// Common citation sources that might benefit from pre-loading
export const COMMON_CITATION_SOURCES = [
  // Common pathology journals DOIs (examples)
  'https://www.ncbi.nlm.nih.gov/pmc/',
  'https://pubmed.ncbi.nlm.nih.gov/',
  'https://www.nature.com/',
  'https://www.sciencedirect.com/',
  'https://onlinelibrary.wiley.com/',
  // Common textbook ISBNs could be added here
]

interface PreloadOptions {
  genes?: string[]
  maxGenes?: number
  batchSize?: number
  delayBetweenBatches?: number
}

/**
 * Pre-load common gene data in background
 */
export async function preloadCommonGenes(
  lookupFunction: (symbol: string) => Promise<any>,
  options: PreloadOptions = {}
): Promise<void> {
  const {
    genes = COMMON_GENES,
    maxGenes = 10, // Limit to prevent excessive API calls
    batchSize = 3, // Process in small batches
    delayBetweenBatches = 2000 // 2 second delay between batches
  } = options

  const genesToPreload = genes.slice(0, maxGenes)
  
  console.log(`🔄 Pre-loading ${genesToPreload.length} common genes in background...`)

  // Process genes in batches to avoid overwhelming the API
  for (let i = 0; i < genesToPreload.length; i += batchSize) {
    const batch = genesToPreload.slice(i, i + batchSize)
    
    // Process batch in parallel
    const batchPromises = batch.map(async (gene) => {
      try {
        await lookupFunction(gene)
        console.log(`✅ Pre-loaded gene: ${gene}`)
      } catch (error) {
        console.warn(`⚠️ Failed to pre-load gene ${gene}:`, error)
      }
    })

    await Promise.allSettled(batchPromises)
    
    // Delay between batches (except after the last batch)
    if (i + batchSize < genesToPreload.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }

  console.log('✅ Gene pre-loading completed')
}

/**
 * Initialize pre-loading after user interaction
 * This ensures we don't slow down initial page load
 */
export function initializePreloading(
  geneLookupFunction?: (symbol: string) => Promise<any>,
  options: PreloadOptions = {}
): void {
  // Only run in browser environment
  if (typeof window === 'undefined') return

  // Wait for initial user interaction before pre-loading
  const startPreloading = () => {
    // Remove listeners after first interaction
    document.removeEventListener('click', startPreloading)
    document.removeEventListener('keydown', startPreloading)
    document.removeEventListener('scroll', startPreloading)

    // Small delay to ensure user action is processed first
    setTimeout(() => {
      if (geneLookupFunction) {
        preloadCommonGenes(geneLookupFunction, options).catch(console.error)
      }
    }, 1000)
  }

  // Listen for user interactions
  document.addEventListener('click', startPreloading, { once: true })
  document.addEventListener('keydown', startPreloading, { once: true })
  document.addEventListener('scroll', startPreloading, { once: true })

  // Fallback: start pre-loading after 10 seconds if no interaction
  setTimeout(startPreloading, 10000)
}

/**
 * Check if gene is commonly searched and should be prioritized for caching
 */
export function isCommonGene(symbol: string): boolean {
  return COMMON_GENES.includes(symbol.toUpperCase())
}

/**
 * Get cache priority based on gene popularity
 */
export function getGeneCachePriority(symbol: string): 'high' | 'normal' | 'low' {
  const upperSymbol = symbol.toUpperCase()
  
  // High priority for very common genes
  const highPriorityGenes = ['TP53', 'BRCA1', 'BRCA2', 'EGFR', 'KRAS']
  if (highPriorityGenes.includes(upperSymbol)) return 'high'
  
  // Normal priority for other common genes
  if (COMMON_GENES.includes(upperSymbol)) return 'normal'
  
  // Low priority for uncommon genes
  return 'low'
}