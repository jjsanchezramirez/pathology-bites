import { NextRequest, NextResponse } from 'next/server'
import r2StorageService from '@/shared/services/r2-storage'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bucket = searchParams.get('bucket')
    const key = searchParams.get('key')

    if (!bucket || !key) {
      return NextResponse.json(
        { error: 'Bucket and key parameters are required' },
        { status: 400 }
      )
    }

    // Get the file content from R2
    const fileContent = await r2StorageService.getFileContent(bucket as any, key)
    
    if (!fileContent) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Return the file content as JSON if it's a JSON file
    if (key.endsWith('.json')) {
      const textContent = new TextDecoder().decode(fileContent)
      try {
        const jsonContent = JSON.parse(textContent)
        return NextResponse.json(jsonContent)
      } catch (e) {
        return NextResponse.json({ raw_text: textContent })
      }
    }

    // For other files, return as blob
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${key}"`
      }
    })

  } catch (error) {
    console.error('Error downloading file:', error)
    return NextResponse.json(
      { error: 'Failed to download file' },
      { status: 500 }
    )
  }
}