/**
 * Unified Medical Search Algorithm
 * 
 * Combines sophisticated medical term extraction from WSI Question Generator
 * with the flexibility needed for diagnostic search and other use cases.
 * 
 * Features:
 * - Advanced medical phrase recognition
 * - Abbreviation/expansion mapping
 * - Hierarchical scoring with medical intelligence
 * - Configurable thresholds for different use cases
 * - Performance optimizations with early termination
 */

export interface MedicalSearchOptions {
  // Search behavior
  searchMode: 'strict' | 'permissive' | 'hybrid'
  earlyTerminationScore?: number
  maxResults?: number
  
  // Category/context weighting
  categoryBoostMultiplier?: number
  subcategoryBoostMultiplier?: number
  
  // Quality thresholds
  minimumScore?: number
  rejectBelowScore?: number
  
  // Performance options
  enableEarlyTermination?: boolean
  logDetailedScoring?: boolean
}

export interface MedicalTerms {
  exactPhrases: string[]
  medicalTerms: string[]
  keyWords: string[]
  organSystem: string
  abbreviations: { [key: string]: string }
  synonyms: string[]
}

export interface SearchResult {
  score: number
  content: any
  filename: string
  lesson: string
  topic: string
  matchDetails: {
    exactMatches: string[]
    medicalTermMatches: string[]
    keywordMatches: string[]
    categoryMatches: string[]
  }
}

export interface UnifiedSearchMetadata {
  searchTime: number
  totalMatches: number
  filesSearched: number
  earlyTermination: boolean
  scoringMethod: string
  qualityAssessment: 'excellent' | 'good' | 'fair' | 'poor' | 'none'
}

/**
 * Enhanced medical abbreviation mappings
 */
const MEDICAL_ABBREVIATIONS: { [key: string]: string } = {
  // Hematology/Oncology
  'cll': 'chronic lymphocytic leukemia',
  'aml': 'acute myeloid leukemia',
  'all': 'acute lymphoblastic leukemia',
  'cml': 'chronic myeloid leukemia',
  'dlbcl': 'diffuse large b cell lymphoma',
  'fl': 'follicular lymphoma',
  'hl': 'hodgkin lymphoma',
  'nhl': 'non hodgkin lymphoma',
  'mm': 'multiple myeloma',
  
  // Breast pathology
  'dcis': 'ductal carcinoma in situ',
  'lcis': 'lobular carcinoma in situ',
  'idc': 'invasive ductal carcinoma',
  'ilc': 'invasive lobular carcinoma',
  'adh': 'atypical ductal hyperplasia',
  'alh': 'atypical lobular hyperplasia',
  
  // Gastrointestinal
  'hcc': 'hepatocellular carcinoma',
  'crc': 'colorectal carcinoma',
  'gist': 'gastrointestinal stromal tumor',
  'ibd': 'inflammatory bowel disease',
  'fap': 'familial adenomatous polyposis',
  
  // Skin/Dermatopathology
  'scc': 'squamous cell carcinoma',
  'bcc': 'basal cell carcinoma',
  'ak': 'actinic keratosis',
  'sk': 'seborrheic keratosis',
  
  // Genitourinary
  'rcc': 'renal cell carcinoma',
  'tcc': 'transitional cell carcinoma',
  'pin': 'prostatic intraepithelial neoplasia',
  'cin': 'cervical intraepithelial neoplasia',
  
  // General terms
  'ca': 'carcinoma',
  'adeno': 'adenocarcinoma',
  'met': 'metastatic',
  'mets': 'metastases'
}

/**
 * Medical synonym mappings for better matching
 */
const MEDICAL_SYNONYMS: { [key: string]: string[] } = {
  'carcinoma': ['cancer', 'malignancy', 'neoplasm', 'tumor'],
  'adenocarcinoma': ['glandular carcinoma', 'adenoca'],
  'lymphoma': ['lymphoid malignancy', 'lymphoid neoplasm'],
  'sarcoma': ['soft tissue tumor', 'mesenchymal tumor'],
  'melanoma': ['malignant melanoma', 'melanocytic carcinoma'],
  'hyperplasia': ['hyperplastic changes', 'increased proliferation'],
  'dysplasia': ['dysplastic changes', 'abnormal development'],
  'metaplasia': ['metaplastic changes', 'cellular transformation'],
  'inflammation': ['inflammatory changes', 'inflammatory reaction', 'inflammatory process'],
  'fibrosis': ['fibrotic changes', 'scarring', 'fibrous tissue'],
  'necrosis': ['necrotic changes', 'tissue death', 'cellular death'],
  
  // Dermatology synonyms
  'eczema': ['dermatitis', 'spongiotic dermatitis', 'atopic dermatitis', 'contact dermatitis', 'dyshidrotic', 'pompholyx'],
  'dermatitis': ['eczema', 'spongiotic', 'inflammatory skin condition'],
  'dyshidrotic': ['pompholyx', 'vesicular eczema', 'hand eczema'],
  'atopic': ['allergic', 'eczematous'],
  'psoriasis': ['psoriatic', 'plaque psoriasis'],
  'acne': ['comedonal', 'inflammatory acne', 'acne vulgaris'],
  'urticaria': ['hives', 'wheals']
}

/**
 * Organ system mappings for intelligent categorization
 */
const ORGAN_SYSTEM_MAPPINGS: { [key: string]: string[] } = {
  'genitourinary': [
    'prostatic', 'prostate', 'bladder', 'kidney', 'renal', 'ureteral', 'urethral', 
    'testicular', 'ovarian', 'uterine', 'cervical', 'glomerular', 'tubular'
  ],
  'gastrointestinal': [
    'gastric', 'stomach', 'intestinal', 'colonic', 'rectal', 'esophageal', 
    'duodenal', 'jejunal', 'ileal', 'appendiceal', 'hepatic', 'pancreatic', 'biliary'
  ],
  'breast': [
    'mammary', 'breast', 'ductal', 'lobular', 'nipple', 'areolar'
  ],
  'dermatopathology': [
    'cutaneous', 'skin', 'dermal', 'epidermal', 'melanocytic', 'keratinocytic', 
    'sebaceous', 'follicular', 'sweat gland'
  ],
  'hematopathology': [
    'lymphoid', 'lymphoma', 'leukemia', 'myeloid', 'plasma cell', 'lymphocytic', 
    'bone marrow', 'spleen', 'lymph node'
  ],
  'neuropathology': [
    'neural', 'brain', 'cerebral', 'meningeal', 'spinal', 'neuronal', 'glial'
  ],
  'bone': [
    'osseous', 'bone', 'osteoid', 'chondroid', 'cartilaginous', 'skeletal'
  ],
  'soft-tissue': [
    'muscular', 'adipose', 'fibrous', 'vascular', 'synovial', 'connective tissue'
  ],
  'gynecological': [
    'endometrial', 'cervical', 'ovarian', 'fallopian', 'vulvar', 'vaginal', 'uterine'
  ],
  'head-neck-endocrine': [
    'thyroid', 'parathyroid', 'salivary', 'laryngeal', 'pharyngeal', 'nasal', 
    'oral', 'tongue', 'pituitary', 'adrenal'
  ],
  'cardiovascular': [
    'cardiac', 'myocardial', 'pericardial', 'valvular', 'aortic', 'arterial', 
    'venous', 'vascular'
  ],
  'pancreas-biliary-liver': [
    'hepatic', 'pancreatic', 'biliary', 'gallbladder', 'cholangiocarcinoma', 
    'hepatocellular', 'ductal pancreatic'
  ]
}

/**
 * Extract comprehensive medical terms from diagnosis text
 */
export function extractMedicalTerms(diagnosis: string): MedicalTerms {
  const cleaned = diagnosis
    .replace(/\([^)]*\)/g, '') // Remove parentheses
    .replace(/\[[^\]]*\]/g, '') // Remove brackets
    .replace(/[•]/g, ' ') // Replace bullets
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .toLowerCase()

  const exactPhrases: string[] = []
  const medicalTerms: string[] = []
  const keyWords: string[] = []
  const foundAbbreviations: { [key: string]: string } = {}
  const synonyms: string[] = []

  console.log(`[Unified Medical Search] Processing: "${diagnosis}" → "${cleaned}"`)

  // 1. EXACT PHRASE MATCHING
  exactPhrases.push(cleaned)
  
  // 2. ENHANCED MEDICAL PHRASE EXTRACTION
  const medicalPhrases = extractMedicalPhrases(cleaned)
  exactPhrases.push(...medicalPhrases)
  
  // 3. ABBREVIATION PROCESSING (exact word boundaries only)
  const words = cleaned.split(/\s+/)
  for (const [abbrev, expansion] of Object.entries(MEDICAL_ABBREVIATIONS)) {
    // Check for exact word matches, not partial matches
    if (words.includes(abbrev)) {
      exactPhrases.push(expansion)
      foundAbbreviations[abbrev] = expansion
      console.log(`[Unified Medical Search] Found abbreviation "${abbrev}" → "${expansion}"`)
    }
    if (cleaned.includes(expansion)) {
      exactPhrases.push(abbrev)
      foundAbbreviations[abbrev] = expansion
      console.log(`[Unified Medical Search] Found expansion "${expansion}" → "${abbrev}"`)
    }
  }
  
  // 4. DIAGNOSTIC PATTERN NORMALIZATION
  const normalizedPhrases = normalizeDiagnosticPatterns(cleaned)
  exactPhrases.push(...normalizedPhrases)
  
  // 5. WORD ORDER VARIATIONS - Generate common reorderings
  const wordOrderVariations = generateWordOrderVariations(cleaned)
  exactPhrases.push(...wordOrderVariations)
  
  // 6. CORE MEDICAL TERM EXTRACTION
  const coreTerms = extractCoreMedicalTerms(cleaned)
  medicalTerms.push(...coreTerms)
  
  // 7. SYNONYM EXPANSION
  for (const [term, termSynonyms] of Object.entries(MEDICAL_SYNONYMS)) {
    if (cleaned.includes(term)) {
      synonyms.push(...termSynonyms)
      console.log(`[Unified Medical Search] Added synonyms for "${term}":`, termSynonyms)
    }
  }
  
  // 8. KEY DIAGNOSTIC WORDS
  const diagnosticWords = cleaned.split(/\s+/)
    .filter(word => word.length >= 4)
    .filter(word => !isGenericTerm(word))
    .filter(word => isRelevantMedicalWord(word))
  
  keyWords.push(...diagnosticWords)

  // 9. ORGAN SYSTEM IDENTIFICATION
  const organSystem = identifyOrganSystem(cleaned)

  console.log(`[Unified Medical Search] Extracted terms:`, {
    exactPhrases: exactPhrases.length,
    medicalTerms: medicalTerms.length,
    keyWords: keyWords.length,
    synonyms: synonyms.length,
    organSystem
  })

  return {
    exactPhrases: [...new Set(exactPhrases)],
    medicalTerms: [...new Set(medicalTerms)],
    keyWords: [...new Set(keyWords)],
    organSystem,
    abbreviations: foundAbbreviations,
    synonyms: [...new Set(synonyms)]
  }
}

/**
 * Extract medical phrases with enhanced pattern recognition
 */
function extractMedicalPhrases(text: string): string[] {
  const phrases: string[] = []
  
  const medicalPhrasePatterns = [
    // Specific tumor types that should be matched exactly
    /adenomatoid\s+tumor/gi,
    /phyllodes\s+tumor/gi,
    /warthin\s+tumor/gi,
    /gastrointestinal\s+stromal\s+tumor/gi,
    /pleomorphic\s+adenoma/gi,
    
    // Multi-word carcinomas, lymphomas, sarcomas with modifiers (more specific)
    /(?:atypical\s+)?(?:high\s+grade\s+|low\s+grade\s+)?(?:invasive\s+|in\s+situ\s+|metastatic\s+)?(?:ductal|lobular|follicular|papillary|squamous|basal|clear|granular|serous|mucinous|transitional|pleomorphic)\s+(?:cell\s+)?(?:carcinoma|lymphoma|sarcoma|adenoma|hyperplasia)/gi,
    
    // Specific lymphoma subtypes
    /(?:chronic\s+lymphocytic\s+leukemia|diffuse\s+large\s+b\s+cell\s+lymphoma|follicular\s+lymphoma|mantle\s+cell\s+lymphoma|marginal\s+zone\s+lymphoma|burkitt\s+lymphoma|hodgkin\s+lymphoma)/gi,
    
    // Carcinoma in situ patterns
    /(?:ductal|lobular|squamous)\s+carcinoma\s+in\s+situ/gi,
    
    // Hyperplasia and dysplasia patterns  
    /(?:atypical\s+)?(?:ductal|lobular|squamous|glandular)\s+(?:hyperplasia|dysplasia)/gi,
    
    // Organ-specific patterns
    /(?:hepatocellular|renal\s+cell|transitional\s+cell|small\s+cell|large\s+cell)\s+carcinoma/gi,
    
    // Serous and mucinous patterns
    /(?:high\s+grade\s+|low\s+grade\s+)?(?:serous|mucinous|endometrioid|clear\s+cell)\s+(?:carcinoma|adenocarcinoma|cystadenocarcinoma)/gi,
    
    // General patterns (lower priority) - be more careful here
    /(?:^|\s)(\w+)\s+(?:carcinoma|lymphoma|sarcoma|adenoma|nevus|tumor|syndrome|disease)(?=\s|$)/gi,
    /(?:^|\s)(\w+)\s+cell\s+(\w+)(?=\s|$)/gi
  ]
  
  for (const pattern of medicalPhrasePatterns) {
    const matches = text.match(pattern)
    if (matches) {
      phrases.push(...matches.map(m => m.toLowerCase().replace(/\s+/g, ' ').trim()))
    }
  }
  
  return [...new Set(phrases)]
}

/**
 * Get common organ contexts for descriptors
 */
function getOrganContextsForDescriptor(descriptor: string): string[] {
  const descriptorOrganMap: { [key: string]: string[] } = {
    'metaplastic': ['breast'],
    'ductal': ['breast', 'pancreatic'],
    'lobular': ['breast'],
    'squamous': ['lung', 'cervical', 'head', 'neck'],
    'adenoid': ['lung', 'salivary'],
    'mucinous': ['breast', 'ovarian', 'gastric'],
    'serous': ['ovarian', 'endometrial'],
    'clear': ['renal', 'ovarian'],
    'basal': ['breast'],
    'invasive': ['breast', 'cervical'],
    
    // Dermatology descriptors
    'dyshidrotic': ['contact', 'atopic', 'spongiotic'],
    'atopic': ['allergic', 'spongiotic'],
    'contact': ['allergic', 'irritant'],
    'spongiotic': ['atopic', 'contact']
  }
  
  return descriptorOrganMap[descriptor] || []
}

/**
 * Generate word order variations for medical terms
 * e.g., "breast metaplastic carcinoma" → ["metaplastic breast carcinoma", "breast metaplastic carcinoma"]
 */
function generateWordOrderVariations(text: string): string[] {
  const variations: string[] = []
  const words = text.split(/\s+/).filter(word => word.length > 0)
  
  // Only process if we have 2-4 words (avoid generating too many variations)
  if (words.length < 2 || words.length > 4) {
    return variations
  }
  
  // Common medical word order patterns
  const medicalModifiers = ['breast', 'lung', 'renal', 'hepatocellular', 'gastric', 'colonic', 'ovarian', 'cervical', 'endometrial', 'testicular', 'prostatic']
  const tumorTypes = ['carcinoma', 'adenocarcinoma', 'sarcoma', 'lymphoma', 'adenoma', 'tumor', 'neoplasm']
  const descriptors = ['metaplastic', 'invasive', 'ductal', 'lobular', 'squamous', 'adenoid', 'mucinous', 'serous', 'clear', 'basal']
  
  // Pattern: [organ] [descriptor] [tumor] → [descriptor] [organ] [tumor]
  // e.g., "breast metaplastic carcinoma" → "metaplastic breast carcinoma"
  if (words.length === 3) {
    const [word1, word2, word3] = words
    
    if (medicalModifiers.includes(word1.toLowerCase()) && 
        descriptors.includes(word2.toLowerCase()) && 
        tumorTypes.includes(word3.toLowerCase())) {
      
      variations.push(`${word2} ${word1} ${word3}`)
      console.log(`[Word Order] Generated: "${word1} ${word2} ${word3}" → "${word2} ${word1} ${word3}"`)
    }
    
    // Pattern: [descriptor] [organ] [tumor] → [organ] [descriptor] [tumor]
    // e.g., "metaplastic breast carcinoma" → "breast metaplastic carcinoma"
    if (descriptors.includes(word1.toLowerCase()) && 
        medicalModifiers.includes(word2.toLowerCase()) && 
        tumorTypes.includes(word3.toLowerCase())) {
      
      variations.push(`${word2} ${word1} ${word3}`)
      console.log(`[Word Order] Generated: "${word1} ${word2} ${word3}" → "${word2} ${word1} ${word3}"`)
    }
  }
  
  // Pattern: [descriptor] [tumor] → add common organ context expansions
  // e.g., "metaplastic carcinoma" → ["breast metaplastic carcinoma", "metaplastic breast carcinoma"]
  if (words.length === 2) {
    const [word1, word2] = words
    
    if (descriptors.includes(word1.toLowerCase()) && tumorTypes.includes(word2.toLowerCase())) {
      // Add common organ contexts for this descriptor
      const organContexts = getOrganContextsForDescriptor(word1.toLowerCase())
      
      for (const organ of organContexts) {
        variations.push(`${organ} ${word1} ${word2}`)  // breast metaplastic carcinoma
        variations.push(`${word1} ${organ} ${word2}`)  // metaplastic breast carcinoma
        console.log(`[Word Order] Context expansion: "${word1} ${word2}" → "${organ} ${word1} ${word2}" and "${word1} ${organ} ${word2}"`)
      }
    }
  }
  
  return [...new Set(variations)]
}

/**
 * Normalize common diagnostic pattern variations
 */
function normalizeDiagnosticPatterns(text: string): string[] {
  const normalized: string[] = []
  
  const patterns: { [key: string]: string } = {
    'atypical duct hyperplasia': 'atypical ductal hyperplasia',
    'duct carcinoma in-situ': 'ductal carcinoma in situ',
    'duct carcinoma in situ': 'ductal carcinoma in situ',
    'lobular carcinoma in-situ': 'lobular carcinoma in situ',
    'squamous cell ca': 'squamous cell carcinoma',
    'basal cell ca': 'basal cell carcinoma',
    'renal cell ca': 'renal cell carcinoma',
    'hepatocellular ca': 'hepatocellular carcinoma',
    'large b cell lymphoma': 'diffuse large b cell lymphoma',
    'follicle center lymphoma': 'follicular lymphoma'
  }
  
  for (const [pattern, standard] of Object.entries(patterns)) {
    if (text.includes(pattern)) {
      normalized.push(standard)
      console.log(`[Unified Medical Search] Normalized "${pattern}" → "${standard}"`)
    }
  }
  
  return normalized
}

/**
 * Extract core medical terms (entities, modifiers)
 */
function extractCoreMedicalTerms(text: string): string[] {
  const terms: string[] = []
  
  const entityPatterns = [
    // Primary pathological entities
    /(?:carcinoma|adenocarcinoma|lymphoma|sarcoma|adenoma|hyperplasia|dysplasia|metaplasia|neoplasia|melanoma|nevus|fibroma|lipoma|hemangioma|leiomyoma)/gi,
    
    // Modifiers and descriptors
    /(?:chronic|acute|invasive|metastatic|inflammatory|atypical|benign|malignant|high\s+grade|low\s+grade|well\s+differentiated|poorly\s+differentiated|moderately\s+differentiated)/gi,
    
    // Cellular descriptors
    /(?:squamous|glandular|ductal|lobular|follicular|papillary|solid|cystic|mucinous|serous|clear\s+cell|spindle\s+cell|giant\s+cell)/gi
  ]
  
  for (const pattern of entityPatterns) {
    const matches = text.match(pattern)
    if (matches) {
      terms.push(...matches.map(m => m.toLowerCase().trim().replace(/\s+/g, ' ')))
    }
  }
  
  return [...new Set(terms)]
}

/**
 * Check if a word is medically relevant
 */
function isRelevantMedicalWord(word: string): boolean {
  const medicalWords = [
    'carcinoma', 'adenocarcinoma', 'lymphoma', 'sarcoma', 'adenoma', 'melanoma', 'nevus',
    'chronic', 'acute', 'invasive', 'metastatic', 'inflammatory', 'atypical', 'benign', 'malignant',
    'ductal', 'lobular', 'follicular', 'papillary', 'squamous', 'basal', 'glandular',
    'serous', 'mucinous', 'clear', 'granular', 'small', 'large', 'giant',
    'hyperplasia', 'dysplasia', 'metaplasia', 'neoplasia', 'proliferation',
    'hepatocellular', 'cutaneous', 'primary', 'secondary', 'transitional', 'pleomorphic'
  ]
  
  return medicalWords.includes(word.toLowerCase()) || 
         word.length >= 8 || // Longer words more likely to be medical terms
         /(?:oma|itis|osis|pathy|trophy|plasia|carci|lymph|sarco)$/.test(word) // Medical suffixes
}

/**
 * Identify organ system from diagnosis text
 */
function identifyOrganSystem(diagnosis: string): string {
  for (const [system, keywords] of Object.entries(ORGAN_SYSTEM_MAPPINGS)) {
    if (keywords.some(keyword => diagnosis.includes(keyword))) {
      return system
    }
  }
  return 'general'
}

/**
 * Check if term is generic and should be filtered out
 */
function isGenericTerm(term: string): boolean {
  const genericTerms = [
    'diagnosis', 'differential', 'clinical', 'pathology', 'features', 'findings',
    'microscopic', 'macroscopic', 'treatment', 'prognosis', 'epidemiology',
    'lesion', 'tissue', 'cell', 'cells', 'tumor', 'mass', 'growth', 'disease',
    'normal', 'abnormal', 'with', 'without', 'from', 'this', 'that', 'have',
    'been', 'were', 'will', 'would', 'could', 'should', 'more', 'most',
    'some', 'many', 'very', 'much', 'also', 'other'
  ]
  return genericTerms.includes(term.toLowerCase())
}

/**
 * Calculate unified content match score with medical intelligence
 */
export function calculateUnifiedMatchScore(
  medicalTerms: MedicalTerms,
  topicName: string,
  lessonName: string,
  contentText: string,
  category?: string,
  subcategory?: string,
  options: MedicalSearchOptions = { searchMode: 'hybrid' }
): { score: number; matchDetails: SearchResult['matchDetails'] } {
  
  let totalScore = 0
  const topicLower = topicName.toLowerCase()
  const lessonLower = lessonName.toLowerCase()
  const contentLower = contentText.toLowerCase()
  
  const matchDetails: SearchResult['matchDetails'] = {
    exactMatches: [],
    medicalTermMatches: [],
    keywordMatches: [],
    categoryMatches: []
  }

  if (options.logDetailedScoring) {
    console.log(`[Unified Medical Search] Scoring: "${topicName}" / "${lessonName}"`)
  }

  // 1. PERFECT AND EXACT MATCHES (Highest Priority: 50,000-500,000 points)
  for (const phrase of medicalTerms.exactPhrases) {
    // Perfect topic name match (case insensitive)
    if (topicLower === phrase || topicLower.replace(/\s+/g, ' ').trim() === phrase.replace(/\s+/g, ' ').trim()) {
      totalScore += 1000000 // Much higher for perfect matches
      matchDetails.exactMatches.push(`PERFECT: ${phrase}`)
      if (options.logDetailedScoring) {
        console.log(`🏆 PERFECT TOPIC MATCH: "${phrase}" → +500,000`)
      }
      // Don't early return - let it accumulate more score
    }
    
    // Exact phrase contained in topic name (but not perfect match)
    else if (topicLower.includes(phrase) && phrase.length >= 6) {
      // Check for word boundary matches vs substring matches
      const isWordBoundaryMatch = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(topicLower)
      
      if (isWordBoundaryMatch) {
        // Higher bonus for word boundary matches
        const bonus = phrase.length >= 15 ? 200000 : 
                     phrase.length >= 12 ? 150000 : 
                     phrase.length >= 8 ? 100000 : 75000
        totalScore += bonus
        matchDetails.exactMatches.push(`TOPIC_WORD_BOUNDARY: ${phrase}`)
        if (options.logDetailedScoring) {
          console.log(`🎯 WORD BOUNDARY MATCH IN TOPIC: "${phrase}" → +${bonus}`)
        }
      } else if (phrase.length >= 10) {
        // Lower bonus for substring matches (only for longer phrases)
        const bonus = Math.min(phrase.length * 500, 50000)
        totalScore += bonus
        matchDetails.exactMatches.push(`TOPIC_SUBSTRING: ${phrase}`)
        if (options.logDetailedScoring) {
          console.log(`🎯 SUBSTRING MATCH IN TOPIC: "${phrase}" → +${bonus}`)
        }
      }
    }
    
    // Exact phrase in lesson name
    else if (lessonLower.includes(phrase) && phrase.length >= 6) {
      const isWordBoundaryMatch = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(lessonLower)
      
      if (isWordBoundaryMatch) {
        const bonus = phrase.length >= 15 ? 125000 : 
                     phrase.length >= 12 ? 100000 : 
                     phrase.length >= 8 ? 75000 : 50000
        totalScore += bonus
        matchDetails.exactMatches.push(`LESSON_WORD_BOUNDARY: ${phrase}`)
        if (options.logDetailedScoring) {
          console.log(`🎯 WORD BOUNDARY MATCH IN LESSON: "${phrase}" → +${bonus}`)
        }
      } else if (phrase.length >= 10) {
        const bonus = Math.min(phrase.length * 400, 40000)
        totalScore += bonus
        matchDetails.exactMatches.push(`LESSON_SUBSTRING: ${phrase}`)
        if (options.logDetailedScoring) {
          console.log(`🎯 SUBSTRING MATCH IN LESSON: "${phrase}" → +${bonus}`)
        }
      }
    }
  }

  // 2. SYNONYM MATCHES (Medium-High Priority: 15,000-80,000 points)
  for (const synonym of medicalTerms.synonyms) {
    // Check for word boundary matches in topic/lesson
    const synonymRegex = new RegExp(`\\b${synonym.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    
    if (synonymRegex.test(topicLower)) {
      totalScore += 80000 // Increased for exact synonym matches
      matchDetails.medicalTermMatches.push(`SYNONYM_TOPIC: ${synonym}`)
      if (options.logDetailedScoring) {
        console.log(`🔄 SYNONYM IN TOPIC: "${synonym}" → +80,000`)
      }
    } else if (topicLower.includes(synonym.toLowerCase())) {
      totalScore += 40000 // Partial synonym match
      matchDetails.medicalTermMatches.push(`SYNONYM_TOPIC_PARTIAL: ${synonym}`)
      if (options.logDetailedScoring) {
        console.log(`🔄 SYNONYM IN TOPIC (partial): "${synonym}" → +40,000`)
      }
    }
    
    if (synonymRegex.test(lessonLower)) {
      totalScore += 50000
      matchDetails.medicalTermMatches.push(`SYNONYM_LESSON: ${synonym}`)
      if (options.logDetailedScoring) {
        console.log(`🔄 SYNONYM IN LESSON: "${synonym}" → +50,000`)
      }
    } else if (lessonLower.includes(synonym.toLowerCase())) {
      totalScore += 25000
      matchDetails.medicalTermMatches.push(`SYNONYM_LESSON_PARTIAL: ${synonym}`)
      if (options.logDetailedScoring) {
        console.log(`🔄 SYNONYM IN LESSON (partial): "${synonym}" → +25,000`)
      }
    }
  }

  // 3. MEDICAL TERM MATCHES (High Priority: 10,000-30,000 points)
  for (const term of medicalTerms.medicalTerms) {
    if (topicLower.includes(term)) {
      totalScore += 30000
      matchDetails.medicalTermMatches.push(`TOPIC: ${term}`)
      if (options.logDetailedScoring) {
        console.log(`🔬 MEDICAL TERM IN TOPIC: "${term}" → +30,000`)
      }
    }
    if (lessonLower.includes(term)) {
      totalScore += 20000
      matchDetails.medicalTermMatches.push(`LESSON: ${term}`)
      if (options.logDetailedScoring) {
        console.log(`🔬 MEDICAL TERM IN LESSON: "${term}" → +20,000`)
      }
    }
  }

  // 4. KEYWORD MATCHES (Medium Priority: 2,000-8,000 points)
  for (const word of medicalTerms.keyWords) {
    if (topicLower.includes(word)) {
      totalScore += 8000
      matchDetails.keywordMatches.push(`TOPIC: ${word}`)
      if (options.logDetailedScoring) {
        console.log(`📝 KEYWORD IN TOPIC: "${word}" → +8,000`)
      }
    }
    if (lessonLower.includes(word)) {
      totalScore += 5000
      matchDetails.keywordMatches.push(`LESSON: ${word}`)
      if (options.logDetailedScoring) {
        console.log(`📝 KEYWORD IN LESSON: "${word}" → +5,000`)
      }
    }
  }

  // 5. CONTENT FREQUENCY SCORING (Improved Priority: 200-10,000 points)
  for (const phrase of medicalTerms.exactPhrases) {
    if (contentLower.includes(phrase)) {
      const matches = (contentLower.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      const bonus = Math.min(matches * 1000, 10000) // Increased content scoring
      totalScore += bonus
      if (options.logDetailedScoring && bonus > 0) {
        console.log(`📄 CONTENT FREQUENCY: "${phrase}" (${matches}x) → +${bonus}`)
      }
    }
  }
  
  // 5.5. SYNONYM CONTENT SCORING (Medium Priority: 500-8,000 points)
  for (const synonym of medicalTerms.synonyms) {
    if (contentLower.includes(synonym.toLowerCase())) {
      const matches = (contentLower.match(new RegExp(synonym.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
      const bonus = Math.min(matches * 800, 8000)
      totalScore += bonus
      matchDetails.medicalTermMatches.push(`SYNONYM_CONTENT: ${synonym}`)
      if (options.logDetailedScoring && bonus > 0) {
        console.log(`📄 SYNONYM IN CONTENT: "${synonym}" (${matches}x) → +${bonus}`)
      }
    }
  }

  // 6. CATEGORY/SUBCATEGORY WEIGHTING
  const categoryMultiplier = options.categoryBoostMultiplier || 2.0
  const subcategoryMultiplier = options.subcategoryBoostMultiplier || 3.0
  let categoryBonus = 0

  if (category) {
    const categoryLower = category.toLowerCase()
    if (topicLower.includes(categoryLower) || lessonLower.includes(categoryLower) || contentLower.includes(categoryLower)) {
      categoryBonus += 10000
      totalScore *= categoryMultiplier
      matchDetails.categoryMatches.push(`CATEGORY: ${category}`)
      if (options.logDetailedScoring) {
        console.log(`🏷️  CATEGORY MATCH: "${category}" → +${categoryBonus}, ${categoryMultiplier}x multiplier`)
      }
    }
  }

  if (subcategory) {
    const subcategoryLower = subcategory.toLowerCase()
    if (topicLower.includes(subcategoryLower) || lessonLower.includes(subcategoryLower) || contentLower.includes(subcategoryLower)) {
      categoryBonus += 15000
      totalScore *= subcategoryMultiplier
      matchDetails.categoryMatches.push(`SUBCATEGORY: ${subcategory}`)
      if (options.logDetailedScoring) {
        console.log(`🏷️  SUBCATEGORY MATCH: "${subcategory}" → +${categoryBonus}, ${subcategoryMultiplier}x multiplier`)
      }
    }
  }

  totalScore += categoryBonus

  // 7. ORGAN SYSTEM BONUS
  if (medicalTerms.organSystem !== 'general') {
    const organKeywords = ORGAN_SYSTEM_MAPPINGS[medicalTerms.organSystem] || []
    for (const keyword of organKeywords) {
      if (topicLower.includes(keyword) || lessonLower.includes(keyword)) {
        totalScore += 5000
        matchDetails.categoryMatches.push(`ORGAN_SYSTEM: ${keyword}`)
        if (options.logDetailedScoring) {
          console.log(`🫀 ORGAN SYSTEM MATCH: "${keyword}" → +5,000`)
        }
        break // Only count once per content
      }
    }
  }

  // 8. SEARCH MODE ADJUSTMENTS
  if (options.searchMode === 'strict') {
    // In strict mode, heavily penalize matches that don't have exact phrase matches
    if (matchDetails.exactMatches.length === 0) {
      totalScore *= 0.1 // Severely penalize non-exact matches
    }
  } else if (options.searchMode === 'permissive') {
    totalScore *= 1.2 // Boost scores in permissive mode
  }

  if (options.logDetailedScoring) {
    console.log(`📊 FINAL SCORE for "${topicName}": ${Math.round(totalScore)}`)
  }

  return { score: Math.round(totalScore), matchDetails }
}

/**
 * Assess search result quality based on score and search mode
 */
export function assessSearchQuality(
  score: number, 
  options: MedicalSearchOptions
): 'excellent' | 'good' | 'fair' | 'poor' | 'none' {
  
  const mode = options.searchMode
  
  if (mode === 'strict') {
    if (score >= 100000) return 'excellent'
    if (score >= 50000) return 'good'
    if (score >= 25000) return 'fair'
    if (score >= 10000) return 'poor'
    return 'none'
  } else if (mode === 'permissive') {
    if (score >= 50000) return 'excellent'
    if (score >= 25000) return 'good'
    if (score >= 10000) return 'fair'
    if (score >= 5000) return 'poor'
    return 'none'
  } else { // hybrid
    if (score >= 75000) return 'excellent'
    if (score >= 35000) return 'good'
    if (score >= 15000) return 'fair'
    if (score >= 7500) return 'poor'
    return 'none'
  }
}

/**
 * Check if search should reject a result based on quality thresholds
 */
export function shouldRejectResult(
  score: number,
  quality: string,
  options: MedicalSearchOptions
): boolean {
  
  if (options.rejectBelowScore && score < options.rejectBelowScore) {
    return true
  }
  
  if (options.searchMode === 'strict') {
    return quality === 'none' || quality === 'poor'
  } else if (options.searchMode === 'permissive') {
    return quality === 'none'
  } else { // hybrid
    return quality === 'none' || quality === 'poor'
  }
}

/**
 * Default search options for different use cases
 */
export const SEARCH_PRESETS: { [key: string]: MedicalSearchOptions } = {
  // For WSI Question Generator - needs high quality matches
  wsiQuestions: {
    searchMode: 'strict',
    earlyTerminationScore: 150000,
    minimumScore: 25000,
    rejectBelowScore: 15000,
    categoryBoostMultiplier: 3.0,
    subcategoryBoostMultiplier: 4.0,
    enableEarlyTermination: true,
    logDetailedScoring: false
  },
  
  // For Diagnostic Search - more permissive for broader results
  diagnosticSearch: {
    searchMode: 'hybrid',
    earlyTerminationScore: 2000000, // Much higher to ensure perfect matches are found
    minimumScore: 25000, // Increased minimum threshold
    rejectBelowScore: 10000, // Increased rejection threshold
    categoryBoostMultiplier: 2.0,
    subcategoryBoostMultiplier: 2.5,
    enableEarlyTermination: true,
    logDetailedScoring: false // Disable for production
  },
  
  // For general content search - most permissive
  general: {
    searchMode: 'permissive',
    earlyTerminationScore: 75000,
    minimumScore: 5000,
    rejectBelowScore: 1000,
    categoryBoostMultiplier: 1.5,
    subcategoryBoostMultiplier: 2.0,
    enableEarlyTermination: false,
    logDetailedScoring: false
  }
}