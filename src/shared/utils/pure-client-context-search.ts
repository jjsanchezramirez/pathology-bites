/**
 * Pure client-side context search - ZERO Vercel API calls
 * Downloads everything directly from R2 and processes client-side
 */

import { dataManager, type EducationalContent } from './client-data-manager'

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
    cache_hits: number
    network_requests: number
  }
}

/**
 * REWRITTEN: Extract diagnostic terms with precise medical phrase recognition
 */
function extractDiagnosticTerms(diagnosis: string): { 
  exactPhrases: string[]
  medicalTerms: string[]
  keyWords: string[]
  organSystem: string
} {
  // Clean but preserve important medical punctuation
  let cleaned = diagnosis
    .replace(/\([^)]*\)/g, '') // Remove parentheses
    .replace(/\[[^\]]*\]/g, '') // Remove brackets
    .replace(/[•]/g, ' ') // Replace bullets with spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
    .toLowerCase()

  console.log(`[Enhanced Search] Original: "${diagnosis}" → Cleaned: "${cleaned}"`)

  const exactPhrases: string[] = []
  const medicalTerms: string[] = []
  const keyWords: string[] = []

  // 1. EXACT PHRASE MATCHING - Highest Priority
  exactPhrases.push(cleaned) // Always include full diagnosis
  
  // 2. ENHANCED MEDICAL PHRASE EXTRACTION
  const medicalPhrases = extractEnhancedMedicalPhrases(cleaned)
  exactPhrases.push(...medicalPhrases)
  
  // 3. COMMON MEDICAL ABBREVIATIONS AND EXPANSIONS
  const abbreviationMap = {
    'cll': 'chronic lymphocytic leukemia',
    'dcis': 'ductal carcinoma in situ', 
    'adh': 'atypical ductal hyperplasia',
    'hcc': 'hepatocellular carcinoma',
    'scc': 'squamous cell carcinoma',
    'bcc': 'basal cell carcinoma',
    'dlbcl': 'diffuse large b cell lymphoma'
  }
  
  // Add specific phrase mappings for common diagnostic patterns
  const diagnosticMappings = {
    'atypical duct hyperplasia': 'atypical ductal hyperplasia',
    'duct carcinoma in-situ': 'ductal carcinoma in situ',
    'duct carcinoma in situ': 'ductal carcinoma in situ'
  }
  
  // Apply diagnostic mappings
  for (const [pattern, standard] of Object.entries(diagnosticMappings)) {
    if (cleaned.includes(pattern)) {
      exactPhrases.push(standard)
      console.log(`[Enhanced Search] Found pattern "${pattern}" → Added "${standard}"`)
    }
  }
  
  // Check for abbreviations and add expansions
  for (const [abbrev, expansion] of Object.entries(abbreviationMap)) {
    if (cleaned.includes(abbrev)) {
      exactPhrases.push(expansion)
      console.log(`[Enhanced Search] Found abbreviation "${abbrev}" → Added "${expansion}"`)
    }
  }
  
  // Check for full terms and add abbreviations
  for (const [abbrev, expansion] of Object.entries(abbreviationMap)) {
    if (cleaned.includes(expansion)) {
      exactPhrases.push(abbrev)
      console.log(`[Enhanced Search] Found expansion "${expansion}" → Added "${abbrev}"`)
    }
  }

  // 4. EXTRACT CORE MEDICAL TERMS
  const coreTerms = extractCoreMedicalTerms(cleaned)
  medicalTerms.push(...coreTerms)
  
  // 5. EXTRACT KEY DIAGNOSTIC WORDS
  const diagnosticWords = cleaned.split(/\s+/)
    .filter(word => word.length >= 4)
    .filter(word => !isGenericTerm(word))
    .filter(word => isRelevantMedicalWord(word))
  
  keyWords.push(...diagnosticWords)

  const organSystem = identifyOrganSystem(cleaned)

  console.log(`[Enhanced Search] Extracted phrases:`, {
    exactPhrases: [...new Set(exactPhrases)],
    medicalTerms: [...new Set(medicalTerms)], 
    keyWords: [...new Set(keyWords)]
  })

  return {
    exactPhrases: [...new Set(exactPhrases)],
    medicalTerms: [...new Set(medicalTerms)],
    keyWords: [...new Set(keyWords)],
    organSystem
  }
}

/**
 * ENHANCED: Extract medical phrases with better pattern recognition
 */
function extractEnhancedMedicalPhrases(text: string): string[] {
  const phrases: string[] = []
  
  // Enhanced medical phrase patterns with better specificity
  const medicalPhrasePatterns = [
    // Multi-word carcinomas, lymphomas, sarcomas
    /(?:atypical\s+)?(?:ductal|lobular|follicular|papillary|squamous|basal|clear|granular|serous|mucinous|invasive|metastatic|high\s+grade|low\s+grade)\s+(?:cell\s+)?(?:carcinoma|lymphoma|sarcoma|adenoma|hyperplasia)/gi,
    
    // Specific lymphoma types
    /(?:chronic\s+lymphocytic\s+leukemia|diffuse\s+large\s+b\s+cell\s+lymphoma|follicle\s+center\s+lymphoma|marginal\s+zone\s+lymphoma|mantle\s+cell\s+lymphoma)/gi,
    
    // Carcinoma in situ patterns
    /(?:ductal|lobular)\s+carcinoma\s+in\s+situ/gi,
    
    // Hyperplasia patterns  
    /(?:atypical\s+)?(?:ductal|lobular)\s+hyperplasia/gi,
    
    // Hepatocellular patterns
    /(?:inflammatory\s+)?hepatocellular\s+(?:carcinoma|adenoma)/gi,
    
    // Serous carcinoma patterns
    /(?:high\s+grade\s+)?serous\s+carcinoma/gi,
    
    // Small cell patterns
    /small\s+cell\s+(?:carcinoma|lung\s+cancer)/gi,
    
    // General patterns (lower priority)
    /\w+\s+(?:carcinoma|lymphoma|sarcoma|adenoma|nevus|tumor|syndrome|disease)/gi,
    /\w+\s+cell\s+\w+/gi
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
 * Extract core medical terms (entities, modifiers)
 */
function extractCoreMedicalTerms(text: string): string[] {
  const terms: string[] = []
  
  // Core pathological entities
  const entityPatterns = [
    /(?:carcinoma|lymphoma|sarcoma|adenoma|hyperplasia|dysplasia|metaplasia|neoplasia|melanoma|nevus|fibroma|lipoma|hemangioma)/gi,
    /(?:chronic|acute|invasive|metastatic|inflammatory|atypical|high\s+grade|low\s+grade)/gi
  ]
  
  for (const pattern of entityPatterns) {
    const matches = text.match(pattern)
    if (matches) {
      terms.push(...matches.map(m => m.toLowerCase().trim()))
    }
  }
  
  return [...new Set(terms)]
}

/**
 * Check if a word is medically relevant
 */
function isRelevantMedicalWord(word: string): boolean {
  const medicalWords = [
    'carcinoma', 'lymphoma', 'sarcoma', 'adenoma', 'melanoma', 'nevus',
    'chronic', 'acute', 'invasive', 'metastatic', 'inflammatory', 'atypical',
    'ductal', 'lobular', 'follicular', 'papillary', 'squamous', 'basal',
    'serous', 'mucinous', 'clear', 'granular', 'small', 'large',
    'hyperplasia', 'dysplasia', 'metaplasia', 'neoplasia',
    'hepatocellular', 'cutaneous', 'primary', 'secondary'
  ]
  
  return medicalWords.includes(word.toLowerCase())
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

/**
 * REWRITTEN: Calculate content match score with proper hierarchy
 */
function calculateContentMatchScore(
  diagnosticTerms: { exactPhrases: string[], medicalTerms: string[], keyWords: string[] },
  topicName: string, 
  lessonName: string, 
  fullContentText: string
): number {
  let totalScore = 0
  const topicLower = topicName.toLowerCase()
  const lessonLower = lessonName.toLowerCase()
  const contentLower = fullContentText.toLowerCase()
  
  console.log(`[Enhanced Search] Scoring topic: "${topicName}"`)
  
  // 1. EXACT TOPIC NAME MATCHES (HIGHEST PRIORITY - 100,000+ points)
  for (const phrase of diagnosticTerms.exactPhrases) {
    // Perfect topic name match
    if (topicLower === phrase) {
      totalScore += 100000
      console.log(`[Enhanced Search] 🏆 PERFECT TOPIC MATCH: "${phrase}" -> +100,000`)
      return totalScore // Early return for perfect matches
    }
    
    // Exact phrase contained in topic name
    if (topicLower.includes(phrase) && phrase.length >= 8) {
      totalScore += 75000
      console.log(`[Enhanced Search] 🎯 EXACT PHRASE IN TOPIC: "${phrase}" -> +75,000`)
    }
    
    // Exact phrase contained in lesson name
    if (lessonLower.includes(phrase) && phrase.length >= 8) {
      totalScore += 50000  
      console.log(`[Enhanced Search] 🎯 EXACT PHRASE IN LESSON: "${phrase}" -> +50,000`)
    }
  }
  
  // 2. MEDICAL TERM MATCHES (HIGH PRIORITY - 10,000-25,000 points)
  for (const term of diagnosticTerms.medicalTerms) {
    if (topicLower.includes(term)) {
      totalScore += 25000
      console.log(`[Enhanced Search] 🔬 MEDICAL TERM IN TOPIC: "${term}" -> +25,000`)
    }
    if (lessonLower.includes(term)) {
      totalScore += 15000
      console.log(`[Enhanced Search] 🔬 MEDICAL TERM IN LESSON: "${term}" -> +15,000`)
    }
  }
  
  // 3. KEY WORD MATCHES (MEDIUM PRIORITY - 1,000-5,000 points)
  for (const word of diagnosticTerms.keyWords) {
    if (topicLower.includes(word)) {
      totalScore += 5000
      console.log(`[Enhanced Search] 📝 KEY WORD IN TOPIC: "${word}" -> +5,000`)
    }
    if (lessonLower.includes(word)) {
      totalScore += 3000
      console.log(`[Enhanced Search] 📝 KEY WORD IN LESSON: "${word}" -> +3,000`)
    }
  }
  
  // 4. CONTENT MATCHING (LOWER PRIORITY - 50-500 points)
  for (const phrase of diagnosticTerms.exactPhrases) {
    if (contentLower.includes(phrase)) {
      const matches = (contentLower.match(new RegExp(phrase.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'), 'g')) || []).length
      totalScore += matches * 500
      console.log(`[Enhanced Search] 📄 PHRASE IN CONTENT: "${phrase}" (${matches}x) -> +${matches * 500}`)
    }
  }
  
  console.log(`[Enhanced Search] Total score for "${topicName}": ${totalScore}`)
  return totalScore
}

// Old calculateFullTextScore function removed - replaced by calculateContentMatchScore above

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
        console.log(`[Pure Client Context] Specific diagnosis "${specificDiagnosis}" missing key terms: ${termsFound}/${requiredTerms.length}`)
      }
    }
  }
  
  return penalty
}

/**
 * Main pure client-side context search function - ZERO API calls
 */
export async function findContextPureClient(
  diagnosis: string,
  category?: string,
  subcategory?: string
): Promise<ContextSearchResult> {
  const startTime = Date.now()
  let cacheHits = 0
  let networkRequests = 0
  
  try {
    console.log(`[Pure Client Context] 🚀 Starting PURE CLIENT-SIDE context search for: ${diagnosis}`)
    console.log(`[Pure Client Context] Category: ${category || 'Not specified'}, Subcategory: ${subcategory || 'Not specified'}`)

    // Extract diagnostic terms
    const diagnosticTerms = extractDiagnosticTerms(diagnosis)
    console.log(`[Enhanced Search] Extracted phrases:`, diagnosticTerms)

    // Get targeted files (smart selection)
    const targetFiles = dataManager.getTargetedFiles(category || '', subcategory || '', diagnosis)
    console.log(`[Pure Client Context] Will search ${targetFiles.length} files: ${targetFiles.join(', ')}`)

    let bestMatch: { content: EducationalContent; score: number; filename: string; lesson: string; topic: string } | null = null
    let filesSearched = 0

    // Search through targeted files (loaded on-demand from cache or R2)
    for (const filename of targetFiles) {
      try {
        console.log(`[Pure Client Context] Loading ${filename}...`)
        
        // Check if already cached
        const wasCached = dataManager.getCacheStatus().contentFiles.files.includes(filename.replace('.json', ''))
        
        const data = await dataManager.loadContentFile(filename)
        
        if (wasCached) {
          cacheHits++
          console.log(`[Pure Client Context] ✅ ${filename} loaded from cache`)
        } else {
          networkRequests++
          console.log(`[Pure Client Context] 📥 ${filename} downloaded from R2`)
        }
        
        if (!data || !data.subject || !data.subject.lessons) {
          console.warn(`[Pure Client Context] Invalid data structure in ${filename}`)
          continue
        }

        filesSearched++
        
        // Search through all content in this file
        for (const [lessonName, lessonData] of Object.entries(data.subject.lessons)) {
          if (lessonData && typeof lessonData === 'object' && 'topics' in lessonData) {
            const topics = (lessonData as any).topics
            
            for (const [topicName, topicData] of Object.entries(topics)) {
              if (topicData && typeof topicData === 'object' && 'content' in topicData) {
                const fullContentText = JSON.stringify((topicData as any).content).toLowerCase()
                const topicNameLower = topicName.toLowerCase()
                const lessonNameLower = lessonName.toLowerCase()
                
                // Calculate content-based score using NEW ALGORITHM
                let score = calculateContentMatchScore(diagnosticTerms, topicName, lessonName, fullContentText)
                
                // DRAMATICALLY INCREASED category/subcategory weighting
                let categoryMultiplier = 1.0
                let categoryBonus = 0
                
                if (category) {
                  const categoryLower = category.toLowerCase()
                  if (topicNameLower.includes(categoryLower) || lessonNameLower.includes(categoryLower) || fullContentText.includes(categoryLower)) {
                    categoryBonus += 5000
                    categoryMultiplier = 2.0
                    console.log(`[Pure Client Context] STRONG category match: "${categoryLower}" -> +${categoryBonus} and 2x multiplier`)
                  }
                }
                
                if (subcategory) {
                  const subcategoryLower = subcategory.toLowerCase()
                  if (topicNameLower.includes(subcategoryLower) || lessonNameLower.includes(subcategoryLower) || fullContentText.includes(subcategoryLower)) {
                    categoryBonus += 8000
                    categoryMultiplier = 3.0
                    console.log(`[Pure Client Context] STRONG subcategory match: "${subcategoryLower}" -> +${categoryBonus} and 3x multiplier`)
                  }
                }
                
                // Apply category multiplier and bonus
                score = (score * categoryMultiplier) + categoryBonus
                
                // PENALTY for category/subcategory mismatch
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
                    score = Math.max(score * 0.1, 100)
                    console.log(`[Pure Client Context] No category/subcategory match penalty applied`)
                  }
                }
                
                // DIAGNOSTIC SPECIFICITY VALIDATION
                const specificityPenalty = validateDiagnosticSpecificity(diagnosis, topicName, lessonName, fullContentText)
                if (specificityPenalty > 0) {
                  score = Math.max(score - specificityPenalty, 0)
                  console.log(`[Pure Client Context] Diagnostic specificity penalty: -${specificityPenalty}`)
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
                    console.log(`[Pure Client Context] New best match: ${filename} - ${lessonName} - ${topicName} (score: ${score})`)
                    
                    // Early termination for excellent matches
                    if (score >= 15000) {
                      console.log(`[Pure Client Context] Excellent match found (score: ${score}) - terminating search early`)
                      break
                    }
                  }
                }
              }
            }
          }
        }
        
      } catch (error) {
        console.warn(`[Pure Client Context] Error loading ${filename}:`, error)
        continue
      }
    }

    const searchTime = Date.now() - startTime
    console.log(`[Pure Client Context] ✅ Context search completed in ${searchTime}ms`)
    console.log(`[Pure Client Context] 📊 Cache efficiency: ${cacheHits} cache hits, ${networkRequests} network requests`)

    // Quality assessment with NEW THRESHOLDS for enhanced scoring system
    let shouldReject = false
    let contextQuality = 'none'
    
    if (!bestMatch) {
      console.log('[Enhanced Search] No educational content found - recommend rejecting slide')
      shouldReject = true
    } else if (bestMatch.score < 10000) {
      console.log(`[Enhanced Search] Very poor context match (score: ${bestMatch.score}) - rejecting slide`)
      shouldReject = true
      contextQuality = 'poor'
    } else if (bestMatch.score < 25000) {
      console.log(`[Enhanced Search] Moderate context match (score: ${bestMatch.score}) - rejecting for quality`)
      shouldReject = true
      contextQuality = 'moderate'
    } else if (bestMatch.score < 50000) {
      console.log(`[Enhanced Search] Good context match (score: ${bestMatch.score}) - proceeding`)
      shouldReject = false
      contextQuality = 'good'
    } else {
      console.log(`[Enhanced Search] Excellent context match (score: ${bestMatch.score}) - high confidence match`)
      contextQuality = 'excellent'
    }

    if (bestMatch) {
      console.log(`[Pure Client Context] Best match: ${bestMatch.topic} (${bestMatch.content.subject})`)
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
        client_side: true,
        cache_hits: cacheHits,
        network_requests: networkRequests
      }
    }

  } catch (error) {
    const searchTime = Date.now() - startTime
    console.error('[Pure Client Context] Error searching context:', error)
    
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
        client_side: true,
        cache_hits: cacheHits,
        network_requests: networkRequests
      }
    }
  }
}