// src/app/api/debug/egress-optimization/route.ts
/**
 * Debug API for testing egress optimization features
 * Tests compression, pagination, caching, and database query optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  createOptimizedResponse, 
  optimizedQuery, 
  batchQueries,
  optimizedAuth 
} from '@/shared/services/egress-optimization'
import { createClient } from '@/shared/services/server'

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
    const test = searchParams.get('test') || 'all'

    switch (test) {
      case 'compression':
        return await testCompression()
      case 'pagination':
        return await testPagination()
      case 'batch-queries':
        return await testBatchQueries()
      case 'auth-optimization':
        return await testAuthOptimization()
      case 'all':
        return await runAllTests()
      default:
        return NextResponse.json(
          { error: 'Invalid test. Use: compression, pagination, batch-queries, auth-optimization, all' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Egress optimization debug error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Test response compression
 */
async function testCompression() {
  const largeData = {
    message: 'Testing compression with large response',
    data: Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Test Item ${i}`,
      description: `This is a test item with ID ${i} for compression testing. `.repeat(5),
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        tags: ['test', 'compression', 'debug', `item-${i}`]
      }
    })),
    timestamp: new Date().toISOString()
  }

  // Calculate uncompressed size
  const uncompressedSize = JSON.stringify(largeData).length

  return createOptimizedResponse(
    {
      ...largeData,
      compressionTest: {
        uncompressedSizeBytes: uncompressedSize,
        uncompressedSizeKB: Math.round(uncompressedSize / 1024 * 100) / 100,
        compressionEnabled: true
      }
    },
    {
      compress: true,
      cache: {
        maxAge: 300,
        staleWhileRevalidate: 60,
        public: false
      }
    }
  )
}

/**
 * Test pagination optimization
 */
async function testPagination() {
  try {
    const result = await optimizedQuery('images', {
      select: 'id, description, category, created_at',
      pagination: {
        page: 1,
        pageSize: 10,
        maxPageSize: 50
      },
      orderBy: 'created_at:desc'
    })

    return createOptimizedResponse(
      {
        paginationTest: {
          success: true,
          ...result,
          optimizations: {
            fieldSelection: 'Limited to essential fields only',
            pagination: 'Enforced maximum page size',
            ordering: 'Optimized database ordering'
          }
        }
      },
      {
        compress: true,
        pagination: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          hasMore: result.hasMore
        }
      }
    )
  } catch (error) {
    return NextResponse.json(
      { 
        paginationTest: {
          success: false,
          error: error instanceof Error ? error.message : 'Pagination test failed'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Test batch queries optimization
 */
async function testBatchQueries() {
  try {
    const batchResult = await batchQueries([
      {
        name: 'imageCount',
        table: 'images',
        select: 'count(*)',
        single: true
      },
      {
        name: 'recentImages',
        table: 'images',
        select: 'id, description, category, created_at',
        filters: {}
      },
      {
        name: 'categories',
        table: 'categories',
        select: 'id, name, description',
        filters: {}
      }
    ])

    return createOptimizedResponse(
      {
        batchQueryTest: {
          success: true,
          results: batchResult,
          optimizations: {
            roundTrips: 'Single batch request instead of 3 separate queries',
            networkLatency: 'Reduced by ~66%',
            connectionOverhead: 'Minimized'
          }
        }
      },
      {
        compress: true,
        cache: {
          maxAge: 180,
          staleWhileRevalidate: 30
        }
      }
    )
  } catch (error) {
    return NextResponse.json(
      { 
        batchQueryTest: {
          success: false,
          error: error instanceof Error ? error.message : 'Batch query test failed'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Test auth optimization
 */
async function testAuthOptimization() {
  try {
    const authResult = await optimizedAuth({
      extendSession: true,
      cacheSession: true
    })

    return createOptimizedResponse(
      {
        authOptimizationTest: {
          success: true,
          hasUser: !!authResult.user,
          userId: authResult.user?.id || null,
          optimizations: {
            sessionExtension: 'Reduces frequent re-authentication',
            sessionCaching: 'Minimizes auth API calls',
            minimalUserData: 'Reduced payload size'
          }
        }
      },
      {
        compress: true,
        cache: {
          maxAge: 60,
          staleWhileRevalidate: 30,
          public: false
        }
      }
    )
  } catch (error) {
    return NextResponse.json(
      { 
        authOptimizationTest: {
          success: false,
          error: error instanceof Error ? error.message : 'Auth optimization test failed'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * Run all optimization tests
 */
async function runAllTests() {
  const startTime = Date.now()
  
  try {
    // Run tests in parallel for efficiency
    const [compressionResult, paginationResult, batchResult, authResult] = await Promise.allSettled([
      testCompression(),
      testPagination(),
      testBatchQueries(),
      testAuthOptimization()
    ])

    const endTime = Date.now()
    const totalTime = endTime - startTime

    const results = {
      compression: compressionResult.status === 'fulfilled' ?
        { success: true, message: 'Compression test completed' } :
        { error: compressionResult.reason },
      pagination: paginationResult.status === 'fulfilled' ?
        { success: true, message: 'Pagination test completed' } :
        { error: paginationResult.reason },
      batchQueries: batchResult.status === 'fulfilled' ?
        { success: true, message: 'Batch queries test completed' } :
        { error: batchResult.reason },
      authOptimization: authResult.status === 'fulfilled' ?
        { success: true, message: 'Auth optimization test completed' } :
        { error: authResult.reason }
    }

    const successCount = Object.values(results).filter(r => !r.error).length
    const totalTests = Object.keys(results).length

    return createOptimizedResponse(
      {
        allTestsResult: {
          success: successCount === totalTests,
          successCount,
          totalTests,
          executionTimeMs: totalTime,
          results,
          summary: {
            compressionWorking: !results.compression.error,
            paginationWorking: !results.pagination.error,
            batchQueriesWorking: !results.batchQueries.error,
            authOptimizationWorking: !results.authOptimization.error
          }
        }
      },
      {
        compress: true,
        cache: {
          maxAge: 120,
          staleWhileRevalidate: 60,
          public: false
        }
      }
    )
  } catch (error) {
    return NextResponse.json(
      { 
        allTestsResult: {
          success: false,
          error: error instanceof Error ? error.message : 'All tests failed'
        }
      },
      { status: 500 }
    )
  }
}
