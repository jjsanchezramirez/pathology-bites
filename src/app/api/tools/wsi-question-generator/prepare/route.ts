import { NextRequest, NextResponse } from 'next/server'
import { VirtualSlide } from '@/shared/types/virtual-slides'

// Set short timeout for preparation step
export const maxDuration = 5 // 5 seconds timeout

// Normalize WSI object to handle field name differences
function normalizeWSI(wsi: VirtualSlide): VirtualSlide {
  return {
    ...wsi,
    image_url: wsi.image_url || wsi.slide_url || wsi.case_url || ''
  }
}

// Build comprehensive prompt for question generation
function buildQuestionPrompt(wsi: VirtualSlide, context: any | null = null): string {
  const diagnosis = wsi.diagnosis || 'Unknown diagnosis'
  const stain = wsi.stain || 'H&E'
  const organ = wsi.organ || 'tissue'
  const magnification = wsi.magnification || 'various magnifications'
  
  // Build context information if available
  let contextInfo = ''
  if (context) {
    contextInfo = `\n\nAdditional context: ${JSON.stringify(context)}`
  }

  const prompt = `Create a high-quality multiple-choice pathology question based on this virtual slide:

**Slide Information:**
- Diagnosis: ${diagnosis}
- Organ/Tissue: ${organ}
- Stain: ${stain}
- Magnification: ${magnification}
- Image URL: ${wsi.image_url}${contextInfo}

**Instructions:**
1. Create a clinical scenario that would lead to this biopsy/specimen
2. Ask about the most likely diagnosis based on the histologic findings
3. Provide 4 answer choices (A, B, C, D) with only one correct answer
4. Include brief explanations for each option
5. Add a teaching point that summarizes the key diagnostic features
6. Assume the reader can see the microscopic image, so don't describe basic histologic features in detail
7. Focus on clinical correlation and diagnostic reasoning

**Required JSON Format:**
{
  "stem": "Clinical scenario and question here",
  "options": [
    {
      "id": "A",
      "text": "First option",
      "is_correct": false,
      "explanation": "Why this is incorrect"
    },
    {
      "id": "B", 
      "text": "Second option",
      "is_correct": true,
      "explanation": "Why this is correct"
    },
    {
      "id": "C",
      "text": "Third option", 
      "is_correct": false,
      "explanation": "Why this is incorrect"
    },
    {
      "id": "D",
      "text": "Fourth option",
      "is_correct": false, 
      "explanation": "Why this is incorrect"
    }
  ],
  "teaching_point": "Key learning point about this diagnosis",
  "references": ["Relevant textbook or journal references"]
}`

  return prompt
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[WSI Prepare] Starting WSI preparation and prompt building')

    // Parse request body
    const body = await request.json()
    const { wsi, context, customPrompt } = body

    if (!wsi) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: wsi'
        },
        { status: 400 }
      )
    }

    // Normalize WSI object to handle field name differences
    const normalizedWSI = normalizeWSI(wsi)

    // Validate required fields
    if (!normalizedWSI.image_url) {
      console.error('[WSI Prepare] WSI validation failed:', {
        original_image_url: wsi.image_url,
        original_slide_url: wsi.slide_url,
        original_case_url: wsi.case_url,
        normalized_image_url: normalizedWSI.image_url,
        wsi_keys: Object.keys(wsi)
      })
      return NextResponse.json(
        {
          success: false,
          error: 'No valid image URL found in WSI object (checked image_url, slide_url, case_url)'
        },
        { status: 400 }
      )
    }

    // Build comprehensive prompt (use custom prompt if provided)
    const prompt = customPrompt || buildQuestionPrompt(normalizedWSI, context)

    const preparationTime = Date.now() - startTime
    console.log(`[WSI Prepare] Preparation completed in ${preparationTime}ms`)

    return NextResponse.json({
      success: true,
      wsi: normalizedWSI,
      prompt: prompt,
      metadata: {
        prepared_at: new Date().toISOString(),
        preparation_time_ms: preparationTime,
        prompt_length: prompt.length,
        diagnosis: normalizedWSI.diagnosis
      }
    })

  } catch (error) {
    console.error('[WSI Prepare] Preparation error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to prepare WSI for question generation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
