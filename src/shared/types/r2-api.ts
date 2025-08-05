// src/shared/types/r2-api.ts
/**
 * TypeScript interfaces for R2 API endpoints
 * Provides type safety for R2 file operations and responses
 */

export interface R2FileMetadata {
  key: string
  url: string
  size: number
  lastModified: Date
  contentType: string
  etag?: string
}

export interface R2FileListParams {
  page?: number
  limit?: number
  prefix?: string
  search?: string
  sortBy?: 'name' | 'size' | 'lastModified'
  sortOrder?: 'asc' | 'desc'
  bucket?: string
}

export interface R2FileListPagination {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface R2FileListMetadata {
  prefix?: string
  search?: string
  sortBy: string
  sortOrder: string
  bucketName: string
  timestamp: string
}

export interface R2FileListResponse {
  files: R2FileMetadata[]
  pagination: R2FileListPagination
  metadata: R2FileListMetadata
}

export interface R2ApiError {
  error: string
  details?: string
  code?: string
}

// Request/Response types for different R2 operations
export interface R2UploadRequest {
  file: File | Buffer
  key: string
  contentType?: string
  metadata?: Record<string, string>
  cacheControl?: string
}

export interface R2UploadResponse {
  success: boolean
  url: string
  key: string
  size: number
  contentType: string
}

export interface R2DeleteRequest {
  key: string
}

export interface R2DeleteResponse {
  success: boolean
  key: string
}

export interface R2BulkDeleteRequest {
  keys: string[]
}

export interface R2BulkDeleteResponse {
  success: boolean
  deleted: string[]
  errors: string[]
}

export interface R2FileInfoRequest {
  key: string
}

export interface R2FileInfoResponse {
  exists: boolean
  size: number
  lastModified: string
  contentType: string
  url: string
}

// Utility types for API responses
export type R2ApiResponse<T> = T | R2ApiError

export interface R2ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface R2ApiErrorResponse {
  success: false
  error: string
  details?: string
  code?: string
}

export type R2ApiResult<T> = R2ApiSuccessResponse<T> | R2ApiErrorResponse
