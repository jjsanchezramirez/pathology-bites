// Client-side WSI selection to reduce Vercel API calls
// Updated to use direct R2 access instead of deleted API endpoints

interface VirtualSlide {
  id: string
  repository: string
  category: string
  subcategory: string
  diagnosis: string
  patient_info: string
  age: string | null
  gender: string | null
  clinical_history: string
  stain_type: string
  image_url?: string
  slide_url?: string
  case_url?: string
  thumbnail_url?: string
  preview_image_url?: string
  magnification?: string
  organ_system?: string
  difficulty_level?: string
  keywords?: string[]
  other_urls?: string[]
  source_metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

interface WSISelectionResult {
  success: boolean
  wsi?: VirtualSlide
  error?: string
  metadata: {
    selected_at: string
    selection_time_ms: number
    category_filter?: string
    repository: string
    total_slides: number
    filtered_slides: number
    excluded_slides: number
    client_side: true
  }
}

// Cache for virtual slides data  
let cachedWSIData: VirtualSlide[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Direct R2 access URL (same as other files)
const WSI_DATA_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/public_wsi_cases.json'

// Embeddable repositories (matching server-side logic)
const EMBEDDABLE_REPOSITORIES = [
  'Hematopathology eTutorial',
  'Rosai Collection', 
  'PathPresenter',
  'MGH Pathology'
]

/**
 * Load and cache virtual slides data directly from R2
 */
async function loadVirtualSlidesData(): Promise<VirtualSlide[]> {
  const now = Date.now()
  
  // Return cached data if still fresh
  if (cachedWSIData && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[Client WSI] Using cached virtual slides data')
    return cachedWSIData
  }
  
  console.log('[Client WSI] Loading virtual slides data directly from R2...')
  const startTime = Date.now()
  
  try {
    const response = await fetch(WSI_DATA_URL, {
      cache: 'force-cache',
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch WSI data: ${response.status} ${response.statusText}`)
    }
    
    const json = await response.json()
    
    // Handle the PathPresenter cases JSON format (same as use-client-wsi-data.ts)
    let pathPresenterCases = json.cases || []
    
    // Convert PathPresenter cases to VirtualSlide format
    const entries: VirtualSlide[] = pathPresenterCases.map((pathCase: any, index: number) => {
      // Generate consistent ID
      const caseId = `pathpresenter_${index + 1}`
      
      // Parse authors - handle both string and array formats
      let authorsArray: string[] = []
      if (pathCase.authors) {
        if (Array.isArray(pathCase.authors)) {
          authorsArray = pathCase.authors
        } else if (typeof pathCase.authors === 'string') {
          authorsArray = [pathCase.authors]
        }
      }
      
      // Extract age and gender from clinical history if available
      const clinicalHistory = pathCase.clinical_history || ''
      const ageMatch = clinicalHistory.match(/(\d+)[-\s]?year[-\s]?old/i)
      const genderMatch = clinicalHistory.match(/\b(male|female|man|woman)\b/i)
      
      return {
        id: caseId,
        repository: 'PathPresenter',
        category: pathCase.chapter || 'Unknown',
        subcategory: pathCase.organ_system || 'Unknown',
        diagnosis: pathCase.diagnosis || 'Unknown diagnosis',
        patient_info: `${pathCase.organ_system || 'Unknown organ'} case from PathPresenter`,
        age: ageMatch ? ageMatch[1] : null,
        gender: genderMatch ? genderMatch[1].toLowerCase() : null,
        clinical_history: clinicalHistory,
        stain_type: 'H&E', // Assume H&E for PathPresenter cases
        image_url: pathCase.url,
        slide_url: pathCase.url,
        case_url: pathCase.url,
        thumbnail_url: '',
        preview_image_url: '',
        magnification: 'Variable',
        organ_system: pathCase.organ_system,
        difficulty_level: 'medium',
        keywords: [],
        other_urls: [],
        source_metadata: {
          pages: pathCase.pages,
          microscopic_features: pathCase.microscopic_features,
          other_prognostic_factors: pathCase.other_prognostic_factors,
          immuno_profile: pathCase.immuno_profile,
          molecular_profile: pathCase.molecular_profile,
          differential_diagnosis: pathCase.differential_diagnosis,
          authors: authorsArray
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
    
    // Filter out any entries without valid URLs
    const uniqueSlides = entries.filter(slide => 
      slide.image_url && 
      slide.image_url.startsWith('http') && 
      !slide.image_url.includes('localhost')
    )
    
    const loadTime = Date.now() - startTime
    console.log(`[Client WSI] Loaded ${uniqueSlides.length} slides directly from R2 in ${loadTime}ms`)
    
    // Cache the data
    cachedWSIData = uniqueSlides
    cacheTimestamp = now
    
    return uniqueSlides
    
  } catch (error) {
    console.error('[Client WSI] Error loading virtual slides data:', error)
    throw new Error('Failed to load virtual slides data from R2')
  }
}

/**
 * Select random WSI with filtering and exclusion (client-side)
 */
export async function selectRandomWSIClientSide(
  categoryFilter?: string,
  excludeIds: string[] = []
): Promise<WSISelectionResult> {
  const startTime = Date.now()
  
  try {
    console.log('[Client WSI] Starting client-side WSI selection')
    console.log('[Client WSI] Category filter:', categoryFilter || 'none')
    console.log('[Client WSI] Excluding IDs:', excludeIds)
    
    // Load virtual slides data
    let slides = await loadVirtualSlidesData()
    const totalSlides = slides.length
    
    // Apply category filter if provided
    if (categoryFilter && categoryFilter !== 'all') {
      slides = slides.filter(slide => 
        slide.category.toLowerCase().includes(categoryFilter.toLowerCase()) ||
        slide.subcategory.toLowerCase().includes(categoryFilter.toLowerCase())
      )
      console.log(`[Client WSI] After category filter '${categoryFilter}': ${slides.length} slides`)
    }
    
    // Apply exclusion filter
    const excludedCount = excludeIds.length
    if (excludeIds.length > 0) {
      slides = slides.filter(slide => !excludeIds.includes(slide.id))
      console.log(`[Client WSI] After excluding ${excludedCount} IDs: ${slides.length} slides`)
    }
    
    if (slides.length === 0) {
      return {
        success: false,
        error: 'No suitable WSI slides found after filtering',
        metadata: {
          selected_at: new Date().toISOString(),
          selection_time_ms: Date.now() - startTime,
          category_filter: categoryFilter,
          repository: '',
          total_slides: totalSlides,
          filtered_slides: 0,
          excluded_slides: excludedCount,
          client_side: true
        }
      }
    }
    
    // Improved random selection with better entropy
    const randomSeed = Date.now() + Math.random() * 1000000 + Math.random() * 99999
    const randomIndex = Math.floor(randomSeed % slides.length)
    const selectedSlide = slides[randomIndex]
    
    const selectionTime = Date.now() - startTime
    console.log(`[Client WSI] Selected slide: ${selectedSlide.id} - ${selectedSlide.diagnosis}`)
    console.log(`[Client WSI] Repository: ${selectedSlide.repository}`)
    console.log(`[Client WSI] Selection completed in ${selectionTime}ms`)
    
    return {
      success: true,
      wsi: selectedSlide,
      metadata: {
        selected_at: new Date().toISOString(),
        selection_time_ms: selectionTime,
        category_filter: categoryFilter,
        repository: selectedSlide.repository,
        total_slides: totalSlides,
        filtered_slides: slides.length,
        excluded_slides: excludedCount,
        client_side: true
      }
    }
    
  } catch (error) {
    const selectionTime = Date.now() - startTime
    console.error('[Client WSI] Error selecting WSI:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        selected_at: new Date().toISOString(),
        selection_time_ms: selectionTime,
        category_filter: categoryFilter,
        repository: '',
        total_slides: 0,
        filtered_slides: 0,
        excluded_slides: excludeIds.length,
        client_side: true
      }
    }
  }
}

/**
 * Clear the WSI data cache (useful for testing or manual refresh)
 */
export function clearWSICache(): void {
  cachedWSIData = null
  cacheTimestamp = 0
  console.log('[Client WSI] Cache cleared')
}

/**
 * Get cache status for debugging
 */
export function getWSICacheStatus() {
  const now = Date.now()
  const isValid = cachedWSIData && (now - cacheTimestamp) < CACHE_TTL
  const ageMinutes = cachedWSIData ? Math.round((now - cacheTimestamp) / 60000) : 0
  
  return {
    hasCache: !!cachedWSIData,
    isValid,
    ageMinutes,
    slideCount: cachedWSIData?.length || 0
  }
}

/**
 * Warm up the WSI cache by pre-loading data
 * Call this on app initialization for better user experience
 */
export async function warmUpWSICache(): Promise<void> {
  try {
    console.log('[Client WSI] Warming up cache...')
    await loadVirtualSlidesData()
    console.log('[Client WSI] Cache warmed up successfully')
  } catch (error) {
    console.warn('[Client WSI] Cache warm-up failed:', error)
  }
}