// src/app/api/debug/anki-media-organize/route.ts
/**
 * API endpoint for organizing Anki media files into anki/ subfolder
 * Moves all Anki media files from root level to anki/ subfolder within pathology-bites-images bucket
 * Debug endpoint - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { listR2Files, moveR2Object } from '@/shared/services/r2-storage'

// Supported image file extensions for Anki media
const ANKI_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp']

interface OrganizeProgress {
  phase: string
  processed: number
  total: number
  moved: number
  errors: string[]
  currentBatch?: number
  totalBatches?: number
}

export async function POST(request: NextRequest) {
  try {
    const targetBucket = 'pathology-bites-images'
    const sourcePrefix = '' // Root level files
    const destinationPrefix = 'anki/' // Move to anki subfolder
    
    console.log('🚀 Starting Anki media organization to anki/ subfolder...')
    
    const progress: OrganizeProgress = {
      phase: 'listing',
      processed: 0,
      total: 0,
      moved: 0,
      errors: []
    }

    // Phase 1: List all files that need to be moved
    console.log('📋 Phase 1: Listing files to organize...')
    const filesToMove: string[] = []
    let continuationToken: string | undefined
    let hasMore = true

    while (hasMore) {
      try {
        const result = await listR2Files({
          bucket: targetBucket,
          maxKeys: 1000,
          continuationToken,
          prefix: sourcePrefix
        })

        // Filter for Anki media files (exclude files already in anki/ subfolder)
        const ankiFiles = result.files.filter(file => {
          const key = file.key
          const extension = key.substring(key.lastIndexOf('.')).toLowerCase()
          
          // Include if:
          // 1. Has supported extension
          // 2. Not already in anki/ subfolder
          // 3. Looks like an Anki media file (has hash or is a paste/screenshot)
          return ANKI_EXTENSIONS.includes(extension) && 
                 !key.startsWith('anki/') &&
                 (key.includes('-') || key.startsWith('paste') || key.startsWith('Screenshot'))
        })

        filesToMove.push(...ankiFiles.map(f => f.key))
        hasMore = result.isTruncated
        continuationToken = result.nextContinuationToken

        console.log(`📋 Listed batch: ${ankiFiles.length} Anki files found, total so far: ${filesToMove.length}`)
      } catch (error) {
        console.error('Error listing files:', error)
        return NextResponse.json({
          error: 'Failed to list files for organization',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
      }
    }

    progress.total = filesToMove.length
    progress.phase = 'moving'

    if (filesToMove.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No Anki media files found to organize',
        progress: {
          ...progress,
          phase: 'completed'
        }
      })
    }

    console.log(`📦 Found ${filesToMove.length} Anki media files to organize`)

    // Phase 2: Move files in batches
    console.log('🔄 Phase 2: Moving files to anki/ subfolder...')
    const batchSize = 100 // Smaller batches for better progress tracking
    const totalBatches = Math.ceil(filesToMove.length / batchSize)
    progress.totalBatches = totalBatches

    for (let i = 0; i < filesToMove.length; i += batchSize) {
      const batch = filesToMove.slice(i, i + batchSize)
      const batchNumber = Math.floor(i / batchSize) + 1
      progress.currentBatch = batchNumber

      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)`)

      // Process batch
      for (const sourceKey of batch) {
        try {
          const destinationKey = `${destinationPrefix}${sourceKey}`
          
          // Move the file
          await moveR2Object(sourceKey, destinationKey, targetBucket)
          progress.moved++
          
          console.log(`✅ Moved: ${sourceKey} → ${destinationKey}`)
        } catch (error) {
          const errorMsg = `Failed to move ${sourceKey}: ${error}`
          console.error(`❌ ${errorMsg}`)
          progress.errors.push(errorMsg)
        }
        
        progress.processed++
      }

      // Log batch completion
      console.log(`✅ Batch ${batchNumber}/${totalBatches} completed: ${progress.moved} moved, ${progress.errors.length} errors`)
    }

    progress.phase = 'completed'

    const summary = {
      success: true,
      message: `Anki media organization completed`,
      results: {
        totalFiles: progress.total,
        movedFiles: progress.moved,
        errorCount: progress.errors.length,
        successRate: Math.round((progress.moved / progress.total) * 100),
        newLocation: `${targetBucket}/anki/`,
        urlPattern: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/anki/{filename}'
      },
      progress,
      errors: progress.errors.slice(0, 10) // Limit error list in response
    }

    console.log('🎉 Anki media organization completed!')
    console.log(`📊 Results: ${progress.moved}/${progress.total} files moved (${Math.round((progress.moved / progress.total) * 100)}% success rate)`)
    
    if (progress.errors.length > 0) {
      console.log(`⚠️  ${progress.errors.length} errors occurred during organization`)
    }

    return NextResponse.json(summary, {
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Anki media organization error:', error)
    return NextResponse.json({
      error: 'Failed to organize Anki media files',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to preview what files would be organized
export async function GET(request: NextRequest) {
  try {
    const targetBucket = 'pathology-bites-images'
    
    console.log('🔍 Previewing Anki media files for organization...')
    
    // List files that would be moved
    const filesToMove: string[] = []
    let continuationToken: string | undefined
    let hasMore = true

    while (hasMore) {
      const result = await listR2Files({
        bucket: targetBucket,
        maxKeys: 1000,
        continuationToken,
        prefix: ''
      })

      const ankiFiles = result.files.filter(file => {
        const key = file.key
        const extension = key.substring(key.lastIndexOf('.')).toLowerCase()
        
        return ANKI_EXTENSIONS.includes(extension) && 
               !key.startsWith('anki/') &&
               (key.includes('-') || key.startsWith('paste') || key.startsWith('Screenshot'))
      })

      filesToMove.push(...ankiFiles.map(f => f.key))
      hasMore = result.isTruncated
      continuationToken = result.nextContinuationToken
    }

    return NextResponse.json({
      preview: true,
      message: `Found ${filesToMove.length} Anki media files to organize`,
      filesToMove: filesToMove.slice(0, 20), // Show first 20 as preview
      totalCount: filesToMove.length,
      targetLocation: 'anki/',
      newUrlPattern: 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/anki/{filename}'
    })

  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json({
      error: 'Failed to preview organization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
