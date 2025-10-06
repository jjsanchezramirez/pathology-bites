/**
 * API endpoint for R2 file reorganization
 * Performs the requested folder restructuring operations
 * Debug endpoint - requires admin authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { moveR2Folder, listR2Files } from '@/shared/services/r2-storage'

interface ReorganizationOperation {
  type: 'rename_folder' | 'flatten_folder'
  sourcePrefix: string
  destinationPrefix: string
  description: string
}

const REORGANIZATION_OPERATIONS: ReorganizationOperation[] = [
  {
    type: 'rename_folder',
    sourcePrefix: 'images/',
    destinationPrefix: 'private/',
    description: 'Rename images/ folder to private/'
  },
  {
    type: 'rename_folder',
    sourcePrefix: 'static/',
    destinationPrefix: 'public/',
    description: 'Rename static/ folder to public/'
  },
  {
    type: 'flatten_folder',
    sourcePrefix: 'public/images/',
    destinationPrefix: 'public/',
    description: 'Flatten public/images/ contents into public/'
  }
]

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication for debug endpoints
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userError || !userData || !['admin', 'creator'].includes(userData.role)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { operation, dryRun = true } = await request.json()

    // If no specific operation, return available operations
    if (!operation) {
      return NextResponse.json({
        availableOperations: REORGANIZATION_OPERATIONS,
        message: 'Specify an operation index (0-2) to execute, or "all" to run all operations'
      })
    }

    const bucket = 'pathology-bites-images'
    const results = []

    // Determine which operations to run
    let operationsToRun: ReorganizationOperation[] = []
    
    if (operation === 'all') {
      operationsToRun = REORGANIZATION_OPERATIONS
    } else if (typeof operation === 'number' && operation >= 0 && operation < REORGANIZATION_OPERATIONS.length) {
      operationsToRun = [REORGANIZATION_OPERATIONS[operation]]
    } else {
      return NextResponse.json(
        { error: 'Invalid operation. Use 0-2 for specific operations or "all" for all operations' },
        { status: 400 }
      )
    }

    // Execute operations
    for (const op of operationsToRun) {
      try {
        console.log(`\n=== ${op.description} ===`)
        
        if (dryRun) {
          // Dry run - just list what would be affected
          const listResult = await listR2Files({
            prefix: op.sourcePrefix,
            maxKeys: 1000,
            bucket
          })

          results.push({
            operation: op.description,
            dryRun: true,
            filesFound: listResult.files.length,
            sampleFiles: listResult.files.slice(0, 5).map(f => ({
              current: f.key,
              newPath: f.key.replace(op.sourcePrefix, op.destinationPrefix)
            })),
            totalFiles: listResult.files.length
          })
        } else {
          // Actual execution
          const moveResult = await moveR2Folder(op.sourcePrefix, op.destinationPrefix, bucket)
          
          results.push({
            operation: op.description,
            dryRun: false,
            moved: moveResult.moved,
            errors: moveResult.errors,
            success: moveResult.errors.length === 0
          })
        }
      } catch (error) {
        const errorMsg = `Failed to execute ${op.description}: ${error}`
        console.error(errorMsg)
        results.push({
          operation: op.description,
          error: errorMsg,
          success: false
        })
      }
    }

    return NextResponse.json({
      dryRun,
      bucket,
      results,
      summary: {
        totalOperations: operationsToRun.length,
        successful: results.filter(r => r.success !== false).length,
        failed: results.filter(r => r.success === false).length
      }
    })

  } catch (error) {
    console.error('R2 reorganization API error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to execute reorganization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bucket = searchParams.get('bucket') || 'pathology-bites-images'

    // Get current folder structure
    const folders = ['images/', 'static/', 'public/', 'logos/', 'private/']
    const folderInfo = []

    for (const folder of folders) {
      try {
        const listResult = await listR2Files({
          prefix: folder,
          maxKeys: 10,
          bucket
        })

        folderInfo.push({
          folder,
          exists: listResult.files.length > 0,
          fileCount: listResult.files.length,
          sampleFiles: listResult.files.slice(0, 3).map(f => f.key)
        })
      } catch (error) {
        folderInfo.push({
          folder,
          exists: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      bucket,
      currentStructure: folderInfo,
      plannedOperations: REORGANIZATION_OPERATIONS,
      message: 'Use POST request to execute reorganization operations'
    })

  } catch (error) {
    console.error('R2 reorganization status error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get reorganization status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
