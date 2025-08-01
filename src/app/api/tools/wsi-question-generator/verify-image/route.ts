import { NextRequest, NextResponse } from 'next/server'

// Types
interface ImageVerificationResult {
  accessible: boolean
  status_code?: number
  content_type?: string
  content_length?: number
  response_time_ms: number
  error?: string
}

// Verify WSI image accessibility
async function verifyImageAccessibility(imageUrl: string): Promise<ImageVerificationResult> {
  const startTime = Date.now()
  
  try {
    console.log(`[Image Verify] Checking accessibility of: ${imageUrl}`)

    // Basic URL validation
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return {
        accessible: false,
        response_time_ms: Date.now() - startTime,
        error: 'Invalid URL format'
      }
    }

    // Make HEAD request to check accessibility without downloading full image
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      const response = await fetch(imageUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'PathologyBites-WSI-Verifier/1.0'
        }
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      console.log(`[Image Verify] Response: ${response.status} in ${responseTime}ms`)

      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'unknown'
        const contentLength = response.headers.get('content-length')
        
        return {
          accessible: true,
          status_code: response.status,
          content_type: contentType,
          content_length: contentLength ? parseInt(contentLength) : undefined,
          response_time_ms: responseTime
        }
      } else {
        return {
          accessible: false,
          status_code: response.status,
          response_time_ms: responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

    } catch (fetchError) {
      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return {
          accessible: false,
          response_time_ms: responseTime,
          error: 'Request timeout (5s)'
        }
      }

      return {
        accessible: false,
        response_time_ms: responseTime,
        error: fetchError instanceof Error ? fetchError.message : 'Network error'
      }
    }

  } catch (error) {
    const responseTime = Date.now() - startTime
    console.error('[Image Verify] Verification error:', error)
    
    return {
      accessible: false,
      response_time_ms: responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Extract image metadata and embedding information
function extractImageMetadata(imageUrl: string, verificationResult: ImageVerificationResult) {
  const metadata = {
    url: imageUrl,
    accessible: verificationResult.accessible,
    verification: verificationResult
  }

  // Extract additional metadata from URL if possible
  try {
    const url = new URL(imageUrl)
    const pathParts = url.pathname.split('/')
    
    // Try to extract repository and slide ID from URL structure
    const repository = url.hostname
    const filename = pathParts[pathParts.length - 1]
    
    return {
      ...metadata,
      repository: repository,
      filename: filename,
      protocol: url.protocol,
      host: url.host,
      path: url.pathname
    }
  } catch (urlError) {
    console.warn('[Image Verify] Could not parse URL for metadata:', urlError)
    return metadata
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    console.log('[Image Verify] Starting image verification request')

    // Parse request body
    const body = await request.json()
    const { imageUrl, thumbnailUrl } = body

    if (!imageUrl) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameter: imageUrl'
        },
        { status: 400 }
      )
    }

    console.log(`[Image Verify] Verifying image: ${imageUrl}`)

    // Verify main image
    const imageVerification = await verifyImageAccessibility(imageUrl)
    
    // Verify thumbnail if provided
    let thumbnailVerification = null
    if (thumbnailUrl) {
      console.log(`[Image Verify] Verifying thumbnail: ${thumbnailUrl}`)
      thumbnailVerification = await verifyImageAccessibility(thumbnailUrl)
    }

    // Extract metadata
    const imageMetadata = extractImageMetadata(imageUrl, imageVerification)
    const thumbnailMetadata = thumbnailUrl ? extractImageMetadata(thumbnailUrl, thumbnailVerification!) : null

    const totalTime = Date.now() - startTime
    console.log(`[Image Verify] Image verification completed in ${totalTime}ms`)

    const result = {
      success: true,
      image: imageMetadata,
      thumbnail: thumbnailMetadata,
      metadata: {
        verified_at: new Date().toISOString(),
        verification_time_ms: totalTime,
        main_image_accessible: imageVerification.accessible,
        thumbnail_accessible: thumbnailVerification?.accessible || null
      }
    }

    return NextResponse.json(result, { 
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'Pragma': 'cache',
      }
    })
    
  } catch (error) {
    console.error('[Image Verify] Error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to verify image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
