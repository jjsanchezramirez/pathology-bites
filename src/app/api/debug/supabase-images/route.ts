import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Database } from '@/shared/types/supabase'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

    // Query all images from public.images table
    const { data: images, error } = await supabase
      .from('images')
      .select('id, url, storage_path, alt_text, description, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching images:', error)
      return NextResponse.json(
        { error: 'Failed to fetch images' },
        { status: 500 }
      )
    }

    // Extract filenames for the reorganizer script
    const imageInfo = images.map(image => {
      let filename = null
      
      // Try to extract filename from storage_path first
      if (image.storage_path) {
        filename = image.storage_path.split('/').pop()
      } else if (image.url) {
        // Extract from URL as fallback
        const urlParts = image.url.split('/')
        filename = urlParts[urlParts.length - 1]
        
        // Remove query parameters if present
        if (filename.includes('?')) {
          filename = filename.split('?')[0]
        }
      }
      
      return {
        id: image.id,
        filename: filename,
        url: image.url,
        storage_path: image.storage_path,
        alt_text: image.alt_text,
        description: image.description,
        created_at: image.created_at
      }
    })

    // Filter out any images without valid filenames
    const validImages = imageInfo.filter(img => img.filename && img.filename.length > 0)

    return NextResponse.json({
      success: true,
      total_images: images.length,
      valid_images: validImages.length,
      images: validImages,
      filenames: validImages.map(img => img.filename),
      summary: {
        total_records: images.length,
        with_storage_path: images.filter(img => img.storage_path).length,
        with_url_only: images.filter(img => !img.storage_path && img.url).length,
        valid_filenames: validImages.length
      }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}