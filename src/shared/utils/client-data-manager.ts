/**
 * Client-side data manager for WSI metadata and educational content
 * Downloads everything directly from R2, bypassing Vercel APIs entirely
 */

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
  preview_image_url: string
  slide_url: string
  case_url: string
  other_urls: string[]
  source_metadata: Record<string, unknown>
}

interface EducationalContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

// Use direct R2 access for WSI data (same source as use-client-wsi-data.ts)
const WSI_DATA_URL = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/virtual-slides/public_wsi_cases.json'

// Direct R2 access for educational content - avoid Vercel API costs
// Hard-coded R2 data URL - this is a public, static URL that doesn't change
const EDUCATIONAL_CONTENT_BASE = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'
const EDUCATIONAL_CONTENT_API = `${EDUCATIONAL_CONTENT_BASE}/context`

// Available educational content files (~40MB total)
const CONTENT_FILES = [
  'ap-bone.json', 'ap-breast.json', 'ap-cardiovascular-and-thoracic.json',
  'ap-cytopathology.json', 'ap-dermatopathology.json', 'ap-forensics-and-autopsy.json',
  'ap-gastrointestinal.json', 'ap-general-topics.json', 'ap-genitourinary.json',
  'ap-gynecological.json', 'ap-head-and-neck---endocrine.json', 'ap-hematopathology.json',
  'ap-molecular.json', 'ap-neuropathology.json', 'ap-pancreas-biliary-liver.json',
  'ap-pediatrics.json', 'ap-soft-tissue.json', 'cp-clinical-chemistry.json',
  'cp-hematology-hemostasis-and-thrombosis.json', 'cp-hematopathology.json', 'cp-immunology.json',
  'cp-laboratory-management-and-clinical-laboratory-informatics.json',
  'cp-medical-microbiology.json', 'cp-molecular-pathology-and-cytogenetics.json',
  'cp-toxicology-body-fluids-and-special-techniques.json', 'cp-transfusion-medicine.json'
]

class ClientDataManager {
  private wsiMetadata: VirtualSlide[] | null = null
  private educationalContent: Map<string, any> = new Map()
  private loadingPromises: Map<string, Promise<any>> = new Map()
  private loadingProgress = {
    wsiMetadata: { loaded: false, size: 0, error: null as Error | null },
    contentFiles: { loaded: 0, total: CONTENT_FILES.length, errors: [] as string[] }
  }

  /**
   * Get loading progress for UI feedback
   */
  getLoadingProgress() {
    const wsiProgress = this.loadingProgress.wsiMetadata
    const contentProgress = this.loadingProgress.contentFiles
    
    return {
      wsiMetadata: {
        loaded: wsiProgress.loaded,
        sizeMB: (wsiProgress.size / (1024 * 1024)).toFixed(1),
        error: wsiProgress.error?.message
      },
      contentFiles: {
        loaded: contentProgress.loaded,
        total: contentProgress.total,
        percentage: Math.round((contentProgress.loaded / contentProgress.total) * 100),
        errors: contentProgress.errors
      },
      totalProgress: {
        loaded: (wsiProgress.loaded ? 1 : 0) + contentProgress.loaded,
        total: 1 + contentProgress.total,
        percentage: Math.round(((wsiProgress.loaded ? 1 : 0) + contentProgress.loaded) / (1 + contentProgress.total) * 100)
      }
    }
  }

  /**
   * Load WSI metadata (~8MB) - all at once
   */
  async loadWSIMetadata(): Promise<VirtualSlide[]> {
    if (this.wsiMetadata) {
      console.log('[DataManager] WSI metadata already loaded')
      return this.wsiMetadata
    }

    if (this.loadingPromises.has('wsi-metadata')) {
      console.log('[DataManager] WSI metadata loading in progress')
      return this.loadingPromises.get('wsi-metadata')!
    }

    const loadPromise = this._loadWSIMetadata()
    this.loadingPromises.set('wsi-metadata', loadPromise)
    
    try {
      const result = await loadPromise
      this.loadingPromises.delete('wsi-metadata')
      return result
    } catch (error) {
      this.loadingPromises.delete('wsi-metadata')
      throw error
    }
  }

  private async _loadWSIMetadata(): Promise<VirtualSlide[]> {
    console.log('[DataManager] 📥 Loading WSI metadata directly from R2...')
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
      const pathPresenterCases = json.cases || []
      
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
          preview_image_url: '',
          slide_url: pathCase.url,
          case_url: pathCase.url,
          other_urls: [],
          source_metadata: {
            pages: pathCase.pages,
            microscopic_features: pathCase.microscopic_features,
            other_prognostic_factors: pathCase.other_prognostic_factors,
            immuno_profile: pathCase.immuno_profile,
            molecular_profile: pathCase.molecular_profile,
            differential_diagnosis: pathCase.differential_diagnosis,
            authors: authorsArray
          }
        }
      })
      
      // Filter out any entries without valid URLs
      const data = entries.filter(slide => 
        slide.slide_url && 
        slide.slide_url.startsWith('http') && 
        !slide.slide_url.includes('localhost')
      )

      const loadTime = Date.now() - startTime
      const sizeBytes = JSON.stringify(data).length

      this.wsiMetadata = data
      this.loadingProgress.wsiMetadata = {
        loaded: true,
        size: sizeBytes,
        error: null
      }

      console.log(`[DataManager] ✅ WSI metadata loaded directly from R2: ${data.length} slides, ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB in ${loadTime}ms`)
      return data

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      this.loadingProgress.wsiMetadata.error = err
      console.error('[DataManager] ❌ Failed to load WSI metadata:', err)
      throw err
    }
  }

  /**
   * Load educational content file on-demand
   */
  async loadContentFile(filename: string): Promise<any> {
    if (this.educationalContent.has(filename)) {
      console.log(`[DataManager] Content file ${filename} already cached`)
      return this.educationalContent.get(filename)
    }

    if (this.loadingPromises.has(filename)) {
      console.log(`[DataManager] Content file ${filename} loading in progress`)
      return this.loadingPromises.get(filename)!
    }

    const loadPromise = this._loadContentFile(filename)
    this.loadingPromises.set(filename, loadPromise)
    
    try {
      const result = await loadPromise
      this.loadingPromises.delete(filename)
      return result
    } catch (error) {
      this.loadingPromises.delete(filename)
      throw error
    }
  }

  private async _loadContentFile(filename: string): Promise<any> {
    console.log(`[DataManager] 📥 Loading content file ${filename} from R2...`)
    const startTime = Date.now()

    try {
      const response = await fetch(`${EDUCATIONAL_CONTENT_API}/${filename}`, {
        cache: 'force-cache', // Aggressive browser caching
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      const loadTime = Date.now() - startTime
      const sizeKB = Math.round(JSON.stringify(data).length / 1024)

      // Cache the data
      this.educationalContent.set(filename, data)
      
      // Update progress
      this.loadingProgress.contentFiles.loaded++

      console.log(`[DataManager] ✅ Content file ${filename} loaded: ${sizeKB}KB in ${loadTime}ms`)
      return data

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      this.loadingProgress.contentFiles.errors.push(`${filename}: ${err.message}`)
      console.error(`[DataManager] ❌ Failed to load ${filename}:`, err)
      throw err
    }
  }

  /**
   * Preload all content files (smart chunking - only if not already loaded)
   */
  async preloadAllContent(onProgress?: (progress: any) => void): Promise<void> {
    console.log('[DataManager] 🚀 Starting content preload...')
    
    const loadPromises = CONTENT_FILES.map(async (filename) => {
      try {
        await this.loadContentFile(filename)
        if (onProgress) {
          onProgress(this.getLoadingProgress())
        }
      } catch {
        console.warn(`[DataManager] ⚠️ Failed to preload ${filename}, will load on-demand`)
      }
    })

    await Promise.allSettled(loadPromises)
    console.log('[DataManager] ✅ Content preload completed')
  }

  /**
   * Get random WSI sample for testing
   */
  async getRandomWSISample(size: number): Promise<VirtualSlide[]> {
    const allSlides = await this.loadWSIMetadata()
    const shuffled = [...allSlides].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, size)
  }

  /**
   * Search WSIs by criteria
   */
  async searchWSIs(criteria: {
    category?: string
    subcategory?: string
    diagnosis?: string
    repository?: string
    limit?: number
  }): Promise<VirtualSlide[]> {
    const allSlides = await this.loadWSIMetadata()
    
    let filtered = allSlides
    
    if (criteria.category) {
      const categoryLower = criteria.category.toLowerCase()
      filtered = filtered.filter(slide => 
        slide.category.toLowerCase().includes(categoryLower)
      )
    }
    
    if (criteria.subcategory) {
      const subcategoryLower = criteria.subcategory.toLowerCase()
      filtered = filtered.filter(slide => 
        slide.subcategory.toLowerCase().includes(subcategoryLower)
      )
    }
    
    if (criteria.diagnosis) {
      const diagnosisLower = criteria.diagnosis.toLowerCase()
      filtered = filtered.filter(slide => 
        slide.diagnosis.toLowerCase().includes(diagnosisLower)
      )
    }
    
    if (criteria.repository) {
      filtered = filtered.filter(slide => 
        slide.repository === criteria.repository
      )
    }
    
    if (criteria.limit) {
      filtered = filtered.slice(0, criteria.limit)
    }
    
    return filtered
  }



  /**
   * Clear all cached data (for memory management)
   */
  clearCache() {
    console.log('[DataManager] 🗑️ Clearing all cached data...')
    this.wsiMetadata = null
    this.educationalContent.clear()
    this.loadingPromises.clear()
    this.loadingProgress = {
      wsiMetadata: { loaded: false, size: 0, error: null },
      contentFiles: { loaded: 0, total: CONTENT_FILES.length, errors: [] }
    }
    console.log('[DataManager] ✅ Cache cleared')
  }

  /**
   * Initialize with progressive loading
   */
  async initialize(options: {
    loadWSIMetadata?: boolean
    preloadContent?: boolean
    onProgress?: (progress: any) => void
  } = {}): Promise<void> {
    const { loadWSIMetadata = true, preloadContent = false, onProgress } = options

    console.log('[DataManager] 🚀 Initializing client data manager...')

    // Step 1: Load WSI metadata first (small, fast)
    if (loadWSIMetadata) {
      await this.loadWSIMetadata()
      if (onProgress) onProgress(this.getLoadingProgress())
    }

    // Step 2: Preload content files (larger, optional)
    if (preloadContent) {
      await this.preloadAllContent(onProgress)
    }

    console.log('[DataManager] ✅ Initialization complete')
  }

  /**
   * Get files needed for a specific search (intelligent targeting)
   */
  getTargetedFiles(category: string, subcategory: string): string[] {
    const primaryFiles: string[] = []
    const secondaryFiles: string[] = []

    const categoryLower = category.toLowerCase()
    const subcategoryLower = subcategory.toLowerCase()

    // PRIMARY: Direct subcategory mapping
    if (subcategoryLower.includes('hematopathology') || subcategoryLower.includes('blood') || subcategoryLower.includes('lymph')) {
      primaryFiles.push('ap-hematopathology.json', 'cp-hematopathology.json')
    } else if (subcategoryLower.includes('breast')) {
      primaryFiles.push('ap-breast.json')
    } else if (subcategoryLower.includes('skin') || subcategoryLower.includes('dermat')) {
      primaryFiles.push('ap-dermatopathology.json')
    } else if (subcategoryLower.includes('bone')) {
      primaryFiles.push('ap-bone.json')
    } else if (subcategoryLower.includes('soft tissue')) {
      primaryFiles.push('ap-soft-tissue.json')
    } else if (subcategoryLower.includes('gynecolog') || subcategoryLower.includes('cervix') || subcategoryLower.includes('ovary')) {
      primaryFiles.push('ap-gynecological.json')
    } else if (subcategoryLower.includes('genitourinary') || subcategoryLower.includes('kidney') || subcategoryLower.includes('prostate')) {
      primaryFiles.push('ap-genitourinary.json')
    } else if (subcategoryLower.includes('gastrointestinal') || subcategoryLower.includes('stomach') || subcategoryLower.includes('colon')) {
      primaryFiles.push('ap-gastrointestinal.json')
    } else if (subcategoryLower.includes('head') || subcategoryLower.includes('neck') || subcategoryLower.includes('thyroid')) {
      primaryFiles.push('ap-head-and-neck---endocrine.json')
    } else if (subcategoryLower.includes('liver') || subcategoryLower.includes('pancrea') || subcategoryLower.includes('biliary')) {
      primaryFiles.push('ap-pancreas-biliary-liver.json')
    } else if (subcategoryLower.includes('neuro') || subcategoryLower.includes('brain')) {
      primaryFiles.push('ap-neuropathology.json')
    } else if (subcategoryLower.includes('cardiovascular') || subcategoryLower.includes('heart')) {
      primaryFiles.push('ap-cardiovascular-and-thoracic.json')
    }

    // SECONDARY: Category-based mapping
    if (primaryFiles.length === 0) {
      if (categoryLower.includes('breast')) {
        secondaryFiles.push('ap-breast.json')
      } else if (categoryLower.includes('dermatopathology')) {
        secondaryFiles.push('ap-dermatopathology.json')
      } else if (categoryLower.includes('hematopathology')) {
        secondaryFiles.push('ap-hematopathology.json', 'cp-hematopathology.json')
      } else if (categoryLower.includes('gastrointestinal')) {
        secondaryFiles.push('ap-gastrointestinal.json')
      } else if (categoryLower.includes('genitourinary')) {
        secondaryFiles.push('ap-genitourinary.json')
      } else if (categoryLower.includes('gynecological')) {
        secondaryFiles.push('ap-gynecological.json')
      } else if (categoryLower.includes('bone') || categoryLower.includes('soft tissue')) {
        secondaryFiles.push('ap-bone.json', 'ap-soft-tissue.json')
      } else if (categoryLower.includes('neuropathology')) {
        secondaryFiles.push('ap-neuropathology.json')
      } else if (categoryLower.includes('cardiovascular')) {
        secondaryFiles.push('ap-cardiovascular-and-thoracic.json')
      } else if (categoryLower.includes('head') || categoryLower.includes('neck')) {
        secondaryFiles.push('ap-head-and-neck---endocrine.json')
      } else if (categoryLower.includes('pancreas') || categoryLower.includes('liver')) {
        secondaryFiles.push('ap-pancreas-biliary-liver.json')
      }
    }

    return [...primaryFiles, ...secondaryFiles].slice(0, 2) // Limit to top 2 files for efficiency
  }
}

// Export singleton instance
export const dataManager = new ClientDataManager()
export type { VirtualSlide, EducationalContent }