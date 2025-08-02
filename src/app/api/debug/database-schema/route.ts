// src/app/api/debug/database-schema/route.ts
/**
 * API endpoint for fetching database schema information from R2
 * Returns tables, functions, views, triggers, policies, and other database objects
 */

import { NextRequest, NextResponse } from 'next/server'
import { createOptimizedResponse } from '@/shared/utils/compression'

// R2 URL for database schema (migrated from local file)
const DATABASE_SCHEMA_R2_URL = 'https://pub-a4bec7073d99465f99043c842be6318c.r2.dev/pathology-bites-data/database-schema.json'

export async function GET(request: NextRequest) {
  try {
    // Completely disable in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      )
    }

    // Fetch from R2 instead of local file system
    const response = await fetch(DATABASE_SCHEMA_R2_URL, {
      headers: {
        'Cache-Control': 'public, max-age=1800' // 30 minutes cache
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch database schema: ${response.status}`)
    }

    const schemaData = await response.json()

    // Extract data by object type
    const tablesData = schemaData.find((item: any) => item.object_type === 'tables')?.data || []
    const viewsData = schemaData.find((item: any) => item.object_type === 'views')?.data || []
    const functionsData = schemaData.find((item: any) => item.object_type === 'functions')?.data || []
    const triggersData = schemaData.find((item: any) => item.object_type === 'triggers')?.data || []
    const policiesData = schemaData.find((item: any) => item.object_type === 'policies')?.data || []
    const customTypesData = schemaData.find((item: any) => item.object_type === 'custom_types')?.data || []
    const materializedViewsData = schemaData.find((item: any) => item.object_type === 'materialized_views')?.data || []
    const statisticsData = schemaData.find((item: any) => item.object_type === 'statistics')?.data || {}

    const result = {
      tables: tablesData,
      views: [...viewsData, ...materializedViewsData],
      functions: functionsData,
      triggers: triggersData,
      policies: policiesData,
      customTypes: customTypesData,
      statistics: statisticsData
    }

    // Return with compression for debug data
    return createOptimizedResponse(result, {
      compress: true,
      cache: {
        maxAge: 1800, // 30 minutes
        staleWhileRevalidate: 300, // 5 minutes
        public: false // Debug data should not be public
      }
    })

  } catch (error) {
    console.error('Error reading database schema:', error)
    return NextResponse.json(
      { error: 'Failed to load database schema' },
      { status: 500 }
    )
  }
}