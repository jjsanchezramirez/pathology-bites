import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { getR2FileInfo, extractR2KeyFromUrl } from '@/shared/services/r2-storage'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Verify user is authenticated admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { error: 'You must be logged in to access file info' },
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
        { error: 'Only administrators can access file info' },
        { status: 403 }
      )
    }

    // Parse request body
    const { filePathOrUrl } = await request.json()

    if (!filePathOrUrl) {
      return NextResponse.json(
        { error: 'File path or URL is required' },
        { status: 400 }
      )
    }

    // Try to extract R2 key from URL first (for migrated images)
    const r2Key = extractR2KeyFromUrl(filePathOrUrl)

    if (r2Key) {
      // Get file info from R2
      const r2FileInfo = await getR2FileInfo(r2Key)
      if (r2FileInfo && r2FileInfo.exists) {
        return NextResponse.json({
          success: true,
          fileInfo: {
            name: r2Key.split('/').pop() || r2Key,
            size: r2FileInfo.size,
            mimetype: r2FileInfo.contentType,
            lastModified: r2FileInfo.lastModified.toISOString(),
            source: 'r2'
          }
        })
      }
    } else {
      // Fallback: try legacy Supabase Storage for non-migrated images
      const fileName = filePathOrUrl.split('/').pop() || filePathOrUrl

      const { data: files, error } = await supabase.storage
        .from('images')
        .list('', {
          search: fileName
        })

      if (error) {
        return NextResponse.json(
          { error: 'Failed to access storage' },
          { status: 500 }
        )
      }

      const file = files?.find(f => f.name === fileName)
      if (file) {
        return NextResponse.json({
          success: true,
          fileInfo: {
            name: file.name,
            size: file.metadata?.size || 0,
            mimetype: file.metadata?.mimetype || 'application/octet-stream',
            lastModified: file.updated_at || file.created_at || new Date().toISOString(),
            source: 'supabase'
          }
        })
      }
    }

    return NextResponse.json(
      { error: 'File not found' },
      { status: 404 }
    )

  } catch (error) {
    console.error('File info error:', error)
    return NextResponse.json(
      { error: 'Failed to get file info' },
      { status: 500 }
    )
  }
}
