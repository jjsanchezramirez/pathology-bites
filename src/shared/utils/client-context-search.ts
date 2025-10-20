// Client-side context search to reduce Vercel API calls

interface EducationalContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

interface ContextSearchResult {
  success: boolean
  context?: EducationalContent
  shouldReject: boolean
  metadata: {
    searched_at: string
    search_time_ms: number
    diagnosis: string
    category?: string
    subcategory?: string
    context_found: boolean
    context_quality: string
    files_searched: number
    client_side: true
  }
}

// Cache for educational content files
const contentCache = new Map<string, any>()
const cacheTimestamps = new Map<string, number>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

// Available educational content files (matching server-side logic)
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

/**
 * Load educational content file with caching
 */
async function loadContentFile(filename: string): Promise<any> {
  const now = Date.now()
  const cacheKey = filename
  
  // Check cache first
  if (contentCache.has(cacheKey)) {
    const cacheTime = cacheTimestamps.get(cacheKey) || 0
    if ((now - cacheTime) < CACHE_TTL) {
      console.log(`[Client Context] Using cached ${filename}`)
      return contentCache.get(cacheKey)
    }
  }
  
  console.log(`[Client Context] Loading ${filename}...`)
  const startTime = Date.now()
  
  try {
    // Use direct R2 access to avoid Vercel API costs
    // Hard-coded R2 data URL - this is a public, static URL that doesn't change
    const EDUCATIONAL_CONTENT_BASE = 'https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev'

    const response = await fetch(`${EDUCATIONAL_CONTENT_BASE}/context/${filename}`, {
      cache: 'force-cache', // Aggressive browser caching
      headers: {
        'Accept': 'application/json'
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status}`)
    }
    
    const data = await response.json()
    const loadTime = Date.now() - startTime
    console.log(`[Client Context] Loaded ${filename} (${Math.round(JSON.stringify(data).length / 1024)}KB) in ${loadTime}ms`)
    
    // Cache the data
    contentCache.set(cacheKey, data)
    cacheTimestamps.set(cacheKey, now)
    
    return data
    
  } catch (error) {
    console.error(`[Client Context] Error loading ${filename}:`, error)
    throw error
  }
}

/**
 * Extract diagnostic terms with medical context awareness (from server logic)
 */
function extractDiagnosticTerms(diagnosis: string): { 
  primaryTerms: string[]
  secondaryTerms: string[]
  organSystem: string
  wholePhrases: string[]
} {
  // Clean the diagnosis
  const cleaned = diagnosis
    .replace(/\([^)]*\)/g, '') // Remove content in parentheses
    .replace(/\[[^\]]*\]/g, '') // Remove content in brackets
    .replace(/[^\w\s-]/g, ' ') // Remove punctuation except hyphens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase()

  const primaryTerms: string[] = []
  const secondaryTerms: string[] = []
  const wholePhrases: string[] = []

  // Add the full cleaned diagnosis as the most important term
  if (cleaned.length >= 5) {
    primaryTerms.push(cleaned)
    wholePhrases.push(cleaned)
  }

  // Extract important medical phrases
  const importantPhrases = extractImportantMedicalPhrases(cleaned)
  for (const phrase of importantPhrases) {
    if (phrase !== cleaned) {
      primaryTerms.push(phrase)
      wholePhrases.push(phrase)
    }
  }

  // Split on common separators for alternative terms
  const separators = [',', ';', '/', ' and ', ' or ', ' with ', ' versus ', ' vs ']
  let parts = [cleaned]

  for (const sep of separators) {
    const newParts: string[] = []
    for (const part of parts) {
      newParts.push(...part.split(sep).map(p => p.trim()).filter(p => p.length > 0))
    }
    parts = newParts
  }

  // Process each part
  for (const part of parts) {
    if (part.length >= 5 && part !== cleaned) {
      if (isSpecificPathologicalEntity(part)) {
        primaryTerms.push(part)
        wholePhrases.push(part)
      } else {
        secondaryTerms.push(part)
      }

      // Add individual significant words as secondary terms
      const words = part.split(/\s+/).filter(w => w.length >= 4 && !isGenericTerm(w))
      secondaryTerms.push(...words)
    }
  }

  const organSystem = identifyOrganSystem(cleaned)

  return {
    primaryTerms: [...new Set(primaryTerms)],
    secondaryTerms: [...new Set(secondaryTerms)],
    organSystem,
    wholePhrases: [...new Set(wholePhrases)]
  }
}

/**
 * Extract important medical phrases (from server logic)
 */
function extractImportantMedicalPhrases(text: string): string[] {
  const phrases: string[] = []
  
  const medicalPhrasePatterns = [
    /\w+\s+(?:carcinoma|lymphoma|sarcoma|adenoma|nevus|tumor|syndrome|disease|cell|tattoo)/gi,
    /\w+\s+\w+\s+(?:carcinoma|lymphoma|sarcoma|adenoma|nevus|tumor|syndrome|disease)/gi,
    /\w+\s+\w+\s+\w+\s+(?:carcinoma|lymphoma|sarcoma|adenoma|nevus|tumor|syndrome|disease)/gi,
    /(?:invasive|ductal|lobular|follicular|papillary|squamous|basal|clear|granular|deep|penetrating|blue|compound|junctional|intradermal|dysplastic|metaplastic|inflammatory|anaplastic|marginal|diffuse|large|small|peripheral|cutaneous|hepatosplenic)\s+\w+(?:\s+\w+)?/gi,
    /\w+\s+cell\s+\w+/gi,
    /\w+(?:oma|osis|itis|pathy|plasia|trophy|sclerosis|fibrosis|genesis|lysis)/gi
  ]
  
  for (const pattern of medicalPhrasePatterns) {
    const matches = text.match(pattern)
    if (matches) {
      phrases.push(...matches.map(m => m.toLowerCase().replace(/\s+/g, ' ').trim()))
    }
  }
  
  // Extract multi-word sequences without stopwords
  const words = text.toLowerCase().split(/\s+/)
  const stopwords = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'])
  
  for (let i = 0; i < words.length - 1; i++) {
    for (let len = 2; len <= Math.min(4, words.length - i); len++) {
      const sequence = words.slice(i, i + len)
      if (sequence.every(word => word.length >= 3 && !stopwords.has(word))) {
        const phrase = sequence.join(' ')
        if (phrase.length >= 6) {
          phrases.push(phrase)
        }
      }
    }
  }
  
  return [...new Set(phrases)]
}

/**
 * Helper functions from server logic
 */
function isSpecificPathologicalEntity(term: string): boolean {
  const specificEntities = [
    'carcinoma', 'adenocarcinoma', 'sarcoma', 'lymphoma', 'melanoma', 'meningioma',
    'hyperplasia', 'hypertrophy', 'dysplasia', 'metaplasia', 'neoplasia',
    'adenoma', 'papilloma', 'fibroma', 'lipoma', 'hemangioma',
    'inflammation', 'fibrosis', 'sclerosis', 'atrophy', 'infarction'
  ]
  return specificEntities.some(entity => term.includes(entity))
}

function isGenericTerm(term: string): boolean {
  const genericTerms = [
    'diagnosis', 'differential', 'clinical', 'pathology', 'features', 'findings',
    'microscopic', 'macroscopic', 'treatment', 'prognosis', 'epidemiology',
    'lesion', 'tissue', 'cell', 'cells', 'tumor', 'mass', 'growth', 'disease',
    'benign', 'malignant', 'normal', 'abnormal', 'chronic', 'acute'
  ]
  return genericTerms.includes(term.toLowerCase())
}

function identifyOrganSystem(diagnosis: string): string {
  const organMappings = {
    'genitourinary': ['prostatic', 'prostate', 'bladder', 'kidney', 'renal', 'ureteral', 'urethral', 'testicular', 'ovarian', 'uterine', 'cervical'],
    'gastrointestinal': ['gastric', 'stomach', 'intestinal', 'colonic', 'rectal', 'esophageal', 'duodenal', 'jejunal', 'ileal', 'appendiceal'],
    'breast': ['mammary', 'breast', 'ductal', 'lobular'],
    'dermatopathology': ['cutaneous', 'skin', 'dermal', 'epidermal', 'melanocytic'],
    'hematopathology': ['lymphoid', 'lymphoma', 'leukemia', 'myeloid', 'plasma cell', 'lymphocytic'],
    'neuropathology': ['neural', 'brain', 'cerebral', 'meningeal', 'spinal'],
    'bone': ['osseous', 'bone', 'osteoid', 'chondroid', 'cartilaginous'],
    'soft-tissue': ['muscular', 'adipose', 'fibrous', 'vascular', 'synovial'],
    'gynecological': ['endometrial', 'cervical', 'ovarian', 'fallopian', 'vulvar', 'vaginal'],
    'head-neck-endocrine': ['thyroid', 'parathyroid', 'salivary', 'laryngeal', 'pharyngeal', 'nasal'],
    'cardiovascular': ['cardiac', 'myocardial', 'pericardial', 'valvular', 'aortic', 'arterial'],
    'pancreas-biliary-liver': ['hepatic', 'pancreatic', 'biliary', 'gallbladder', 'cholangiocarcinoma']
  }

  for (const [system, keywords] of Object.entries(organMappings)) {
    if (keywords.some(keyword => diagnosis.includes(keyword))) {
      return system
    }
  }

  return 'general'
}

/**
 * Get targeted files based on category/subcategory (from server logic)
 */
function getTargetedFiles(category: string, subcategory: string, diagnosis: string): string[] {
  const allFiles = CONTENT_FILES
  const primaryFiles: string[] = []
  const secondaryFiles: string[] = []
  const fallbackFiles: string[] = []

  const categoryLower = category.toLowerCase()
  const subcategoryLower = subcategory.toLowerCase()
  const diagnosisLower = diagnosis.toLowerCase()

  // PRIMARY SEARCH: Direct subcategory mapping
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

  // SECONDARY SEARCH: Category-based mapping if subcategory didn't match
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

  // Return top 2 files to limit API calls (matching server optimization)
  const finalOrder = [...primaryFiles, ...secondaryFiles, ...fallbackFiles]
  return finalOrder.slice(0, 2)
}

/**
 * Calculate phrase matching score (from server logic)
 */
function calculatePhraseMatching(diagnosis: string, fullContentText: string, topicName: string, lessonName: string, wholePhrases: string[]): number {
  let phraseScore = 0
  
  const diagnosisPhrasesToCheck = [diagnosis, ...wholePhrases].filter(p => p.length >= 5)
  
  for (const phrase of diagnosisPhrasesToCheck) {
    // EXACT phrase matching with word boundaries - much more strict
    const phraseRegex = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    
    // Check for exact phrase match in topic title (HIGHEST PRIORITY)
    if (phraseRegex.test(topicName.toLowerCase())) {
      const bonus = phrase === diagnosis ? 15000 : 12000  // MASSIVE bonus for exact match
      phraseScore += bonus
      console.log(`[Client Context] 🎯 EXACT PHRASE MATCH in topic: "${phrase}" -> +${bonus}`)
    }
    
    // Check for exact phrase match in lesson name  
    if (phraseRegex.test(lessonName.toLowerCase())) {
      const bonus = phrase === diagnosis ? 12000 : 9000
      phraseScore += bonus
      console.log(`[Client Context] 🎯 EXACT PHRASE MATCH in lesson: "${phrase}" -> +${bonus}`)
    }
    
    // Check for exact phrase match in content
    if (phraseRegex.test(fullContentText)) {
      const bonus = phrase === diagnosis ? 10000 : 7000
      phraseScore += bonus
      console.log(`[Client Context] 🎯 EXACT PHRASE MATCH in content: "${phrase}" -> +${bonus}`)
    }
    
    // Check for partial phrase matches (contains phrase but not exact word boundary)
    if (topicName.toLowerCase().includes(phrase) && !phraseRegex.test(topicName.toLowerCase())) {
      phraseScore += 2000  // Lower bonus for partial match
      console.log(`[Client Context] Partial phrase match in topic: "${phrase}" -> +2000`)
    }
    
    if (lessonName.toLowerCase().includes(phrase) && !phraseRegex.test(lessonName.toLowerCase())) {
      phraseScore += 1500
      console.log(`[Client Context] Partial phrase match in lesson: "${phrase}" -> +1500`)
    }
    
    if (fullContentText.includes(phrase) && !phraseRegex.test(fullContentText)) {
      phraseScore += 1000
      console.log(`[Client Context] Partial phrase match in content: "${phrase}" -> +1000`)
    }
  }
  
  // Additional scoring for multi-word exact diagnostic matches
  const diagnosticWords = diagnosis.split(/\s+/).filter(w => w.length > 3)
  if (diagnosticWords.length >= 2) {
    // Check if multiple diagnostic words appear together in order
    for (let i = 0; i < diagnosticWords.length - 1; i++) {
      const wordPair = `${diagnosticWords[i]} ${diagnosticWords[i + 1]}`
      const wordPairRegex = new RegExp(`\\b${wordPair.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      
      if (wordPairRegex.test(topicName.toLowerCase())) {
        phraseScore += 3000
        console.log(`[Client Context] Diagnostic word pair in topic: "${wordPair}" -> +3000`)
      }
      if (wordPairRegex.test(lessonName.toLowerCase())) {
        phraseScore += 2000
        console.log(`[Client Context] Diagnostic word pair in lesson: "${wordPair}" -> +2000`)
      }
      if (wordPairRegex.test(fullContentText)) {
        phraseScore += 1500
        console.log(`[Client Context] Diagnostic word pair in content: "${wordPair}" -> +1500`)
      }
    }
  }
  
  return phraseScore
}

/**
 * Calculate full text score (simplified from server logic)
 */
function calculateFullTextScore(
  diagnosticTerms: { primaryTerms: string[], secondaryTerms: string[], organSystem: string, wholePhrases: string[] },
  topicName: string,
  lessonName: string,
  fullContentText: string
): number {
  const diagnosis = diagnosticTerms.primaryTerms[0]?.toLowerCase() || ''
  
  let totalScore = 0
  
  // 1. PHRASE MATCHING (highest priority)
  const phraseScore = calculatePhraseMatching(diagnosis, fullContentText, topicName, lessonName, diagnosticTerms.wholePhrases)
  totalScore += phraseScore
  
  // 2. Simple term frequency scoring
  const allTerms = [...diagnosticTerms.primaryTerms, ...diagnosticTerms.secondaryTerms]
  const cleanTerms = allTerms.filter(term => term.length > 3 && !isGenericTerm(term.toLowerCase()))
  
  for (const term of cleanTerms) {
    const termLower = term.toLowerCase()
    const isPrimary = diagnosticTerms.primaryTerms.some(pt => pt.toLowerCase() === termLower)
    
    // Count occurrences in different locations
    if (topicName.toLowerCase().includes(termLower)) {
      totalScore += isPrimary ? 1000 : 300
    }
    if (lessonName.toLowerCase().includes(termLower)) {
      totalScore += isPrimary ? 400 : 100
    }
    
    // Count occurrences in content
    const regex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const matches = fullContentText.match(regex)
    if (matches) {
      totalScore += matches.length * (isPrimary ? 50 : 25)
    }
  }
  
  return Math.max(totalScore, 0)
}

/**
 * Main client-side context search function
 */
export async function findContextClientSide(
  diagnosis: string,
  category?: string,
  subcategory?: string
): Promise<ContextSearchResult> {
  const startTime = Date.now()
  
  try {
    console.log(`[Client Context] Starting context search for: ${diagnosis}`)
    console.log(`[Client Context] Category: ${category || 'Not specified'}, Subcategory: ${subcategory || 'Not specified'}`)

    // Extract diagnostic terms
    const diagnosticTerms = extractDiagnosticTerms(diagnosis)
    console.log(`[Client Context] Primary terms: ${diagnosticTerms.primaryTerms.join(', ')}`)

    // Get targeted files
    const targetFiles = getTargetedFiles(category || '', subcategory || '', diagnosis)
    console.log(`[Client Context] Will search ${targetFiles.length} files: ${targetFiles.join(', ')}`)

    let bestMatch: { content: EducationalContent; score: number; filename: string; lesson: string; topic: string } | null = null
    let filesSearched = 0

    // Search through targeted files
    for (const filename of targetFiles) {
      try {
        const data = await loadContentFile(filename)
        
        if (!data || !data.subject || !data.subject.lessons) {
          console.warn(`[Client Context] Invalid data structure in ${filename}`)
          continue
        }

        filesSearched++
        
        // Search through all content in this file
        for (const [lessonName, lessonData] of Object.entries(data.subject.lessons)) {
          if (lessonData && typeof lessonData === 'object' && 'topics' in lessonData) {
            const topics = (lessonData as any).topics
            
            for (const [topicName, topicData] of Object.entries(topics)) {
              if (topicData && typeof topicData === 'object' && 'content' in topicData) {
                // Get the full content text for searching
                const fullContentText = JSON.stringify((topicData as any).content).toLowerCase()
                const topicNameLower = topicName.toLowerCase()
                const lessonNameLower = lessonName.toLowerCase()
                
                // Calculate content-based score 
                let score = calculateFullTextScore(diagnosticTerms, topicNameLower, lessonNameLower, fullContentText)
                
                // DRAMATICALLY INCREASED category/subcategory weighting - make this a primary filter
                let categoryMultiplier = 1.0
                let categoryBonus = 0
                
                if (category) {
                  const categoryLower = category.toLowerCase()
                  if (topicNameLower.includes(categoryLower) || lessonNameLower.includes(categoryLower) || fullContentText.includes(categoryLower)) {
                    categoryBonus += 5000  // Massive bonus for category match
                    categoryMultiplier = 2.0  // Double the base score
                    console.log(`[Client Context] STRONG category match: "${categoryLower}" -> +${categoryBonus} and 2x multiplier`)
                  }
                }
                
                if (subcategory) {
                  const subcategoryLower = subcategory.toLowerCase()
                  if (topicNameLower.includes(subcategoryLower) || lessonNameLower.includes(subcategoryLower) || fullContentText.includes(subcategoryLower)) {
                    categoryBonus += 8000  // Even higher bonus for subcategory match
                    categoryMultiplier = 3.0  // Triple the base score
                    console.log(`[Client Context] STRONG subcategory match: "${subcategoryLower}" -> +${categoryBonus} and 3x multiplier`)
                  }
                }
                
                // Apply category multiplier to base score, then add bonus
                score = (score * categoryMultiplier) + categoryBonus
                
                // PENALTY for category/subcategory mismatch - be more selective
                if (category && subcategory) {
                  const categoryLower = category.toLowerCase()
                  const subcategoryLower = subcategory.toLowerCase()
                  const hasAnyCategoryMatch = topicNameLower.includes(categoryLower) || 
                                            lessonNameLower.includes(categoryLower) || 
                                            fullContentText.includes(categoryLower) ||
                                            topicNameLower.includes(subcategoryLower) || 
                                            lessonNameLower.includes(subcategoryLower) || 
                                            fullContentText.includes(subcategoryLower)
                  
                  if (!hasAnyCategoryMatch && score > 0) {
                    score = Math.max(score * 0.1, 100)  // Heavy penalty for no category/subcategory match
                    console.log(`[Client Context] No category/subcategory match penalty applied`)
                  }
                }
                
                // DIAGNOSTIC SPECIFICITY VALIDATION
                const specificityPenalty = validateDiagnosticSpecificity(diagnosis, topicName, lessonName, fullContentText)
                if (specificityPenalty > 0) {
                  score = Math.max(score - specificityPenalty, 0)
                  console.log(`[Client Context] Diagnostic specificity penalty: -${specificityPenalty}`)
                }

                if (score > 0) {
                  const content: EducationalContent = {
                    category: data.category,
                    subject: data.subject.name,
                    lesson: lessonName,
                    topic: topicName,
                    content: (topicData as any).content
                  }

                  if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { content, score, filename, lesson: lessonName, topic: topicName }
                    console.log(`[Client Context] New best match: ${filename} - ${lessonName} - ${topicName} (score: ${score})`)
                    
                    // Early termination for excellent matches (from server optimization)
                    if (score >= 8000) {
                      console.log(`[Client Context] Excellent match found (score: ${score}) - terminating search early`)
                      break
                    }
                  }
                }
              }
            }
          }
        }
        
      } catch (error) {
        console.warn(`[Client Context] Error loading ${filename}:`, error)
        continue
      }
    }

    const searchTime = Date.now() - startTime
    console.log(`[Client Context] Context search completed in ${searchTime}ms`)

    // Quality assessment with updated thresholds for improved scoring
    let shouldReject = false
    let contextQuality = 'none'
    
    if (!bestMatch) {
      console.log('[Client Context] No educational content found - recommend rejecting slide')
      shouldReject = true
    } else if (bestMatch.score < 3000) {
      console.log(`[Client Context] Very poor context match (score: ${bestMatch.score}) - rejecting slide`)
      shouldReject = true
      contextQuality = 'poor'
    } else if (bestMatch.score < 8000) {
      console.log(`[Client Context] Moderate context match (score: ${bestMatch.score}) - proceeding with caution`)
      shouldReject = false
      contextQuality = 'acceptable'
    } else if (bestMatch.score < 15000) {
      console.log(`[Client Context] Good context match (score: ${bestMatch.score}) - proceeding`)
      contextQuality = 'good'
    } else {
      console.log(`[Client Context] Excellent context match (score: ${bestMatch.score}) - high confidence match`)
      contextQuality = 'excellent'
    }

    if (bestMatch) {
      console.log(`[Client Context] Best match: ${bestMatch.topic} (${bestMatch.content.subject})`)
    }

    return {
      success: true,
      context: bestMatch?.content || undefined,
      shouldReject,
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
        diagnosis,
        category,
        subcategory,
        context_found: !!bestMatch,
        context_quality: contextQuality,
        files_searched: filesSearched,
        client_side: true
      }
    }

  } catch (error) {
    const searchTime = Date.now() - startTime
    console.error('[Client Context] Error searching context:', error)
    
    return {
      success: false,
      shouldReject: true,
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
        diagnosis,
        category,
        subcategory,
        context_found: false,
        context_quality: 'error',
        files_searched: 0,
        client_side: true
      }
    }
  }
}

/**
 * Validate diagnostic specificity - penalize mismatches between specific diagnoses and generic content
 */
function validateDiagnosticSpecificity(diagnosis: string, topicName: string, lessonName: string, fullContentText: string): number {
  const diagnosisLower = diagnosis.toLowerCase()
  const combinedContent = `${topicName.toLowerCase()} ${lessonName.toLowerCase()}`
  
  let penalty = 0
  
  // Check for highly specific diagnoses that should not match generic content
  const specificTerms = {
    'medullary thyroid carcinoma': ['medullary', 'thyroid', 'carcinoma'],
    'secretory carcinoma': ['secretory', 'carcinoma'],
    'follicular adenoma': ['follicular', 'adenoma'],
    'papillary serous carcinoma': ['papillary', 'serous', 'carcinoma'],
    'extranodal nk/t-cell lymphoma': ['extranodal', 'nk', 't-cell', 'lymphoma'],
    'congenital mesoblastic nephroma': ['congenital', 'mesoblastic', 'nephroma'],
    'gastrointestinal stromal tumor': ['gastrointestinal', 'stromal', 'tumor'],
    'recurrent pyogenic cholangitis': ['recurrent', 'pyogenic', 'cholangitis'],
    'desmoplastic fibroma': ['desmoplastic', 'fibroma']
  }
  
  // Check if diagnosis contains specific multi-word medical terms
  for (const [specificDiagnosis, requiredTerms] of Object.entries(specificTerms)) {
    if (diagnosisLower.includes(specificDiagnosis.toLowerCase())) {
      // For highly specific diagnoses, require at least 60% of key terms to be present
      const termsFound = requiredTerms.filter(term => 
        combinedContent.includes(term.toLowerCase()) || fullContentText.includes(term.toLowerCase())
      ).length
      
      const requiredPercentage = 0.6
      if (termsFound < requiredTerms.length * requiredPercentage) {
        penalty += 3000
        console.log(`[Client Context] Specific diagnosis "${specificDiagnosis}" missing key terms: ${termsFound}/${requiredTerms.length}`)
      }
    }
  }
  
  // Check for carcinoma subtype mismatches
  if (diagnosisLower.includes('carcinoma')) {
    const carcinomaSubtypes = ['medullary', 'papillary', 'follicular', 'secretory', 'ductal', 'lobular', 'squamous', 'adenocarcinoma']
    const diagnosisSubtype = carcinomaSubtypes.find(subtype => diagnosisLower.includes(subtype))
    
    if (diagnosisSubtype) {
      // If diagnosis has a specific carcinoma subtype, content should mention it or be very generic
      const contentHasSubtype = combinedContent.includes(diagnosisSubtype) || fullContentText.includes(diagnosisSubtype)
      const contentIsGeneric = combinedContent.includes('carcinoma') && 
                              !carcinomaSubtypes.some(st => st !== diagnosisSubtype && combinedContent.includes(st))
      
      if (!contentHasSubtype && !contentIsGeneric) {
        penalty += 2000
        console.log(`[Client Context] Carcinoma subtype mismatch: diagnosis has "${diagnosisSubtype}" but content doesn't`)
      }
    }
  }
  
  // Check for lymphoma subtype mismatches
  if (diagnosisLower.includes('lymphoma')) {
    const lymphomaSubtypes = ['extranodal', 'nk/t-cell', 'diffuse large b-cell', 'follicular', 'marginal zone', 'mantle cell', 'burkitt', 'hodgkin']
    const diagnosisSubtype = lymphomaSubtypes.find(subtype => diagnosisLower.includes(subtype.replace('/', '')))
    
    if (diagnosisSubtype) {
      const contentHasSubtype = combinedContent.includes(diagnosisSubtype.replace('/', '')) || 
                               fullContentText.includes(diagnosisSubtype.replace('/', ''))
      
      if (!contentHasSubtype) {
        penalty += 2500
        console.log(`[Client Context] Lymphoma subtype mismatch: diagnosis has "${diagnosisSubtype}" but content doesn't`)
      }
    }
  }
  
  // Organ-specific mismatch penalty
  const organMismatches = {
    'thyroid': ['breast', 'colon', 'lung', 'prostate', 'kidney'],
    'salivary': ['thyroid', 'breast', 'colon', 'lung'],
    'ovarian': ['breast', 'colon', 'thyroid', 'lung'],
    'nephroma': ['carcinoma', 'sarcoma', 'adenoma'],
    'cholangitis': ['pneumonia', 'arthritis', 'dermatitis']
  }
  
  for (const [organTerm, conflictingTerms] of Object.entries(organMismatches)) {
    if (diagnosisLower.includes(organTerm)) {
      for (const conflictTerm of conflictingTerms) {
        if (combinedContent.includes(conflictTerm) || fullContentText.includes(conflictTerm)) {
          penalty += 1500
          console.log(`[Client Context] Organ system mismatch: diagnosis has "${organTerm}" but content mentions "${conflictTerm}"`)
          break // Only penalize once per organ system
        }
      }
    }
  }
  
  return penalty
}

/**
 * Clear educational content cache
 */
export function clearContextCache(): void {
  contentCache.clear()
  cacheTimestamps.clear()
  console.log('[Client Context] Educational content cache cleared')
}



/**
 * Warm up the educational content cache by pre-loading most common files
 * Call this on app initialization for better user experience
 */
export async function warmUpContextCache(): Promise<void> {
  // Pre-load the most commonly used educational content files for better performance
  const commonFiles = [
    'ap-hematopathology.json',
    'ap-general-topics.json',
    'ap-dermatopathology.json',
    'ap-gastrointestinal.json',
    'ap-breast.json'
  ]
  
  console.log('[Client Context] Warming up cache for common files...')
  
  const loadPromises = commonFiles.map(async (filename) => {
    try {
      await loadContentFile(filename)
      console.log(`[Client Context] Warmed up ${filename}`)
    } catch (error) {
      console.warn(`[Client Context] Failed to warm up ${filename}:`, error)
    }
  })
  
  await Promise.allSettled(loadPromises)
  console.log('[Client Context] Cache warm-up completed')
}