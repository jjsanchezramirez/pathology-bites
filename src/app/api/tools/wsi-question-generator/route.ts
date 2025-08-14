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

// Legacy server-side generation (deprecated - use client-side hook instead)
async function generateQuestionMultiStep(category?: string): Promise<GeneratedQuestion> {
  console.log('[WSI Generator] ⚠️ Using deprecated server-side generation')
  console.log('[WSI Generator] Consider migrating to useWSIQuestionGenerator hook for better performance')
  
  // This is now a legacy fallback - recommend client-side approach
  throw new Error('Server-side WSI generation deprecated. Use useWSIQuestionGenerator hook for client-side generation with direct R2 access.')
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
