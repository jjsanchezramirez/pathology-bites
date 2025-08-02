// src/app/api/debug/r2-storage/route.ts
/**
 * Debug API for testing Cloudflare R2 storage functionality
 * Tests R2 connection, file operations, and migration status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getR2FileInfo, getR2PublicUrl, extractR2KeyFromUrl } from '@/shared/services/r2-storage'
import { createClient } from '@/shared/services/server'

export async function GET(request: NextRequest) {
  try {
    // Production check
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Debug endpoints disabled in production' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'

    switch (action) {
      case 'status':
        return await getR2Status()
      case 'test-file':
        const testKey = searchParams.get('key')
        if (!testKey) {
          return NextResponse.json(
            { error: 'Missing key parameter for test-file action' },
            { status: 400 }
          )
        }
        return await testR2File(testKey)
      case 'migration-status':
        return await getMigrationStatus()
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: status, test-file, migration-status' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('R2 debug error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get R2 configuration and connection status
 */
async function getR2Status() {
  const config = {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID ? '***configured***' : 'missing',
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ? '***configured***' : 'missing',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ? '***configured***' : 'missing',
    bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME || 'not configured',
    publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL || 'not configured'
  }

  // Test basic R2 functionality with a known file
  let connectionTest = null
  try {
    // Try to get info for a test file (this will fail gracefully if file doesn't exist)
    const testResult = await getR2FileInfo('test-connection')
    connectionTest = {
      status: 'success',
      message: 'R2 connection successful',
      fileExists: testResult?.exists || false
    }
  } catch (error) {
    connectionTest = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed'
    }
  }

  return NextResponse.json({
    r2Config: config,
    connectionTest,
    timestamp: new Date().toISOString()
  })
}

/**
 * Test R2 file operations
 */
async function testR2File(key: string) {
  try {
    const fileInfo = await getR2FileInfo(key)
    const publicUrl = getR2PublicUrl(key)
    const extractedKey = extractR2KeyFromUrl(publicUrl)

    return NextResponse.json({
      key,
      fileInfo,
      publicUrl,
      extractedKey,
      urlExtractionWorking: extractedKey === key,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'File test failed',
        key 
      },
      { status: 500 }
    )
  }
}

/**
 * Get migration status from database
 */
async function getMigrationStatus() {
  try {
    const supabase = await createClient()

    // Get image statistics
    const { data: imageStats, error: statsError } = await supabase
      .from('images')
      .select('category, url, storage_path')
      .neq('category', 'external')

    if (statsError) {
      throw statsError
    }

    // Analyze URLs to determine migration status
    const r2Images = imageStats?.filter(img => 
      img.url && img.url.includes('r2.dev')
    ) || []

    const supabaseImages = imageStats?.filter(img => 
      img.url && img.url.includes('supabase.co')
    ) || []

    const otherImages = imageStats?.filter(img => 
      img.url && !img.url.includes('r2.dev') && !img.url.includes('supabase.co')
    ) || []

    // Get total file sizes if available
    const { data: sizeData, error: sizeError } = await supabase
      .from('images')
      .select('file_size_bytes')
      .neq('category', 'external')
      .not('file_size_bytes', 'is', null)

    const totalSize = sizeData?.reduce((sum, img) => sum + (img.file_size_bytes || 0), 0) || 0

    return NextResponse.json({
      migrationStatus: {
        totalImages: imageStats?.length || 0,
        r2Images: r2Images.length,
        supabaseImages: supabaseImages.length,
        otherImages: otherImages.length,
        migrationComplete: supabaseImages.length === 0,
        migrationPercentage: imageStats?.length ? 
          Math.round((r2Images.length / imageStats.length) * 100) : 0
      },
      storage: {
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100
      },
      sampleUrls: {
        r2: r2Images.slice(0, 3).map(img => img.url),
        supabase: supabaseImages.slice(0, 3).map(img => img.url),
        other: otherImages.slice(0, 3).map(img => img.url)
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Migration status check failed'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Production check
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Debug endpoints disabled in production' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { action, ...params } = body

    switch (action) {
      case 'test-upload':
        return await testR2Upload(params)
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: test-upload' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('R2 debug POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Test R2 upload functionality (creates a small test file)
 */
async function testR2Upload(params: any) {
  try {
    const { uploadToR2, deleteFromR2 } = await import('@/shared/services/r2-storage')
    
    const testContent = `R2 Debug Test - ${new Date().toISOString()}`
    const testKey = `debug/test-${Date.now()}.txt`
    
    // Upload test file
    const uploadResult = await uploadToR2(
      Buffer.from(testContent, 'utf-8'),
      testKey,
      {
        contentType: 'text/plain',
        metadata: {
          purpose: 'debug-test',
          createdAt: new Date().toISOString()
        }
      }
    )

    // Verify file exists
    const fileInfo = await getR2FileInfo(testKey)

    // Clean up test file
    await deleteFromR2(testKey)

    return NextResponse.json({
      uploadTest: {
        success: true,
        uploadResult,
        fileInfo,
        cleanupSuccess: true
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        uploadTest: {
          success: false,
          error: error instanceof Error ? error.message : 'Upload test failed'
        }
      },
      { status: 500 }
    )
  }
}
