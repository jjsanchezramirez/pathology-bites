// src/app/api/debug/database-schema/route.ts
/**
 * API endpoint for fetching database schema information from JSON file
 * Returns tables, functions, views, triggers, policies, and other database objects
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET(request: NextRequest) {
  try {
    // Completely disable in production
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404 }
      )
    }

    // Read the database schema JSON file
    const schemaPath = join(process.cwd(), 'data', 'database-schema.json')
    const schemaData = JSON.parse(readFileSync(schemaPath, 'utf8'))

    // Extract data by object type
    const tablesData = schemaData.find((item: any) => item.object_type === 'tables')?.data || []
    const viewsData = schemaData.find((item: any) => item.object_type === 'views')?.data || []
    const functionsData = schemaData.find((item: any) => item.object_type === 'functions')?.data || []
    const triggersData = schemaData.find((item: any) => item.object_type === 'triggers')?.data || []
    const policiesData = schemaData.find((item: any) => item.object_type === 'policies')?.data || []
    const customTypesData = schemaData.find((item: any) => item.object_type === 'custom_types')?.data || []
    const materializedViewsData = schemaData.find((item: any) => item.object_type === 'materialized_views')?.data || []
    const statisticsData = schemaData.find((item: any) => item.object_type === 'statistics')?.data || {}

    // Return the data from JSON file
    return NextResponse.json({
      tables: tablesData,
      views: [...viewsData, ...materializedViewsData],
      functions: functionsData,
      triggers: triggersData,
      policies: policiesData,
      customTypes: customTypesData,
      statistics: statisticsData
    })

  } catch (error) {
    console.error('Error reading database schema:', error)
    return NextResponse.json(
      { error: 'Failed to load database schema' },
      { status: 500 }
    )
  }
}