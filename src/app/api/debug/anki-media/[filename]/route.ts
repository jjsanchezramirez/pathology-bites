// src/app/api/debug/anki-media/[filename]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

// Content type mapping for different file extensions
const CONTENT_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params

    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      )
    }

    console.log(`Loading Anki media file: ${filename} from R2`)

    // Check for sanitized filename (spaces replaced with underscores)
    const sanitizedFilename = filename.replace(/\s+/g, '_')

    // Get the correct public URL from environment
    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev'

    // Try both original and sanitized filenames in anki/ subfolder
    const possibleUrls = [
      `${publicUrl}/anki/${filename}`,
      sanitizedFilename !== filename ? `${publicUrl}/anki/${sanitizedFilename}` : null
    ].filter(Boolean) as string[]

    let imageResponse: Response | null = null
    let usedUrl = ''

    // Try each possible URL
    for (const url of possibleUrls) {
      try {
        const response = await fetch(url)
        if (response.ok) {
          imageResponse = response
          usedUrl = url
          break
        }
      } catch (error) {
        console.log(`Failed to fetch from ${url}:`, error)
        continue
      }
    }

    if (!imageResponse) {
      console.error(`Image not found in R2: ${filename} (tried ${possibleUrls.length} URLs)`)
      return NextResponse.json(
        { error: 'Image not found in R2' },
        { status: 404 }
      )
    }

    // Get the image buffer
    const imageBuffer = await imageResponse.arrayBuffer()

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    const contentType = CONTENT_TYPE_MAP[ext] || 'application/octet-stream'

    return new NextResponse(new Uint8Array(imageBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=31536000', // Aggressive caching: 30d cache, 1y stale
        'CDN-Cache-Control': 'public, max-age=2592000',
        'Vercel-CDN-Cache-Control': 'public, max-age=2592000'
      }
    })
  } catch (error) {
    console.error('Error reading media file from R2:', error)
    return NextResponse.json(
      { error: 'Failed to read file from R2' },
      { status: 500 }
    )
  }
}