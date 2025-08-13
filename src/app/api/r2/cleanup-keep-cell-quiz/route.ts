import { NextResponse } from 'next/server'
import { listR2Files, bulkDeleteFromR2 } from '@/shared/services/r2-storage'

export async function POST() {
  try {
    const bucket = 'pathology-bites-images'
    
    console.log('Starting R2 cleanup - keeping only cell-quiz images...')

    // Phase 1: List all files
    const allFiles = []
    let continuationToken: string | undefined
    let hasMore = true

    while (hasMore) {
      try {
        const result = await listR2Files({
          bucket: bucket,
          maxKeys: 1000,
          continuationToken,
          prefix: ''
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

    console.log(`Found ${allFiles.length} total files`)

    // Phase 2: Filter files to delete (everything except cell-quiz/)
    const filesToDelete = allFiles.filter(file => !file.key.startsWith('cell-quiz/'))
    const filesToKeep = allFiles.filter(file => file.key.startsWith('cell-quiz/'))

    console.log(`Files to keep: ${filesToKeep.length}`)
    console.log(`Files to delete: ${filesToDelete.length}`)

    if (filesToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        totalFiles: allFiles.length,
        keptFiles: filesToKeep.length,
        deletedFiles: 0,
        errors: [],
        message: 'No files to delete'
      })
    }

    // Phase 3: Bulk delete files (except cell-quiz)
    const fileKeysToDelete = filesToDelete.map(file => file.key)
    const errors: string[] = []
    let deletedCount = 0

    try {
      const deleteResult = await bulkDeleteFromR2(fileKeysToDelete, bucket)
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

    const response = {
      success: deletedCount > 0,
      totalFiles: allFiles.length,
      keptFiles: filesToKeep.length,
      deletedFiles: deletedCount,
      errors,
      message: `Cleanup complete: kept ${filesToKeep.length} cell-quiz images, deleted ${deletedCount} other files`
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('R2 cleanup error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to cleanup R2 storage',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}