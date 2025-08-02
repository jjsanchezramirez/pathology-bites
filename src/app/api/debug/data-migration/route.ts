// src/app/api/debug/data-migration/route.ts
/**
 * Debug API for testing data file migration status and accessibility
 * Tests local data files vs R2 data files
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { getR2FileInfo, getR2PublicUrl } from '@/shared/services/r2-storage'

export async function GET(request: NextRequest) {
  try {
    // Production check
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Debug endpoints disabled in production' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'status'

    switch (action) {
      case 'status':
        return await getDataMigrationStatus()
      case 'test-file':
        const fileName = searchParams.get('file')
        if (!fileName) {
          return NextResponse.json(
            { error: 'Missing file parameter' },
            { status: 400 }
          )
        }
        return await testDataFile(fileName)
      case 'list-files':
        return await listDataFiles()
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: status, test-file, list-files' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Data migration debug error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Get overall data migration status
 */
async function getDataMigrationStatus() {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    
    // Check if local data directory exists
    let localFiles: string[] = []
    let localDirExists = false
    
    try {
      const files = await fs.readdir(dataDir, { recursive: true })
      localFiles = files.filter(file => 
        typeof file === 'string' && file.endsWith('.json')
      ) as string[]
      localDirExists = true
    } catch (error) {
      localDirExists = false
    }

    // Test a few key files in R2
    const keyFiles = [
      'database-schema.json',
      'virtual-slides.json',
      'abpath-content-specs.json',
      'context/ap-general-topics.json'
    ]

    const r2Tests = await Promise.allSettled(
      keyFiles.map(async (file) => {
        const r2Key = `data/${file}`
        const fileInfo = await getR2FileInfo(r2Key)
        const publicUrl = getR2PublicUrl(r2Key)
        
        return {
          file,
          r2Key,
          exists: fileInfo?.exists || false,
          size: fileInfo?.size || 0,
          publicUrl,
          lastModified: fileInfo?.lastModified
        }
      })
    )

    const r2Results = r2Tests.map((result, index) => {
      const baseResult = result.status === 'fulfilled' ? result.value : { error: result.reason }
      return {
        ...baseResult,
        file: keyFiles[index]
      }
    })

    const r2FilesExist = r2Results.filter(r => 'exists' in r && r.exists).length
    const migrationComplete = r2FilesExist > 0 && !localDirExists

    return NextResponse.json({
      migrationStatus: {
        localDirectory: {
          exists: localDirExists,
          fileCount: localFiles.length,
          files: localFiles.slice(0, 10) // First 10 files
        },
        r2Storage: {
          keyFilesFound: r2FilesExist,
          totalKeyFiles: keyFiles.length,
          results: r2Results
        },
        assessment: {
          migrationComplete,
          migrationNeeded: localDirExists && r2FilesExist === 0,
          status: migrationComplete ? 'complete' : 
                   r2FilesExist > 0 ? 'partial' : 'not-started'
        }
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Status check failed'
      },
      { status: 500 }
    )
  }
}

/**
 * Test specific data file accessibility
 */
async function testDataFile(fileName: string) {
  try {
    const results = {
      fileName,
      local: null as any,
      r2: null as any,
      comparison: null as any
    }

    // Test local file
    try {
      const localPath = path.join(process.cwd(), 'data', fileName)
      const localContent = await fs.readFile(localPath, 'utf-8')
      const localStats = await fs.stat(localPath)
      
      results.local = {
        exists: true,
        size: localStats.size,
        lastModified: localStats.mtime,
        contentPreview: localContent.substring(0, 200) + (localContent.length > 200 ? '...' : ''),
        isValidJson: (() => {
          try {
            JSON.parse(localContent)
            return true
          } catch {
            return false
          }
        })()
      }
    } catch (error) {
      results.local = {
        exists: false,
        error: error instanceof Error ? error.message : 'File not found'
      }
    }

    // Test R2 file
    try {
      const r2Key = `data/${fileName}`
      const fileInfo = await getR2FileInfo(r2Key)
      const publicUrl = getR2PublicUrl(r2Key)
      
      if (fileInfo?.exists) {
        // Try to fetch content from public URL
        const response = await fetch(publicUrl)
        const r2Content = await response.text()
        
        results.r2 = {
          exists: true,
          size: fileInfo.size,
          lastModified: fileInfo.lastModified,
          publicUrl,
          contentPreview: r2Content.substring(0, 200) + (r2Content.length > 200 ? '...' : ''),
          isValidJson: (() => {
            try {
              JSON.parse(r2Content)
              return true
            } catch {
              return false
            }
          })(),
          httpStatus: response.status
        }
      } else {
        results.r2 = {
          exists: false,
          publicUrl,
          message: 'File not found in R2'
        }
      }
    } catch (error) {
      results.r2 = {
        exists: false,
        error: error instanceof Error ? error.message : 'R2 access failed'
      }
    }

    // Compare results
    if (results.local?.exists && results.r2?.exists) {
      results.comparison = {
        sizesMatch: results.local.size === results.r2.size,
        bothValidJson: results.local.isValidJson && results.r2.isValidJson,
        contentMatches: results.local.contentPreview === results.r2.contentPreview,
        recommendation: 'Both files exist - migration may be complete'
      }
    } else if (results.local?.exists && !results.r2?.exists) {
      results.comparison = {
        recommendation: 'Local file exists but not in R2 - migration needed'
      }
    } else if (!results.local?.exists && results.r2?.exists) {
      results.comparison = {
        recommendation: 'File migrated to R2, local file removed - migration complete'
      }
    } else {
      results.comparison = {
        recommendation: 'File not found in either location - may not exist'
      }
    }

    return NextResponse.json({
      fileTest: results,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'File test failed',
        fileName
      },
      { status: 500 }
    )
  }
}

/**
 * List all available data files
 */
async function listDataFiles() {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    
    let localFiles: Array<{name: string, size: number, path: string}> = []
    
    try {
      const files = await fs.readdir(dataDir, { recursive: true, withFileTypes: true })
      
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.json')) {
          const fullPath = path.join(dataDir, file.name)
          const relativePath = path.relative(dataDir, fullPath)
          const stats = await fs.stat(fullPath)
          
          localFiles.push({
            name: file.name,
            path: relativePath,
            size: stats.size
          })
        }
      }
    } catch (error) {
      // Local directory doesn't exist or is inaccessible
    }

    // Calculate total size
    const totalSize = localFiles.reduce((sum, file) => sum + file.size, 0)

    return NextResponse.json({
      dataFiles: {
        localDirectory: path.resolve(dataDir),
        totalFiles: localFiles.length,
        totalSizeBytes: totalSize,
        totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
        files: localFiles.sort((a, b) => a.path.localeCompare(b.path))
      },
      migrationRecommendation: localFiles.length > 0 ? 
        'Run data migration script to move files to R2' : 
        'No local data files found - migration may be complete',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'File listing failed'
      },
      { status: 500 }
    )
  }
}
