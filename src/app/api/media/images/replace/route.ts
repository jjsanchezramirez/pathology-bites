import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { uploadToR2, deleteFromR2 } from '@/shared/services/r2-storage'
import { formatImageName } from '@/features/images/services/image-upload'
import { getImageDimensionsFromFile } from '@/shared/utils/server-image-utils'

export async function POST(request: NextRequest) {
  console.log('🔄 Image replace API called');

  try {
    const supabase = await createClient()

    // Verify user is authenticated admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to replace images' },
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
        { error: 'Only administrators can replace images' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const imageId = formData.get('imageId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Get existing image record
    console.log('🔍 Fetching existing image record...')
    const { data: existingImage, error: fetchError } = await supabase
      .from('images')
      .select('*')
      .eq('id', imageId)
      .single()
      
    console.log('📄 Existing image fetch result:', {
      hasData: !!existingImage,
      error: fetchError?.message,
      imageData: existingImage ? {
        id: existingImage.id,
        storage_path: existingImage.storage_path,
        file_type: existingImage.file_type
      } : null
    })

    if (fetchError || !existingImage) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      )
    }

    // Get new image dimensions
    console.log('📐 Processing image dimensions...')
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    console.log('📦 File buffer created, size:', fileBuffer.length)
    
    const dimensions = await getImageDimensionsFromFile(file)
    console.log('📐 Dimensions obtained:', dimensions)

    // Upload new file to same R2 path (this will overwrite the existing file)
    const uploadResult = await uploadToR2(fileBuffer, existingImage.storage_path, {
      contentType: file.type,
      cacheControl: '3600',
      metadata: {
        originalName: file.name,
        category: existingImage.category,
        replacedBy: user.id,
        replacedAt: new Date().toISOString(),
        previousFileType: existingImage.file_type
      }
    })

    // Prepare update data (use actual file buffer size, not original file.size)
    const updateData: any = {
      url: uploadResult.url,
      file_type: file.type,
      file_size_bytes: fileBuffer.length, // Use actual uploaded file size
      width: dimensions.width,
      height: dimensions.height
    }

    // Get updateMetadata from form data
    const updateMetadata = formData.get('updateMetadata') === 'true'

    // If updateMetadata is true, also update alt_text and description based on new filename
    if (updateMetadata) {
      const newName = formatImageName(file.name)
      updateData.alt_text = newName
      // Only update description if it matches the old formatted name
      const oldFormattedName = formatImageName(existingImage.storage_path?.split('/').pop() || '')
      if (existingImage.description === oldFormattedName || !existingImage.description?.trim()) {
        updateData.description = newName
      }
    }

    // Update database record
    const { data: updatedImage, error: dbError } = await supabase
      .from('images')
      .update(updateData)
      .eq('id', imageId)
      .select()
      .single()

    if (dbError) {
      console.error('Database update error:', dbError)
      return NextResponse.json(
        { error: 'Failed to update image record' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Image replaced successfully',
      image: updatedImage,
      metadata: {
        oldFileType: existingImage.file_type,
        newFileType: file.type,
        oldSize: existingImage.file_size_bytes,
        newSize: file.size,
        oldDimensions: `${existingImage.width}x${existingImage.height}`,
        newDimensions: `${dimensions.width}x${dimensions.height}`
      }
    })

  } catch (error) {
    console.error('Image replacement error:', error)
    
    // More detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        message: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    )
  }
}