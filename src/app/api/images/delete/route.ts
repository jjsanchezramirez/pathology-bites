import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { deleteFromR2, extractR2KeyFromUrl } from '@/shared/services/r2-storage'

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to delete images' },
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
        { error: 'Only administrators can delete images' },
        { status: 403 }
      )
    }

    // Parse request body
    const { imageId, imagePath } = await request.json()

    if (!imageId) {
      return NextResponse.json(
        { error: 'Image ID is required' },
        { status: 400 }
      )
    }

    // Get image details to determine storage location
    const { data: imageData, error: fetchError } = await supabase
      .from('images')
      .select('url, storage_path, category')
      .eq('id', imageId)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch image details' },
        { status: 404 }
      )
    }

    // Only delete from storage if it's not an external image
    if (imageData && imageData.category !== 'external') {
      try {
        // Try to extract R2 key from URL first (for migrated images)
        const r2Key = extractR2KeyFromUrl(imageData.url)
        if (r2Key) {
          await deleteFromR2(r2Key)
        } else if (imagePath || imageData.storage_path) {
          // Fallback: use storage_path or imagePath for legacy images
          const keyToDelete = imagePath || imageData.storage_path
          if (keyToDelete) {
            await deleteFromR2(keyToDelete)
          }
        }
      } catch (storageError) {
        console.warn('R2 deletion error (continuing with database deletion):', storageError)
        // Continue with database deletion even if R2 deletion fails
      }
    }

    // Delete the database record
    const { error: dbError } = await supabase
      .from('images')
      .delete()
      .eq('id', imageId)

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to delete image from database' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    })

  } catch (error) {
    console.error('Image deletion error:', error)
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}
