import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { uploadToR2, generateImageStoragePath, deleteFromR2 } from '@/shared/services/r2-storage'
import { formatImageName } from '@/features/images/services/image-upload'
import { getImageDimensionsFromFile } from '@/shared/utils/server-image-utils'

export async function POST(request: NextRequest) {
  let uploadedStoragePath: string | null = null

  try {
    const supabase = await createClient()

    // Verify user is authenticated admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in to upload images.' },
        { status: 401 }
      )
    }

    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (roleError || !userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Administrator privileges required to upload images.' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string
    const sourceRef = formData.get('sourceRef') as string | null
    const description = formData.get('description') as string | null

    // Validation: File presence
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Please select an image to upload.' },
        { status: 400 }
      )
    }

    // Validation: Category
    if (!category) {
      return NextResponse.json(
        { error: 'Image category is required.' },
        { status: 400 }
      )
    }

    const validCategories = ['microscopic', 'gross', 'figure', 'table']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      )
    }

    // Validation: File type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only image files are allowed.' },
        { status: 400 }
      )
    }

    // Validation: File size (max 10MB before compression)
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.` },
        { status: 400 }
      )
    }

    // Validation: File name
    if (!file.name || file.name.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid file name.' },
        { status: 400 }
      )
    }

    // Get image dimensions and buffer
    let fileBuffer: Buffer
    let dimensions: { width: number; height: number }

    try {
      fileBuffer = Buffer.from(await file.arrayBuffer())
    } catch (error) {
      console.error('Failed to read file buffer:', error)
      return NextResponse.json(
        { error: 'Failed to read image file. The file may be corrupted.' },
        { status: 400 }
      )
    }

    try {
      dimensions = await getImageDimensionsFromFile(file)
    } catch (error) {
      console.error('Failed to get image dimensions:', error)
      return NextResponse.json(
        { error: 'Failed to read image dimensions. The file may not be a valid image.' },
        { status: 400 }
      )
    }

    // Validation: Image dimensions (reasonable limits)
    const MAX_DIMENSION = 10000
    if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
      return NextResponse.json(
        { error: `Image dimensions too large. Maximum ${MAX_DIMENSION}x${MAX_DIMENSION} pixels.` },
        { status: 400 }
      )
    }

    if (dimensions.width < 1 || dimensions.height < 1) {
      return NextResponse.json(
        { error: 'Invalid image dimensions.' },
        { status: 400 }
      )
    }

    // Generate R2 storage path
    const storagePath = generateImageStoragePath(file.name, category)
    uploadedStoragePath = storagePath // Track for cleanup

    // Step 1: Upload to R2
    let uploadResult
    try {
      uploadResult = await uploadToR2(fileBuffer, storagePath, {
        contentType: file.type,
        cacheControl: '3600',
        metadata: {
          originalName: file.name,
          category,
          uploadedBy: user.id,
          uploadedAt: new Date().toISOString()
        }
      })
    } catch (error) {
      console.error('R2 upload failed:', error)
      uploadedStoragePath = null // Reset since upload failed
      return NextResponse.json(
        { error: 'Failed to upload image to storage. Please try again.' },
        { status: 500 }
      )
    }

    // Step 2: Insert database record with metadata
    const { data: imageData, error: dbError } = await supabase
      .from('images')
      .insert({
        url: uploadResult.url,
        storage_path: storagePath,
        description: description?.trim() || formatImageName(file.name),
        alt_text: formatImageName(file.name),
        category,
        file_type: file.type,
        file_size_bytes: fileBuffer.length, // Use actual buffer size
        width: dimensions.width,
        height: dimensions.height,
        source_ref: sourceRef?.trim() || null,
        created_by: user.id
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert failed:', dbError)

      // CRITICAL: Clean up R2 storage on database error to prevent orphaned files
      try {
        console.log('Cleaning up R2 file after database error:', storagePath)
        await deleteFromR2(storagePath)
        console.log('R2 cleanup successful')
      } catch (cleanupError) {
        console.error('CRITICAL: Failed to cleanup R2 file after database error:', cleanupError)
        console.error('Orphaned file at:', storagePath)
      }

      uploadedStoragePath = null // Reset since we cleaned up

      return NextResponse.json(
        { error: `Failed to save image metadata: ${dbError.message || 'Unknown database error'}` },
        { status: 500 }
      )
    }

    // Success! Clear the tracking variable
    uploadedStoragePath = null

    return NextResponse.json({
      success: true,
      image: imageData,
      uploadResult: {
        url: uploadResult.url,
        key: uploadResult.key,
        size: uploadResult.size,
        contentType: uploadResult.contentType
      }
    })

  } catch (error) {
    console.error('Image upload error:', error)

    // If we have an uploaded file that wasn't saved to database, clean it up
    if (uploadedStoragePath) {
      try {
        console.log('Cleaning up orphaned R2 file after unexpected error:', uploadedStoragePath)
        await deleteFromR2(uploadedStoragePath)
        console.log('Emergency R2 cleanup successful')
      } catch (cleanupError) {
        console.error('CRITICAL: Failed emergency cleanup of R2 file:', cleanupError)
        console.error('Orphaned file at:', uploadedStoragePath)
      }
    }

    // Provide user-friendly error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { error: `Upload failed: ${errorMessage}. Please try again.` },
      { status: 500 }
    )
  }
}
