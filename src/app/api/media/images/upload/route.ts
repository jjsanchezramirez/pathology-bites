import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { uploadToR2, generateImageStoragePath, deleteFromR2 } from '@/shared/services/r2-storage'
import { formatImageName } from '@/features/images/services/image-upload'
import { getImageDimensionsFromFile } from '@/shared/utils/server-image-utils'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to upload images' },
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
        { error: 'Only administrators can upload images' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string
    const sourceRef = formData.get('sourceRef') as string | null
    const description = formData.get('description') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!category) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Get image dimensions
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const dimensions = await getImageDimensionsFromFile(file)

    // Generate R2 storage path
    const storagePath = generateImageStoragePath(file.name, category)

    // Upload to R2
    const uploadResult = await uploadToR2(fileBuffer, storagePath, {
      contentType: file.type,
      cacheControl: '3600',
      metadata: {
        originalName: file.name,
        category,
        uploadedBy: user.id,
        uploadedAt: new Date().toISOString()
      }
    })

    // Insert database record with metadata
    const { data: imageData, error: dbError } = await supabase
      .from('images')
      .insert({
        url: uploadResult.url,
        storage_path: storagePath,
        description: description?.trim() || formatImageName(file.name),
        alt_text: formatImageName(file.name),
        category,
        file_type: file.type,
        file_size_bytes: file.size,
        width: dimensions.width,
        height: dimensions.height,
        source_ref: sourceRef?.trim() || null,
        created_by: user.id
      })
      .select()
      .single()

    if (dbError) {
      // Clean up R2 storage on database error
      try {
        await deleteFromR2(storagePath)
      } catch (cleanupError) {
        console.warn('Failed to cleanup R2 file after database error:', cleanupError)
      }
      
      return NextResponse.json(
        { error: 'Failed to save image metadata' },
        { status: 500 }
      )
    }

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
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}
