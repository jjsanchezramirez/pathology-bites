/**
 * Medical Term Expansion Cache Management Endpoint
 *
 * GET: Get cache statistics
 * DELETE: Clear the cache
 *
 * This endpoint is helpful for monitoring and managing the NCI EVS expansion cache.
 */

import { NextResponse } from 'next/server'
import { getCacheStats, clearExpansionCache } from '../../public/tools/diagnostic-search/umls-expansion'

/**
 * GET /api/admin/umls-cache
 * Returns cache statistics for medical term expansion (NCI EVS + static)
 */
export async function GET() {
  try {
    const stats = getCacheStats()

    return NextResponse.json({
      success: true,
      stats,
      message: stats.nci_evs_available
        ? 'NCI EVS API is available (no API key required!)'
        : 'Using static fallback only'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get cache stats'
    }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/umls-cache
 * Clears the expansion cache
 */
export async function DELETE() {
  try {
    clearExpansionCache()

    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully'
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear cache'
    }, { status: 500 })
  }
}
