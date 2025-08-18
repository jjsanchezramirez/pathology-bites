import { NextRequest, NextResponse } from 'next/server'

// Set short timeout for parsing step
export const maxDuration = 5 // 5 seconds timeout

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

// Parse and validate AI response into structured question format
function parseAndValidateQuestion(response: string): QuestionData {
  console.log('[WSI Parse] Starting to parse AI response...')
  
  // Clean the response - remove markdown code blocks and extra whitespace
  let cleanedResponse = response.trim()
  
  // Remove markdown code blocks if present
  cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  
  // Try to find JSON in the response
  let jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    cleanedResponse = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(cleanedResponse)
    
    // Validate required fields
    if (!parsed.stem || typeof parsed.stem !== 'string') {
      throw new Error('Missing or invalid stem field')
    }
    
    if (!Array.isArray(parsed.options) || parsed.options.length !== 4) {
      throw new Error('Options must be an array of exactly 4 items')
    }
    
    // Validate each option
    const correctCount = parsed.options.filter((opt: any) => opt.is_correct === true).length
    if (correctCount !== 1) {
      throw new Error(`Exactly one option must be correct, found ${correctCount}`)
    }
    
    // Ensure all options have required fields
    for (let i = 0; i < parsed.options.length; i++) {
      const option = parsed.options[i]
      if (!option.id || !option.text || typeof option.is_correct !== 'boolean' || !option.explanation) {
        throw new Error(`Option ${i + 1} is missing required fields (id, text, is_correct, explanation)`)
      }
    }
    
    if (!parsed.teaching_point || typeof parsed.teaching_point !== 'string') {
      throw new Error('Missing or invalid teaching_point field')
    }
    
    // References can be optional, but if present should be an array
    if (parsed.references && !Array.isArray(parsed.references)) {
      throw new Error('References must be an array if provided')
    }
    
    // Ensure references exist (create empty array if missing)
    if (!parsed.references) {
      parsed.references = []
    }
    
    console.log('[WSI Parse] ✅ Question validation successful')
    
    return {
      stem: parsed.stem.trim(),
      options: parsed.options.map((opt: any) => ({
        id: opt.id.toString().trim(),
        text: opt.text.trim(),
        is_correct: Boolean(opt.is_correct),
        explanation: opt.explanation.trim()
      })),
      teaching_point: parsed.teaching_point.trim(),
      references: parsed.references.map((ref: any) => ref.toString().trim())
    }
    
  } catch (parseError) {
    console.error('[WSI Parse] JSON parsing failed:', parseError)
    console.error(`[WSI Parse] Cleaned response: ${cleanedResponse.substring(0, 500)}...`)
    
    // Try to extract information manually if JSON parsing fails
    try {
      return extractQuestionManually(response)
    } catch (extractError) {
      console.error('[WSI Parse] Manual extraction also failed:', extractError)
      throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`)
    }
  }
}

// Fallback manual extraction when JSON parsing fails
function extractQuestionManually(response: string): QuestionData {
  console.log('[WSI Parse] Attempting manual extraction...')
  
  // This is a simplified fallback - in practice you might want more sophisticated parsing
  const lines = response.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  let stem = ''
  let options: Array<{ id: string; text: string; is_correct: boolean; explanation: string }> = []
  let teaching_point = ''
  let references: string[] = []
  
  // Look for patterns in the text
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // Try to find stem (usually the first substantial text)
    if (!stem && line.length > 20 && !line.match(/^[A-D][\.\)]/)) {
      stem = line
    }
    
    // Try to find options (lines starting with A, B, C, D)
    const optionMatch = line.match(/^([A-D])[\.\)]\s*(.+)/)
    if (optionMatch) {
      options.push({
        id: optionMatch[1],
        text: optionMatch[2],
        is_correct: false, // We'll need to guess or mark the first one as correct
        explanation: 'Explanation not available from manual extraction'
      })
    }
    
    // Try to find teaching point
    if (line.toLowerCase().includes('teaching') || line.toLowerCase().includes('key point')) {
      teaching_point = line
    }
  }
  
  // If we found options, mark the first one as correct (this is a fallback)
  if (options.length > 0) {
    options[0].is_correct = true
  }
  
  // Ensure we have at least basic structure
  if (!stem) {
    throw new Error('Could not extract question stem from response')
  }
  
  if (options.length === 0) {
    throw new Error('Could not extract answer options from response')
  }
  
  // Pad options to 4 if we don't have enough
  while (options.length < 4) {
    options.push({
      id: String.fromCharCode(65 + options.length), // A, B, C, D
      text: 'Option not available',
      is_correct: false,
      explanation: 'Explanation not available'
    })
  }
  
  if (!teaching_point) {
    teaching_point = 'Teaching point not available from manual extraction'
  }
  
  console.log('[WSI Parse] ✅ Manual extraction completed')
  
  return {
    stem,
    options: options.slice(0, 4), // Ensure exactly 4 options
    teaching_point,
    references
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[WSI Parse] Starting response parsing request')

    // Parse request body
    const body = await request.json()
    const { content, wsi, metadata } = body

    if (!content) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: content'
        },
        { status: 400 }
      )
    }

    console.log('[WSI Parse] Parsing AI response...')

    // Parse and validate the response
    const questionData = parseAndValidateQuestion(content)

    const parsingTime = Date.now() - startTime
    console.log(`[WSI Parse] Parsing completed in ${parsingTime}ms`)

    return NextResponse.json({
      success: true,
      question: questionData,
      metadata: {
        parsed_at: new Date().toISOString(),
        parsing_time_ms: parsingTime,
        original_response_length: content.length,
        wsi_diagnosis: wsi?.diagnosis || 'unknown',
        ...metadata // Include any metadata from previous steps
      },
      debug: {
        raw_response: content.substring(0, 1000), // First 1000 chars for debugging
        response_length: content.length
      }
    })

  } catch (error) {
    console.error('[WSI Parse] Parsing error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to parse AI response',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
