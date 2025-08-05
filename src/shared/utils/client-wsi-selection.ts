// Client-side WSI selection to reduce Vercel API calls

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

// Embeddable repositories (matching server-side logic)
const EMBEDDABLE_REPOSITORIES = [
  'Hematopathology eTutorial',
  'Rosai Collection', 
  'PathPresenter',
  'MGH Pathology'
]

/**
 * Load and cache virtual slides data via WSI metadata API
 */
async function loadVirtualSlidesData(): Promise<VirtualSlide[]> {
  const now = Date.now()
  
  // Return cached data if still fresh
  if (cachedWSIData && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[Client WSI] Using cached virtual slides data')
    return cachedWSIData
  }
  
  console.log('[Client WSI] Loading virtual slides data via WSI metadata API...')
  const startTime = Date.now()
  
  try {
    // Use the WSI metadata API to get all slides (it handles R2 access with proper auth)
    const response = await fetch('/api/tools/wsi-question-generator/wsi-metadata', {
      headers: {
        'Cache-Control': 'public, max-age=86400' // 24 hours browser caching
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch WSI metadata: ${response.status}`)
    }
    
    const result = await response.json()
    if (!result.success || !result.wsi) {
      throw new Error('Invalid WSI metadata response')
    }
    
    // Since the metadata API returns a single random WSI, we need to get multiple samples
    // Let's make several requests to build our cache
    const slides: VirtualSlide[] = []
    const sampleSize = 50 // Get a good sample size for client-side selection
    
    const promises = Array.from({ length: sampleSize }, async () => {
      try {
        const resp = await fetch('/api/tools/wsi-question-generator/wsi-metadata')
        if (resp.ok) {
          const data = await resp.json()
          if (data.success && data.wsi) {
            return data.wsi
          }
        }
        return null
      } catch {
        return null
      }
    })
    
    const results = await Promise.all(promises)
    const validSlides = results.filter(slide => slide !== null)
    
    // Remove duplicates based on ID
    const uniqueSlides = validSlides.reduce((acc: VirtualSlide[], slide: any) => {
      if (!acc.find(s => s.id === slide.id)) {
        acc.push({
          id: slide.id,
          repository: slide.repository,
          category: slide.category,
          subcategory: slide.subcategory,
          diagnosis: slide.diagnosis,
          patient_info: slide.patient_info,
          age: slide.age,
          gender: slide.gender,
          clinical_history: slide.clinical_history,
          stain_type: slide.stain_type,
          image_url: slide.image_url || slide.slide_url || slide.case_url,
          slide_url: slide.slide_url,
          case_url: slide.case_url,
          thumbnail_url: slide.thumbnail_url || slide.preview_image_url,
          preview_image_url: slide.preview_image_url,
          magnification: slide.magnification,
          organ_system: slide.organ_system,
          difficulty_level: slide.difficulty_level,
          keywords: slide.keywords || [],
          other_urls: slide.other_urls || [],
          source_metadata: slide.source_metadata || {},
          created_at: slide.created_at,
          updated_at: slide.updated_at
        })
      }
      return acc
    }, [])
    
    const loadTime = Date.now() - startTime
    console.log(`[Client WSI] Loaded ${uniqueSlides.length} unique slides via API in ${loadTime}ms`)
    
    // Cache the data
    cachedWSIData = uniqueSlides
    cacheTimestamp = now
    
    return uniqueSlides
    
  } catch (error) {
    console.error('[Client WSI] Error loading virtual slides data:', error)
    throw new Error('Failed to load virtual slides data via API')
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