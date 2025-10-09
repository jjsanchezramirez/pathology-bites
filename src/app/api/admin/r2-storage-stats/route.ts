import { NextRequest, NextResponse } from 'next/server'
import { getBucketSize } from '@/shared/services/r2-storage'
import { formatSize } from '@/features/images/services/image-upload'

export async function GET(request: NextRequest) {
  try {
    // Get sizes for both buckets
    const [imagesBucketStats, dataBucketStats] = await Promise.all([
      getBucketSize('pathology-bites-images'),
      getBucketSize('pathology-bites-data')
    ])

    const totalUsedBytes = imagesBucketStats.totalSize + dataBucketStats.totalSize
    const totalR2LimitBytes = 10737418240 // 10GB in bytes
    const availableBytes = Math.max(0, totalR2LimitBytes - totalUsedBytes)

    return NextResponse.json({
      success: true,
      data: {
        totalR2LimitBytes,
        totalUsedBytes,
        availableBytes,
        formattedTotalUsed: formatSize(totalUsedBytes),
        formattedAvailable: formatSize(availableBytes),
        buckets: {
          images: {
            totalSize: imagesBucketStats.totalSize,
            objectCount: imagesBucketStats.objectCount,
            formattedSize: formatSize(imagesBucketStats.totalSize)
          },
          data: {
            totalSize: dataBucketStats.totalSize,
            objectCount: dataBucketStats.objectCount,
            formattedSize: formatSize(dataBucketStats.totalSize)
          }
        }
      }
    })
  } catch (error) {
    console.error('Failed to get R2 storage stats:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch R2 storage statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
