import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getApiKey, getModelProvider, DEFAULT_MODEL } from '@/shared/config/ai-models'

// Retry utility function (matching admin system)
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return response
      }

      // If it's a client error (4xx), don't retry
      if (response.status >= 400 && response.status < 500) {
        return response
      }

      // For server errors (5xx), retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown fetch error')
    }

    // Wait before retrying (exponential backoff)
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt - 1) * 1000 // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

// Types for WSI and question data
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

interface PathPresenterContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: Record<string, unknown>
}

interface QuestionData {
  stem: string
  options: Array<{
    id: string
    text: string
    is_correct: boolean
    explanation?: string
  }>
  teaching_point: string
  references: string[]
}

interface GeneratedQuestion {
  id: string
  wsi: VirtualSlide
  question: QuestionData
  context: PathPresenterContent | null
  metadata: {
    generated_at: string
    model: string
    generation_time_ms: number
  }
  debug?: {
    prompt: string
    instructions: string
  }
}

// Helper function to get random WSI from allowed repositories
async function getRandomWSI(category?: string): Promise<VirtualSlide> {
  try {
    const filePath = join(process.cwd(), 'data', 'virtual-slides.json')
    const fileContent = await readFile(filePath, 'utf-8')
    const slides: VirtualSlide[] = JSON.parse(fileContent)

    // Filter by allowed repositories only (exclude Leeds, Toronto, Recut Club)
    const allowedRepositories = [
      'Hematopathology eTutorial',
      'Rosai Collection',
      'PathPresenter',
      'MGH Pathology'
    ]
    let filteredSlides = slides.filter(slide =>
      allowedRepositories.includes(slide.repository)
    )

    // Further filter by category if provided
    if (category) {
      filteredSlides = filteredSlides.filter(slide =>
        slide.category.toLowerCase().includes(category.toLowerCase())
      )
    }

    if (filteredSlides.length === 0) {
      throw new Error('No virtual slides found in allowed repositories')
    }

    // Return random slide
    const randomIndex = Math.floor(Math.random() * filteredSlides.length)
    return filteredSlides[randomIndex]
  } catch (error) {
    console.error('Error loading virtual slides:', error)
    throw new Error('Failed to load virtual slides data')
  }
}

// Helper function to extract meaningful diagnostic terms from WSI diagnosis
function extractDiagnosticTerms(diagnosis: string): string[] {
  // Remove anatomical locations in parentheses, case numbers in brackets, and other noise
  let cleaned = diagnosis
    .replace(/\([^)]*\)/g, '') // Remove content in parentheses
    .replace(/\[[^\]]*\]/g, '') // Remove content in brackets
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .toLowerCase()

  // Split on common separators and extract meaningful terms
  const terms: string[] = []

  // Add the full cleaned diagnosis
  if (cleaned.length >= 3) {
    terms.push(cleaned)
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

  // Add individual meaningful parts (filter out very short terms)
  for (const part of parts) {
    if (part.length >= 3) {
      terms.push(part)

      // Also add individual words from multi-word terms
      const words = part.split(/\s+/).filter(w => w.length >= 3)
      terms.push(...words)
    }
  }

  // Remove duplicates and return
  return [...new Set(terms)]
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
    }

    if (isPriority) {
      prioritizedFiles.push(file)
    } else {
      remainingFiles.push(file)
    }
  }

  return [...prioritizedFiles, ...remainingFiles]
}

// Helper function to calculate match score
function calculateMatchScore(searchTerms: string[], topicName: string, lessonName: string, topicText: string): number {
  let score = 0
  const topicNameLower = topicName.toLowerCase()
  const lessonNameLower = lessonName.toLowerCase()
  const topicTextLower = topicText.toLowerCase()

  for (const term of searchTerms) {
    const termLower = term.toLowerCase()

    // Exact topic name match (highest priority)
    if (topicNameLower === termLower) {
      score += 1000
    }
    // Topic name contains term
    else if (topicNameLower.includes(termLower)) {
      score += 500
    }
    // Lesson name contains term
    else if (lessonNameLower.includes(termLower)) {
      score += 300
    }
    // Content contains term (but avoid generic terms)
    else if (topicTextLower.includes(termLower) && !isGenericTerm(termLower)) {
      score += 100
    }
  }

  return score
}

// Helper function to identify generic terms that shouldn't contribute to matching
function isGenericTerm(term: string): boolean {
  const genericTerms = [
    'diagnosis', 'differential', 'clinical', 'pathology', 'features', 'findings',
    'microscopic', 'macroscopic', 'treatment', 'prognosis', 'epidemiology'
  ]
  return genericTerms.includes(term.toLowerCase())
}

// Helper function to generate clinical stem for fallback questions
function generateClinicalStem(wsi: VirtualSlide): string {
  const age = wsi.age || (Math.random() > 0.5 ? `${Math.floor(Math.random() * 40) + 30}` : 'middle-aged')
  const gender = wsi.gender || (Math.random() > 0.5 ? 'male' : 'female')

  // Create clinical context based on category
  let clinicalContext = ''
  const category = wsi.category.toLowerCase()

  if (category.includes('dermatopathology') || category.includes('skin')) {
    clinicalContext = `presents with a skin lesion that has been present for several months`
  } else if (category.includes('gastrointestinal') || category.includes('gi')) {
    clinicalContext = `presents with gastrointestinal symptoms and undergoes biopsy`
  } else if (category.includes('genitourinary') || category.includes('gu')) {
    clinicalContext = `presents with urological symptoms and tissue is obtained for examination`
  } else if (category.includes('breast')) {
    clinicalContext = `presents with a breast mass detected on imaging`
  } else if (category.includes('hematopathology') || category.includes('heme')) {
    clinicalContext = `presents with hematologic abnormalities and tissue is examined`
  } else if (category.includes('cytology')) {
    clinicalContext = `undergoes cytological examination of suspicious cells`
  } else {
    clinicalContext = `presents with clinical findings requiring histopathological examination`
  }

  return `A ${age}-year-old ${gender} patient ${clinicalContext}. Based on the virtual slide images shown, what is the most likely diagnosis?`
}

// Helper function to generate differential diagnosis options for fallback
function generateDifferentialOptions(wsi: VirtualSlide): Array<{id: string, text: string, is_correct: boolean, explanation: string}> {
  const diagnosis = wsi.diagnosis
  const category = wsi.category.toLowerCase()

  // Generate plausible differential diagnoses based on category
  let differentials: string[] = []

  if (category.includes('dermatopathology')) {
    differentials = ['Squamous cell carcinoma', 'Basal cell carcinoma', 'Melanoma', 'Seborrheic keratosis', 'Actinic keratosis']
  } else if (category.includes('gastrointestinal')) {
    differentials = ['Adenocarcinoma', 'Inflammatory bowel disease', 'Hyperplastic polyp', 'Dysplasia', 'Normal mucosa']
  } else if (category.includes('breast')) {
    differentials = ['Invasive ductal carcinoma', 'Invasive lobular carcinoma', 'Ductal carcinoma in situ', 'Fibroadenoma', 'Atypical ductal hyperplasia']
  } else if (category.includes('hematopathology')) {
    differentials = ['Lymphoma', 'Leukemia', 'Reactive hyperplasia', 'Metastatic carcinoma', 'Normal lymphoid tissue']
  } else {
    differentials = ['Malignant neoplasm', 'Benign neoplasm', 'Inflammatory process', 'Reactive changes', 'Normal tissue']
  }

  // Ensure the correct diagnosis is in the list
  if (!differentials.includes(diagnosis)) {
    differentials[0] = diagnosis
  }

  // Shuffle and take first 5
  const shuffled = [...differentials].sort(() => Math.random() - 0.5).slice(0, 5)

  return shuffled.map((option, index) => ({
    id: String.fromCharCode(65 + index), // A, B, C, D, E
    text: option,
    is_correct: option === diagnosis,
    explanation: option === diagnosis
      ? `Correct. The histological features are characteristic of ${diagnosis}.`
      : `Incorrect. While ${option} may be in the differential diagnosis, the histological features are more consistent with ${diagnosis}.`
  }))
}

// Helper function to search PathPresenter content
async function searchPathPresenterContent(wsi: VirtualSlide): Promise<PathPresenterContent | null> {
  try {
    // Extract meaningful diagnostic terms
    const diagnosticTerms = extractDiagnosticTerms(wsi.diagnosis)
    console.log('Extracted diagnostic terms:', diagnosticTerms)

    // Get prioritized file list
    const pathPrimerFiles = getPrioritizedFiles(wsi.category)
    console.log('Prioritized files for category', wsi.category, ':', pathPrimerFiles.slice(0, 3))

    let bestMatch: { content: PathPresenterContent; score: number } | null = null

    // Search through PathPresenter files
    for (const filename of pathPrimerFiles) {
      try {
        const filePath = join(process.cwd(), 'data', 'pathprimer', filename)
        const fileContent = await readFile(filePath, 'utf-8')
        const data = JSON.parse(fileContent)

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
                    const content: PathPresenterContent = {
                      category: data.category,
                      subject: data.subject.name,
                      lesson: lessonName,
                      topic: topicName,
                      content: (topicData as any).content as Record<string, unknown>
                    }

                    if (!bestMatch || score > bestMatch.score) {
                      bestMatch = { content, score }
                      console.log(`New best match in ${filename}: ${lessonName} - ${topicName} (score: ${score})`)
                    }
                  }
                }
              }
            }
          }
        }
      } catch {
        // Continue searching other files if one fails
        continue
      }
    }

    return bestMatch?.content || null
  } catch (error) {
    console.error('Error searching PathPresenter content:', error)
    return null
  }
}

// Helper function to parse text format response from AI
function parseTextFormatResponse(text: string, wsi: VirtualSlide): {questionData: QuestionData, debug: {prompt: string, instructions: string}} | null {
  try {
    // Extract options (A. B. C. D. E.)
    const optionMatches = text.match(/^[A-E]\s*\n?(.+?)(?=\n[A-E]|\nTeaching Point|\nAnswer Explanations|$)/gm)
    if (!optionMatches || optionMatches.length < 5) {
      return null
    }

    const options = optionMatches.map((match, index) => {
      const letter = String.fromCharCode(65 + index) // A, B, C, D, E
      const text = match.replace(/^[A-E]\s*\n?/, '').trim()
      return {
        id: letter,
        text: text,
        is_correct: false, // Will be determined later
        explanation: '' // Will be filled from explanations section
      }
    })

    // Extract teaching point
    const teachingPointMatch = text.match(/Teaching Point\s*\n([\s\S]+?)(?=\nAnswer Explanations|$)/)
    const teaching_point = teachingPointMatch ? teachingPointMatch[1].trim() : `${wsi.diagnosis} is an important diagnosis in ${wsi.category.toLowerCase()}.`

    // Extract explanations
    const explanationsMatch = text.match(/Answer Explanations\s*\n([\s\S]+?)$/)
    if (explanationsMatch) {
      const explanationsText = explanationsMatch[1]
      const explanationMatches = explanationsText.match(/^([A-E])\.\s*(.+?)(?=\n[A-E]\.|$)/gm)

      if (explanationMatches) {
        explanationMatches.forEach(expMatch => {
          const letter = expMatch.charAt(0)
          const explanation = expMatch.replace(/^[A-E]\.\s*/, '').trim()
          const option = options.find(opt => opt.id === letter)
          if (option) {
            option.explanation = explanation
            // Mark as correct if explanation suggests it's correct
            if (explanation.toLowerCase().includes('correct') && !explanation.toLowerCase().includes('incorrect')) {
              option.is_correct = true
            }
          }
        })
      }
    }

    // Ensure at least one correct answer
    const hasCorrect = options.some(opt => opt.is_correct)
    if (!hasCorrect) {
      options[1].is_correct = true // Default to B
    }

    // Extract stem (everything before the first option)
    const stemMatch = text.match(/^([\s\S]+?)(?=\n[A-E]\.)/)
    const stem = stemMatch ? stemMatch[1].trim() : `Based on the virtual slide images shown, what is the most likely diagnosis for this ${wsi.category.toLowerCase()} case?`

    return {
      questionData: {
        stem,
        options,
        teaching_point,
        references: [`Reference for ${wsi.diagnosis}`]
      },
      debug: {
        prompt: 'Text format parsed',
        instructions: 'Text format conversion'
      }
    }
  } catch (error) {
    console.error('Error parsing text format:', error)
    return null
  }
}

// Helper function to generate question using AI
async function generateQuestion(wsi: VirtualSlide, context: PathPresenterContent | null): Promise<{questionData: QuestionData, debug: {prompt: string, instructions: string}}> {
  try {
    console.log('Generating AI question for WSI:', wsi.diagnosis)

    // Use enhanced instructions matching admin quality standards
    const instructions = `You are an expert pathology educator creating board-style multiple-choice questions for medical students and residents. Generate a high-quality pathology question based on the provided content that matches the standards of professional medical examinations.

QUALITY REQUIREMENTS (CRITICAL):
1. Create a clinically realistic scenario with specific patient demographics, symptoms, and relevant history
2. Include exactly 5 answer choices with one clearly correct answer and 4 plausible distractors
3. Test differential diagnosis skills and pathophysiological understanding, not just memorization
4. Use precise medical terminology and appropriate clinical context
5. Make the question challenging but fair - suitable for board examinations
6. Assume microscopic images are provided via WSI viewer (do NOT describe histologic findings in the stem)

STEM REQUIREMENTS:
- Begin with realistic patient presentation (age, gender, symptoms, duration, relevant history)
- Include pertinent clinical findings, laboratory results, or imaging when relevant
- End with a clear question asking for the most likely diagnosis
- DO NOT state the diagnosis directly or use phrases like "findings consistent with [diagnosis]"
- DO NOT describe microscopic features - the WSI images provide this information

ANSWER CHOICE REQUIREMENTS:
- Provide 5 specific diagnostic entities as options
- Include the correct diagnosis and 4 clinically relevant differential diagnoses
- Ensure distractors are plausible given the clinical scenario
- Use proper diagnostic terminology and classification

EXPLANATION REQUIREMENTS:
- Provide detailed explanations for each choice explaining why it's correct or incorrect
- Reference key distinguishing features, epidemiology, and clinical context
- Demonstrate expert-level pathology knowledge

CRITICAL: You must return ONLY valid JSON in the exact format below. Do not include any text before or after the JSON. Do not use markdown formatting.

{
  "stem": "Clinical scenario ending with diagnostic question",
  "options": [
    {"id": "A", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect in this context"},
    {"id": "B", "text": "Specific diagnosis", "is_correct": true, "explanation": "Detailed explanation for why this is the correct diagnosis, including key features"},
    {"id": "C", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect"},
    {"id": "D", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect"},
    {"id": "E", "text": "Specific diagnosis", "is_correct": false, "explanation": "Detailed explanation for why this diagnosis is incorrect"}
  ],
  "teaching_point": "Concise key learning point about the correct diagnosis, its significance, and distinguishing features",
  "references": ["Relevant pathology textbook or journal citation", "Additional authoritative reference"]
}`

    // Prepare comprehensive prompt with WSI and PathPrimer content (matching admin quality)
    const prompt = `Create a board-style pathology multiple-choice question based on the following comprehensive content:

**VIRTUAL SLIDE CASE INFORMATION:**
Repository: ${wsi.repository}
Pathological Category: ${wsi.category}
Subcategory: ${wsi.subcategory}
Confirmed Diagnosis: ${wsi.diagnosis}
Clinical History: ${wsi.clinical_history || 'Not provided'}
Patient Information: ${wsi.patient_info || 'Not specified'}
Patient Age: ${wsi.age || 'Not specified'}
Patient Gender: ${wsi.gender || 'Not specified'}
Staining: ${wsi.stain_type || 'H&E'}

${context ? `**EDUCATIONAL REFERENCE CONTENT (PathPrimer Database):**
Medical Category: ${context.category}
Subject Area: ${context.subject}
Lesson Module: ${context.lesson}
Specific Topic: ${context.topic}

DETAILED CONTENT:
${JSON.stringify(context.content, null, 2)}
` : ''}

**TASK:** Generate a high-quality, board-examination-style pathology question that:
1. Creates a realistic clinical scenario without revealing the diagnosis
2. Tests differential diagnosis skills using the provided WSI images
3. Includes 5 specific diagnostic options with detailed explanations
4. Matches the quality standards of professional medical examinations

The virtual slide images will be displayed to the user, so do not describe microscopic findings in your question stem.`

    // Use the same model selection logic as admin system
    const selectedModel = DEFAULT_MODEL // Use the same default as admin
    const provider = getModelProvider(selectedModel)
    const apiKey = getApiKey(provider)
    const apiEndpoint = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/debug/${provider}-test`

    console.log('WSI Question Generator: Using model:', selectedModel, 'provider:', provider)
    console.log('WSI Question Generator: API key available:', !!apiKey)

    if (!apiKey) {
      throw new Error(`${provider.toUpperCase()} API key not available. Please set the appropriate API key in your environment.`)
    }

    // Use retry logic like admin system for better reliability
    const response = await fetchWithRetry(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: apiKey,
        model: selectedModel,
        prompt: prompt,
        instructions: instructions,
        assumeHistologicImages: true, // Images are provided via WSI viewer
        temperature: 0.7,
        maxTokens: 2000 // Increased for more detailed responses
      })
    })

    if (!response.ok) {
      console.error(`${provider.toUpperCase()} API error:`, response.status, response.statusText)
      throw new Error(`Failed to generate question with ${provider.toUpperCase()} AI`)
    }

    const data = await response.json()
    console.log('WSI Question Generator: AI response received')

    // Extract content based on provider response format (same logic as admin)
    let generatedText = ''
    if (provider === 'gemini' && data.candidates?.[0]?.content?.parts?.[0]?.text) {
      generatedText = data.candidates[0].content.parts[0].text
    } else if ((provider === 'claude') && data.content?.[0]?.text) {
      generatedText = data.content[0].text
    } else if ((provider === 'chatgpt' || provider === 'mistral' || provider === 'deepseek' || provider === 'llama') && data.choices?.[0]?.message?.content) {
      generatedText = data.choices[0].message.content
    } else {
      console.error('Unexpected response format from AI provider:', provider)
      console.error('Response data:', JSON.stringify(data, null, 2))
      throw new Error(`Unexpected response format from AI provider: ${provider}`)
    }

    console.log('WSI Question Generator: Parsing AI response...')

    // Try to parse JSON from the response (same logic as admin)
    try {
      // Extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/) ||
                       generatedText.match(/\{[\s\S]*\}/)

      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0]
        const questionData = JSON.parse(jsonStr)

        // Validate the structure
        if (!questionData.stem || !questionData.options || !Array.isArray(questionData.options)) {
          throw new Error('Invalid question structure from AI')
        }

        // Ensure we have exactly 5 options with proper IDs (updated for 5 choices)
        const expectedIds = ['A', 'B', 'C', 'D', 'E']
        if (questionData.options && Array.isArray(questionData.options)) {
          questionData.options.forEach((option: { id?: string }, index: number) => {
            if (!option.id) {
              option.id = expectedIds[index]
            }
          })

          // Ensure we have at least one correct answer
          const hasCorrectAnswer = questionData.options.some((opt: { is_correct?: boolean }) => opt.is_correct)
          if (!hasCorrectAnswer) {
            questionData.options[0].is_correct = true
          }
        }



        return {
          questionData: {
            stem: questionData.stem,
            options: questionData.options,
            teaching_point: questionData.teaching_point || `${wsi.diagnosis} is an important diagnosis in ${wsi.category.toLowerCase()}.`,
            references: questionData.references || [`Reference for ${wsi.diagnosis}`]
          },
          debug: {
            prompt: prompt,
            instructions: instructions
          }
        }
      } else {
        // Try to parse text format as fallback
        console.log('WSI Generator: No JSON found, attempting to parse text format')
        const textParsed = parseTextFormatResponse(generatedText, wsi)
        if (textParsed) {
          return textParsed
        }
        throw new Error('Could not extract JSON from AI response')
      }

    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError)
      console.log('AI Response content:', generatedText)
      console.log('WSI Question Generator: Using fallback mock question with 5 options')

      // Enhanced fallback question with better clinical context
      const fallbackStem = generateClinicalStem(wsi)
      const fallbackOptions = generateDifferentialOptions(wsi)

      return {
        questionData: {
          stem: fallbackStem,
          options: fallbackOptions,
          teaching_point: `${wsi.diagnosis} is an important diagnosis in ${wsi.category.toLowerCase()} with characteristic histological features that distinguish it from other entities in the differential diagnosis.`,
          references: [`Robbins and Cotran Pathologic Basis of Disease`, `WHO Classification of Tumours`]
        },
        debug: {
          prompt: prompt,
          instructions: instructions
        }
      }
    }

  } catch (error) {
    console.error('Error generating question:', error)
    throw new Error('Failed to generate question using AI')
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('WSI Question Generator: Starting request')

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    console.log('WSI Question Generator: Category filter:', category)

    // Step 1: Get random WSI
    console.log('WSI Question Generator: Getting random WSI...')
    const wsi = await getRandomWSI(category || undefined)
    console.log('WSI Question Generator: Selected WSI:', wsi.id, wsi.diagnosis)

    // Step 2: Search for relevant PathPresenter content
    console.log('WSI Question Generator: Searching PathPresenter content...')
    const context = await searchPathPresenterContent(wsi)
    console.log('WSI Question Generator: PathPresenter context found:', !!context)

    // Step 3: Generate question using AI
    console.log('WSI Question Generator: Generating AI question...')
    const questionResult = await generateQuestion(wsi, context)

    // Step 4: Prepare response
    const generationTime = Date.now() - startTime

    const result: GeneratedQuestion = {
      id: `wsi-${wsi.id}-${Date.now()}`,
      wsi: wsi,
      question: questionResult.questionData,
      context: context,
      metadata: {
        generated_at: new Date().toISOString(),
        model: DEFAULT_MODEL,
        generation_time_ms: generationTime
      },
      debug: questionResult.debug
    }



    return NextResponse.json(result, { status: 200 })
    
  } catch (error) {
    console.error('WSI Question Generator error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to generate WSI question',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
