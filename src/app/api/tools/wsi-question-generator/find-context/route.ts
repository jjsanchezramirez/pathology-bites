import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'

// Types for PathPrimer content
interface PathPrimerContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

// Helper function to extract meaningful diagnostic terms with medical context awareness
function extractDiagnosticTerms(diagnosis: string): { primaryTerms: string[], secondaryTerms: string[], organSystem: string } {
  // Remove anatomical locations in parentheses, case numbers in brackets, and other noise
  let cleaned = diagnosis
    .replace(/\([^)]*\)/g, '') // Remove content in parentheses
    .replace(/\[[^\]]*\]/g, '') // Remove content in brackets
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase()

  // Identify organ system from diagnosis
  const organSystem = identifyOrganSystem(cleaned)

  // Extract primary diagnostic terms (specific pathological entities)
  const primaryTerms: string[] = []
  const secondaryTerms: string[] = []

  // Add the full cleaned diagnosis as primary
  if (cleaned.length >= 5) {
    primaryTerms.push(cleaned)
  }

  // Split on common separators
  const separators = [',', ';', '/', '-', 'and', 'or', 'with', 'versus', 'vs']
  let parts = [cleaned]

  for (const sep of separators) {
    const newParts: string[] = []
    for (const part of parts) {
      newParts.push(...part.split(sep).map(p => p.trim()).filter(p => p.length > 0))
    }
    parts = newParts
  }

  // Categorize terms by medical significance
  for (const part of parts) {
    if (part.length >= 5) {
      // Check if this is a specific pathological entity
      if (isSpecificPathologicalEntity(part)) {
        primaryTerms.push(part)
      } else {
        secondaryTerms.push(part)
      }

      // Add multi-word terms as secondary
      const words = part.split(/\s+/).filter(w => w.length >= 4 && !isGenericTerm(w))
      secondaryTerms.push(...words)
    }
  }

  return {
    primaryTerms: [...new Set(primaryTerms)],
    secondaryTerms: [...new Set(secondaryTerms)],
    organSystem
  }
}

// Helper function to identify organ system from diagnosis
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

// Helper function to identify specific pathological entities
function isSpecificPathologicalEntity(term: string): boolean {
  const specificEntities = [
    'carcinoma', 'adenocarcinoma', 'sarcoma', 'lymphoma', 'melanoma', 'meningioma',
    'hyperplasia', 'hypertrophy', 'dysplasia', 'metaplasia', 'neoplasia',
    'adenoma', 'papilloma', 'fibroma', 'lipoma', 'hemangioma',
    'inflammation', 'fibrosis', 'sclerosis', 'atrophy', 'infarction'
  ]

  return specificEntities.some(entity => term.includes(entity))
}

// Helper function to get prioritized file list based on WSI category
function getPrioritizedFiles(category: string): string[] {
  const allFiles = [
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

  const categoryLower = category.toLowerCase()
  const prioritizedFiles: string[] = []
  const remainingFiles: string[] = []

  // Prioritize files based on category
  for (const file of allFiles) {
    let isPriority = false

    if (categoryLower.includes('bone') || categoryLower.includes('soft tissue')) {
      if (file === 'ap-soft-tissue.json' || file === 'ap-bone.json') {
        isPriority = true
      }
    } else if (categoryLower.includes('breast')) {
      if (file === 'ap-breast.json') isPriority = true
    } else if (categoryLower.includes('gastrointestinal') || categoryLower.includes('gi')) {
      if (file === 'ap-gastrointestinal.json') isPriority = true
    } else if (categoryLower.includes('genitourinary') || categoryLower.includes('gu')) {
      if (file === 'ap-genitourinary.json') isPriority = true
    } else if (categoryLower.includes('gynecological') || categoryLower.includes('gyn')) {
      if (file === 'ap-gynecological.json') isPriority = true
    } else if (categoryLower.includes('dermatopathology') || categoryLower.includes('skin')) {
      if (file === 'ap-dermatopathology.json') isPriority = true
    } else if (categoryLower.includes('hematopathology') || categoryLower.includes('heme')) {
      if (file === 'ap-hematopathology.json' || file === 'cp-hematopathology.json') isPriority = true
    } else if (categoryLower.includes('neuropathology') || categoryLower.includes('neuro')) {
      if (file === 'ap-neuropathology.json') isPriority = true
    } else if (categoryLower.includes('cardiovascular') || categoryLower.includes('cardiac')) {
      if (file === 'ap-cardiovascular-and-thoracic.json') isPriority = true
    } else if (categoryLower.includes('cytopathology') || categoryLower.includes('cytology')) {
      if (file === 'ap-cytopathology.json') isPriority = true
    } else if (categoryLower.includes('head') || categoryLower.includes('neck') || categoryLower.includes('endocrine')) {
      if (file === 'ap-head-and-neck---endocrine.json') isPriority = true
    } else if (categoryLower.includes('pancreas') || categoryLower.includes('biliary') || categoryLower.includes('liver')) {
      if (file === 'ap-pancreas-biliary-liver.json') isPriority = true
    }

    if (isPriority) {
      prioritizedFiles.push(file)
    } else {
      remainingFiles.push(file)
    }
  }

  return [...prioritizedFiles, ...remainingFiles]
}

// Helper function to identify generic terms that shouldn't contribute to matching
function isGenericTerm(term: string): boolean {
  const genericTerms = [
    'diagnosis', 'differential', 'clinical', 'pathology', 'features', 'findings',
    'microscopic', 'macroscopic', 'treatment', 'prognosis', 'epidemiology',
    'lesion', 'tissue', 'cell', 'cells', 'tumor', 'mass', 'growth', 'disease',
    'benign', 'malignant', 'normal', 'abnormal', 'chronic', 'acute'
  ]
  return genericTerms.includes(term.toLowerCase())
}

// Helper function to check organ system compatibility
function checkOrganSystemMatch(organSystem: string, topicName: string, lessonName: string): number {
  const systemMappings = {
    'genitourinary': ['genitourinary', 'gu', 'urologic', 'renal', 'prostatic', 'bladder'],
    'gastrointestinal': ['gastrointestinal', 'gi', 'gastric', 'intestinal', 'colonic'],
    'breast': ['breast', 'mammary'],
    'dermatopathology': ['dermatopathology', 'skin', 'cutaneous'],
    'hematopathology': ['hematopathology', 'heme', 'lymphoid', 'blood'],
    'neuropathology': ['neuropathology', 'neuro', 'brain', 'neural'],
    'bone': ['bone', 'osseous', 'skeletal'],
    'soft-tissue': ['soft tissue', 'muscle', 'connective'],
    'gynecological': ['gynecological', 'gyn', 'reproductive', 'female'],
    'head-neck-endocrine': ['head', 'neck', 'endocrine', 'thyroid'],
    'cardiovascular': ['cardiovascular', 'cardiac', 'heart'],
    'pancreas-biliary-liver': ['pancreas', 'biliary', 'liver', 'hepatic']
  }

  const keywords = systemMappings[organSystem as keyof typeof systemMappings] || []
  const combinedText = `${topicName} ${lessonName}`.toLowerCase()

  for (const keyword of keywords) {
    if (combinedText.includes(keyword)) {
      return 1500 // Major bonus for organ system match
    }
  }

  return 0
}

// Helper function to calculate match score with medical context awareness
function calculateMatchScore(diagnosticTerms: { primaryTerms: string[], secondaryTerms: string[], organSystem: string }, topicName: string, lessonName: string, topicText: string): number {
  let score = 0
  const topicNameLower = topicName.toLowerCase()
  const lessonNameLower = lessonName.toLowerCase()
  const topicTextLower = topicText.toLowerCase()

  // Check organ system compatibility first (major boost for correct organ system)
  const organSystemBonus = checkOrganSystemMatch(diagnosticTerms.organSystem, topicNameLower, lessonNameLower)
  score += organSystemBonus

  // Process primary terms (higher weight)
  for (const term of diagnosticTerms.primaryTerms) {
    const termLower = term.toLowerCase()

    // Skip generic terms for content matching
    if (isGenericTerm(termLower)) continue

    // Exact topic name match (highest priority)
    if (topicNameLower === termLower) {
      score += 2000 // Higher weight for primary terms
    }
    // Topic name contains term (word boundary)
    else if (topicNameLower.includes(termLower)) {
      const wordBoundaryRegex = new RegExp(`\\b${termLower}\\b`, 'i')
      if (wordBoundaryRegex.test(topicNameLower)) {
        score += 1000
      } else {
        score += 600 // Partial match
      }
    }
    // Lesson name contains term
    else if (lessonNameLower.includes(termLower)) {
      const wordBoundaryRegex = new RegExp(`\\b${termLower}\\b`, 'i')
      if (wordBoundaryRegex.test(lessonNameLower)) {
        score += 400
      } else {
        score += 200 // Partial match
      }
    }
    // Content contains term (with word boundary)
    else if (topicTextLower.includes(termLower)) {
      const wordBoundaryRegex = new RegExp(`\\b${termLower}\\b`, 'i')
      const matches = topicTextLower.match(wordBoundaryRegex)
      if (matches) {
        score += matches.length * 50
      }
    }
  }

  // Process secondary terms (lower weight)
  for (const term of diagnosticTerms.secondaryTerms) {
    const termLower = term.toLowerCase()

    // Skip generic terms for content matching
    if (isGenericTerm(termLower)) continue

    // Topic name contains term (word boundary)
    if (topicNameLower.includes(termLower)) {
      const wordBoundaryRegex = new RegExp(`\\b${termLower}\\b`, 'i')
      if (wordBoundaryRegex.test(topicNameLower)) {
        score += 300
      } else {
        score += 150 // Partial match
      }
    }
    // Lesson name contains term
    else if (lessonNameLower.includes(termLower)) {
      const wordBoundaryRegex = new RegExp(`\\b${termLower}\\b`, 'i')
      if (wordBoundaryRegex.test(lessonNameLower)) {
        score += 100
      } else {
        score += 50 // Partial match
      }
    }
    // Content contains term (with word boundary)
    else if (topicTextLower.includes(termLower)) {
      const wordBoundaryRegex = new RegExp(`\\b${termLower}\\b`, 'i')
      const matches = topicTextLower.match(wordBoundaryRegex)
      if (matches) {
        score += matches.length * 25
      }
    }
  }

  return score
}

// Search PathPrimer content for relevant educational material
async function searchPathPrimerContent(diagnosis: string, category?: string): Promise<PathPrimerContent | null> {
  try {
    console.log(`[Context Search] Searching PathPrimer content for: ${diagnosis}`)
    console.log(`[Context Search] Category: ${category || 'Not specified'}`)

    // Extract meaningful diagnostic terms
    const diagnosticTerms = extractDiagnosticTerms(diagnosis)
    console.log(`[Context Search] Primary terms: ${diagnosticTerms.primaryTerms.join(', ')}`)
    console.log(`[Context Search] Organ system: ${diagnosticTerms.organSystem}`)
    console.log(`[Context Search] Secondary terms: ${diagnosticTerms.secondaryTerms.join(', ')}`)

    // Get prioritized file list based on category
    const pathPrimerFiles = getPrioritizedFiles(category || '')
    console.log(`[Context Search] Will search ${pathPrimerFiles.length} files, prioritized order`)

    let filesSearched = 0
    let bestMatch: { content: PathPrimerContent; score: number; filename: string; lesson: string; topic: string } | null = null
    const maxFilesToSearch = 10 // Limit search to avoid timeout

    // Search through PathPrimer files (prioritized order)
    for (const filename of pathPrimerFiles.slice(0, maxFilesToSearch)) {
      try {
        const filePath = join(process.cwd(), 'data', 'pathprimer', filename)
        const fileContent = await readFile(filePath, 'utf-8')
        const data = JSON.parse(fileContent)
        filesSearched++

        console.log(`[Context Search] Searching file: ${filename}`)

        // Search through the content structure
        if (data.subject && data.subject.lessons) {
          for (const [lessonName, lessonData] of Object.entries(data.subject.lessons)) {
            if (lessonData && typeof lessonData === 'object' && 'topics' in lessonData) {
              const topics = (lessonData as any).topics
              for (const [topicName, topicData] of Object.entries(topics)) {
                if (topicData && typeof topicData === 'object' && 'content' in topicData) {
                  const topicText = JSON.stringify(topicData)
                  const score = calculateMatchScore(diagnosticTerms, topicName, lessonName, topicText)

                  if (score > 0) {
                    const content: PathPrimerContent = {
                      category: data.category,
                      subject: data.subject.name,
                      lesson: lessonName,
                      topic: topicName,
                      content: (topicData as any).content
                    }

                    if (!bestMatch || score > bestMatch.score) {
                      bestMatch = { content, score, filename, lesson: lessonName, topic: topicName }
                      console.log(`[Context Search] New best match: ${filename} - ${lessonName} - ${topicName} (score: ${score})`)
                    }
                  }
                }
              }
            }
          }
        }
      } catch (fileError) {
        console.warn(`[Context Search] Could not read file ${filename}:`, fileError)
        continue
      }

      // Early exit if we found a very good match
      if (bestMatch && bestMatch.score >= 500) {
        console.log(`[Context Search] Found high-quality match, stopping search early`)
        break
      }
    }

    console.log(`[Context Search] Searched ${filesSearched} files`)

    if (bestMatch) {
      console.log(`[Context Search] Best match found with score ${bestMatch.score}:`)
      console.log(`[Context Search] File: ${bestMatch.filename}`)
      console.log(`[Context Search] Subject: ${bestMatch.content.subject}`)
      console.log(`[Context Search] Topic: ${bestMatch.content.topic}`)
      return bestMatch.content
    } else {
      console.log('[Context Search] No relevant PathPrimer content found')
      return null
    }

  } catch (error) {
    console.error('[Context Search] Error searching PathPrimer content:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[Context Search] Starting context search request')

    // Parse request body
    const body = await request.json()
    const { diagnosis, category } = body

    if (!diagnosis) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameter: diagnosis'
        },
        { status: 400 }
      )
    }

    console.log(`[Context Search] Searching for diagnosis: ${diagnosis}`)
    if (category) {
      console.log(`[Context Search] Category: ${category}`)
    }

    // Search for relevant context
    const context = await searchPathPrimerContent(diagnosis, category)
    
    const searchTime = Date.now() - startTime
    console.log(`[Context Search] Context search completed in ${searchTime}ms`)

    const result = {
      success: true,
      context: context,
      metadata: {
        searched_at: new Date().toISOString(),
        search_time_ms: searchTime,
        diagnosis: diagnosis,
        category: category || null,
        context_found: !!context
      }
    }

    return NextResponse.json(result, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('[Context Search] Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to search context',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}