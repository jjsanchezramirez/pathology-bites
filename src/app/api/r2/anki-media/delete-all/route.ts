// src/app/api/r2/anki-media/delete-all/route.ts
/**
 * API endpoint for bulk deleting all files in the Anki Media bucket
 * Provides progress feedback and comprehensive error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { listR2Files, bulkDeleteFromR2 } from '@/shared/services/r2-storage'

interface DeleteAllResponse {
  success: boolean
  totalFiles: number
  deletedFiles: number
  errors: string[]
  progress: {
    phase: 'listing' | 'deleting' | 'complete'
    processed: number
    total: number
  }
}

export async function POST(request: NextRequest) {
  try {
    const ankiBucket = 'pathology-bites-anki'
    
    // Phase 1: List all files in the Anki bucket
    console.log('Starting bulk delete for Anki Media bucket...')

    const allFiles = []
    let continuationToken: string | undefined
    let hasMore = true

    while (hasMore) {
      try {
        const result = await listR2Files({
          bucket: ankiBucket,
          maxKeys: 1000, // Maximum page size
          continuationToken,
          prefix: '' // Get all files
        })

        allFiles.push(...result.files)
        hasMore = result.isTruncated
        continuationToken = result.nextContinuationToken

        console.log(`Listed batch, found ${result.files.length} files`)
      } catch (error) {
        console.error(`Error listing files:`, error)
        break
      }
    }

    const totalFiles = allFiles.length
    console.log(`Found ${totalFiles} total files to delete`)

    if (totalFiles === 0) {
      return NextResponse.json({
        success: true,
        totalFiles: 0,
        deletedFiles: 0,
        errors: [],
        progress: {
          phase: 'complete',
          processed: 0,
          total: 0
        }
      })
    }

    // Phase 2: Bulk delete all files
    const fileKeys = allFiles.map(file => file.key)
    const errors: string[] = []
    let deletedCount = 0

    try {
      const deleteResult = await bulkDeleteFromR2(fileKeys, ankiBucket)
      deletedCount = deleteResult.deleted.length
      errors.push(...deleteResult.errors)
      
      console.log(`Successfully deleted ${deletedCount} files`)
      if (deleteResult.errors.length > 0) {
        console.warn(`Encountered ${deleteResult.errors.length} errors during deletion`)
      }
    } catch (error) {
      console.error('Bulk delete operation failed:', error)
      errors.push(`Bulk delete failed: ${error}`)
    }

    const response: DeleteAllResponse = {
      success: deletedCount > 0,
      totalFiles,
      deletedFiles: deletedCount,
      errors,
      progress: {
        phase: 'complete',
        processed: deletedCount,
        total: totalFiles
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache',
        'X-Total-Files': totalFiles.toString(),
        'X-Deleted-Files': deletedCount.toString()
      }
    })

  } catch (error) {
    console.error('Delete all Anki media error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to delete Anki media files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
