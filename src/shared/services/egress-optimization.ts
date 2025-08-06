/**
 * Egress Optimization Service
 * 
 * Provides utilities to reduce database and auth egress charges by:
 * 1. Response compression and pagination
 * 2. Field selection and data filtering
 * 3. Caching strategies
 * 4. Session optimization
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'

export interface PaginationOptions {
  page?: number
  pageSize?: number
  maxPageSize?: number
}

export interface FieldSelection {
  select?: string
  exclude?: string[]
}

export interface CacheOptions {
  maxAge?: number
  staleWhileRevalidate?: number
  public?: boolean
}

/**
 * Create optimized paginated response with Next.js Brotli compression
 */
export function createOptimizedResponse<T>(
  data: T,
  options: {
    cache?: CacheOptions
    compress?: boolean
    pagination?: {
      page: number
      pageSize: number
      total: number
      hasMore: boolean
    }
  } = {}
) {
  const response = NextResponse.json(data)
  
  // REMOVED: Manual compression headers to avoid ERR_CONTENT_DECODING_FAILED
  // Next.js automatically handles Brotli/gzip compression when appropriate
  // Only set Vary header for cache optimization
  if (options.compress !== false) {
    response.headers.set('Vary', 'Accept-Encoding')
  }
  
  // Add cache headers
  if (options.cache) {
    const { maxAge = 300, staleWhileRevalidate = 60, public: isPublic = false } = options.cache
    const cacheControl = [
      isPublic ? 'public' : 'private',
      `max-age=${maxAge}`,
      `stale-while-revalidate=${staleWhileRevalidate}`
    ].join(', ')
    
    response.headers.set('Cache-Control', cacheControl)
  }
  
  // Add pagination headers
  if (options.pagination) {
    const { page, pageSize, total, hasMore } = options.pagination
    response.headers.set('X-Page', page.toString())
    response.headers.set('X-Page-Size', pageSize.toString())
    response.headers.set('X-Total', total.toString())
    response.headers.set('X-Has-More', hasMore.toString())
  }
  
  return response
}

/**
 * Optimize database query with field selection and pagination
 */
export async function optimizedQuery<T>(
  tableName: string,
  options: {
    select?: string
    filters?: Record<string, any>
    pagination?: PaginationOptions
    orderBy?: string
    userId?: string
  } = {}
): Promise<{
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}> {
  const supabase = await createClient()
  
  const {
    select = '*',
    filters = {},
    pagination = {},
    orderBy,
    userId
  } = options
  
  const {
    page = 1,
    pageSize = 20,
    maxPageSize = 100
  } = pagination
  
  // Enforce maximum page size to prevent large responses
  const limitedPageSize = Math.min(pageSize, maxPageSize)
  const offset = (page - 1) * limitedPageSize
  
  // Build query with optimized field selection
  let query = supabase
    .from(tableName)
    .select(select, { count: 'exact' })
  
  // Apply filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        query = query.in(key, value)
      } else if (typeof value === 'string' && value.includes('%')) {
        query = query.like(key, value)
      } else {
        query = query.eq(key, value)
      }
    }
  })
  
  // Apply user-specific filtering if userId provided
  if (userId) {
    query = query.eq('created_by', userId)
  }
  
  // Apply ordering
  if (orderBy) {
    const [column, direction = 'asc'] = orderBy.split(':')
    query = query.order(column, { ascending: direction === 'asc' })
  }
  
  // Apply pagination
  query = query.range(offset, offset + limitedPageSize - 1)
  
  const { data, error, count } = await query
  
  if (error) {
    throw new Error(`Database query failed: ${error.message}`)
  }
  
  const total = count || 0
  const hasMore = offset + limitedPageSize < total
  
  return {
    data: (data as T[]) || [],
    total,
    page,
    pageSize: limitedPageSize,
    hasMore
  }
}

/**
 * Batch multiple queries to reduce round trips
 */
export async function batchQueries<T extends Record<string, any>>(
  queries: Array<{
    name: string
    table: string
    select?: string
    filters?: Record<string, any>
    single?: boolean
  }>
): Promise<T> {
  const supabase = await createClient()
  
  const results = await Promise.all(
    queries.map(async ({ name, table, select = '*', filters = {}, single = false }) => {
      let query = supabase.from(table).select(select)
      
      // Apply filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      })
      
      if (single) {
        const { data, error } = await query.single()
        return { name, data, error }
      } else {
        const { data, error } = await query
        return { name, data, error }
      }
    })
  )
  
  // Check for errors
  const errors = results.filter(r => r.error)
  if (errors.length > 0) {
    throw new Error(`Batch query failed: ${errors.map(e => e.error?.message).join(', ')}`)
  }
  
  // Build result object
  const result = {} as T
  results.forEach(({ name, data }) => {
    result[name as keyof T] = data as T[keyof T]
  })
  
  return result
}

/**
 * Optimize session handling to reduce auth egress
 */
export async function optimizedAuth(options: {
  extendSession?: boolean
  cacheSession?: boolean
} = {}) {
  const supabase = await createClient()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { user: null, session: null, error }
    }
    
    // Extend session if requested (reduces frequent re-authentication)
    if (options.extendSession) {
      await supabase.auth.refreshSession()
    }
    
    return { user, session: null, error: null }
  } catch (error) {
    return { user: null, session: null, error }
  }
}

/**
 * Create minimal user data response (reduces payload size)
 */
export function createMinimalUserResponse(user: any) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: user.created_at
    // Exclude unnecessary fields like metadata, app_metadata, etc.
  }
}

/**
 * Compress large JSON responses
 */
export function compressResponse(data: any): string {
  // Remove null/undefined values to reduce payload size
  const cleaned = JSON.parse(JSON.stringify(data, (key, value) => {
    if (value === null || value === undefined) {
      return undefined
    }
    return value
  }))
  
  return JSON.stringify(cleaned)
}

/**
 * Create error response with minimal data
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: any
) {
  return NextResponse.json(
    {
      error: message,
      ...(details && { details })
    },
    { 
      status,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  )
}

export default {
  createOptimizedResponse,
  optimizedQuery,
  batchQueries,
  optimizedAuth,
  createMinimalUserResponse,
  compressResponse,
  createErrorResponse
}
