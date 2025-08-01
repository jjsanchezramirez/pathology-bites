import { NextRequest, NextResponse } from 'next/server'

// Types
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
  image_url: string
  thumbnail_url: string
  magnification: string
  organ_system: string
  difficulty_level: string
  keywords: string[]
  created_at: string
  updated_at: string
}

interface PathPresenterContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

interface QuestionData {
  stem: string
  options: Array<{
    id: string
    text: string
    is_correct: boolean
    explanation: string
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
    image_verification?: any
  }
  debug?: any
}

// Multi-step WSI question generation
async function generateQuestionMultiStep(category?: string): Promise<GeneratedQuestion> {
  const startTime = Date.now()
  
  try {
    console.log('[WSI Generator] Starting multi-step generation process')

    // Determine base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    // Step 1: Select WSI
    console.log('[WSI Generator] Step 1 - Selecting WSI...')
    const wsiUrl = category && category !== 'all'
      ? `${baseUrl}/api/tools/wsi-question-generator/select-wsi?category=${encodeURIComponent(category)}`
      : `${baseUrl}/api/tools/wsi-question-generator/select-wsi`

    const wsiResponse = await fetch(wsiUrl, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!wsiResponse.ok) {
      throw new Error(`WSI Selection failed: ${wsiResponse.status} ${wsiResponse.statusText}`)
    }

    const wsiData = await wsiResponse.json()
    if (!wsiData.success || !wsiData.wsi) {
      throw new Error('Failed to select WSI')
    }

    const selectedWSI = wsiData.wsi
    console.log(`[WSI Generator] Selected WSI - ${selectedWSI.diagnosis}`)

    // Step 2: Find context
    console.log('[WSI Generator] Step 2 - Finding context...')
    const contextResponse = await fetch(`${baseUrl}/api/tools/wsi-question-generator/find-context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        diagnosis: selectedWSI.diagnosis
      })
    })

    if (!contextResponse.ok) {
      throw new Error(`Context search failed: ${contextResponse.status} ${contextResponse.statusText}`)
    }

    const contextData = await contextResponse.json()
    if (!contextData.success) {
      throw new Error('Failed to find context')
    }

    const context = contextData.context
    console.log(`[WSI Generator] Context found - ${!!context}`)

    // Step 3: Verify image accessibility (optional, non-blocking)
    console.log('[WSI Generator] Step 3 - Verifying image accessibility...')
    let imageVerification = null
    try {
      const imageResponse = await fetch(`${baseUrl}/api/tools/wsi-question-generator/verify-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: selectedWSI.image_url,
          thumbnailUrl: selectedWSI.thumbnail_url
        })
      })

      if (imageResponse.ok) {
        const imageData = await imageResponse.json()
        if (imageData.success) {
          imageVerification = imageData
          console.log(`[WSI Generator] Image accessible - ${imageData.image.accessible}`)
        }
      }
    } catch (imageError) {
      console.warn('[WSI Generator] Image verification failed (non-blocking):', imageError)
    }

    // Step 4: Generate question
    console.log('[WSI Generator] Step 4 - Generating question...')
    const questionResponse = await fetch(`${baseUrl}/api/tools/wsi-question-generator/generate-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wsi: selectedWSI,
        context: context
      })
    })

    if (!questionResponse.ok) {
      throw new Error(`Question generation failed: ${questionResponse.status} ${questionResponse.statusText}`)
    }

    const questionData = await questionResponse.json()
    if (!questionData.success || !questionData.question) {
      throw new Error('Failed to generate question')
    }

    console.log('[WSI Generator] Successfully generated question')

    // Combine all data into the expected format
    const generationTime = Date.now() - startTime
    const generatedQuestion: GeneratedQuestion = {
      id: `wsi-${selectedWSI.id}-${Date.now()}`,
      wsi: selectedWSI,
      question: questionData.question,
      context: context,
      metadata: {
        generated_at: new Date().toISOString(),
        model: questionData.metadata?.model || 'unknown',
        generation_time_ms: generationTime,
        image_verification: imageVerification
      },
      debug: questionData.debug
    }

    return generatedQuestion

  } catch (error) {
    console.error('[WSI Generator] Multi-step generation failed:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[WSI Generator] Starting WSI question generation request')

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const useMultiStep = searchParams.get('multistep') !== 'false' // Default to true

    console.log(`[WSI Generator] Category filter: ${category}`)
    console.log(`[WSI Generator] Multi-step mode: ${useMultiStep}`)

    let result: GeneratedQuestion

    if (useMultiStep) {
      // Use new multi-step approach
      result = await generateQuestionMultiStep(category || undefined)
    } else {
      // Fallback to legacy monolithic approach
      console.log('[WSI Generator] Using legacy monolithic approach')
      // Import and use the legacy route logic here if needed
      throw new Error('Legacy mode not implemented in this version')
    }

    const totalTime = Date.now() - startTime
    console.log(`[WSI Generator] Total generation time: ${totalTime}ms`)

    return NextResponse.json(result, { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('[WSI Generator] Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to generate WSI question',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
