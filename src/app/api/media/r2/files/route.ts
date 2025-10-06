// src/app/api/media/r2/files/route.ts
/**
 * API endpoint for listing files in Cloudflare R2 storage
 * Provides file browsing capabilities with pagination, filtering, and search
 * Debug endpoint - no authentication required
 */

import { NextRequest, NextResponse } from 'next/server'
import { listR2Files, getR2FileInfo, type R2FileListItem } from '@/shared/services/r2-storage'

interface PaginationParams {
  page: number
  limit: number
  prefix?: string
  search?: string
  sortBy: 'name' | 'size' | 'lastModified'
  sortOrder: 'asc' | 'desc'
  bucket?: string
}

interface FileListResponse {
  files: R2FileListItem[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
  metadata: {
    prefix?: string
    search?: string
    sortBy: string
    sortOrder: string
    bucketName: string
    timestamp: string
  }
}

export async function GET(request: NextRequest) {
  try {

    const { searchParams } = new URL(request.url)
    
    // Parse and validate pagination parameters
    const sortBy = searchParams.get('sortBy') || 'name'
    const sortOrder = searchParams.get('sortOrder') || 'asc'
    const bucket = searchParams.get('bucket') || undefined

    const params: PaginationParams = {
      page: Math.max(1, parseInt(searchParams.get('page') || '1')),
      limit: Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 1000),
      prefix: searchParams.get('prefix') || undefined,
      search: searchParams.get('search') || undefined,
      sortBy: ['name', 'size', 'lastModified'].includes(sortBy) ? sortBy as 'name' | 'size' | 'lastModified' : 'name',
      sortOrder: ['asc', 'desc'].includes(sortOrder) ? sortOrder as 'asc' | 'desc' : 'asc',
      bucket: bucket
    }

    // For search queries, we need to fetch all files to get accurate results
    // For non-search queries, we can use true pagination
    let allFiles: R2FileListItem[] = []
    let totalItems = 0
    let continuationToken: string | undefined = undefined

    if (params.search) {
      // Search mode: fetch all files to search through them
      let hasMore = true
      while (hasMore) {
        const r2Result = await listR2Files({
          prefix: params.prefix,
          maxKeys: 1000, // Maximum allowed by AWS S3/R2
          continuationToken,
          bucket: params.bucket
        })

        allFiles.push(...r2Result.files)
        hasMore = r2Result.isTruncated
        continuationToken = r2Result.nextContinuationToken

        // Safety break to prevent infinite loops
        if (allFiles.length > 50000) {
          console.warn('Breaking search loop at 50,000 files to prevent timeout')
          break
        }
      }

      // Apply search filter
      const searchLower = params.search.toLowerCase()
      allFiles = allFiles.filter(file =>
        file.key.toLowerCase().includes(searchLower)
      )

      totalItems = allFiles.length
    } else {
      // Non-search mode: fetch enough pages to get the requested page
      const pagesToFetch = Math.ceil((params.page * params.limit) / 1000) + 1
      let fetchedPages = 0

      while (fetchedPages < pagesToFetch) {
        const r2Result = await listR2Files({
          prefix: params.prefix,
          maxKeys: 1000,
          continuationToken,
          bucket: params.bucket
        })

        allFiles.push(...r2Result.files)
        fetchedPages++

        if (!r2Result.isTruncated) {
          // We've reached the end of all files
          totalItems = allFiles.length
          break
        }

        continuationToken = r2Result.nextContinuationToken
      }

      // If we haven't reached the end, estimate total count
      if (continuationToken) {
        // Rough estimation: assume similar file density across all pages
        const avgFilesPerPage = allFiles.length / fetchedPages
        const estimatedTotalPages = Math.ceil(allFiles.length / avgFilesPerPage) * 2 // Conservative estimate
        totalItems = Math.max(allFiles.length, estimatedTotalPages * avgFilesPerPage)
      } else {
        totalItems = allFiles.length
      }
    }

    // Apply sorting
    allFiles.sort((a, b) => {
      let comparison = 0

      switch (params.sortBy) {
        case 'name':
          comparison = a.key.localeCompare(b.key)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'lastModified':
          comparison = a.lastModified.getTime() - b.lastModified.getTime()
          break
      }

      return params.sortOrder === 'desc' ? -comparison : comparison
    })

    // Apply pagination to the sorted results
    const totalPages = Math.ceil(totalItems / params.limit)
    const startIndex = (params.page - 1) * params.limit
    const endIndex = startIndex + params.limit
    const paginatedFiles = allFiles.slice(startIndex, endIndex)

    // Enhance files with content type information for displayed files
    const enhancedFiles = await Promise.all(
      paginatedFiles.map(async (file) => {
        try {
          const fileInfo = await getR2FileInfo(file.key)
          return {
            ...file,
            contentType: fileInfo?.contentType || 'application/octet-stream'
          }
        } catch {
          // If we can't get file info, return the file as-is
          return {
            ...file,
            contentType: 'application/octet-stream'
          }
        }
      })
    )

    const response: FileListResponse = {
      files: enhancedFiles,
      pagination: {
        page: params.page,
        limit: params.limit,
        totalItems,
        totalPages,
        hasNextPage: params.page < totalPages,
        hasPreviousPage: params.page > 1
      },
      metadata: {
        prefix: params.prefix,
        search: params.search,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        bucketName: params.bucket || process.env.CLOUDFLARE_R2_BUCKET_NAME || 'pathology-bites-images',
        timestamp: new Date().toISOString()
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'private, max-age=60', // 1 minute cache
        'X-Total-Files': totalItems.toString(),
        'X-R2-Bucket': response.metadata.bucketName
      }
    })

  } catch (error) {
    console.error('R2 files listing error:', error)
    return NextResponse.json(
      {
        error: 'Failed to list R2 files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
