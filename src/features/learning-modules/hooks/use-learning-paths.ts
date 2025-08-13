// src/features/learning-modules/hooks/use-learning-paths.ts

'use client'

import { useState, useEffect } from 'react'
import { LearningPath, LearningPathFilters } from '../types/learning-modules'

interface UseLearningPathsOptions {
  filters?: LearningPathFilters
  includeEnrollment?: boolean
}

interface UseLearningPathsReturn {
  paths: LearningPath[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  refetch: () => void
  setFilters: (filters: LearningPathFilters) => void
}

export function useLearningPaths(options: UseLearningPathsOptions = {}): UseLearningPathsReturn {
  const [paths, setPaths] = useState<LearningPath[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LearningPathFilters>(options.filters || {})
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchPaths = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      
      // Add filters to params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.set(key, value.toString())
        }
      })

      if (options.includeEnrollment) {
        params.set('include_enrollment', 'true')
      }

      const response = await fetch(`/api/learning-paths?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch learning paths')
      }

      const data = await response.json()
      setPaths(data.data || [])
      setPagination(data.pagination || pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setPaths([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPaths()
  }, [filters])

  const handleSetFilters = (newFilters: LearningPathFilters) => {
    setFilters({ ...newFilters, page: 1 }) // Reset to first page when filters change
  }

  return {
    paths,
    loading,
    error,
    pagination,
    refetch: fetchPaths,
    setFilters: handleSetFilters
  }
}

// Hook for a single learning path
export function useLearningPath(pathId: string | number, includeEnrollment = false) {
  const [path, setPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPath = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (includeEnrollment) {
        params.set('include_enrollment', 'true')
      }

      const response = await fetch(`/api/learning-paths/${pathId}?${params}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Learning path not found')
        }
        throw new Error('Failed to fetch learning path')
      }

      const data = await response.json()
      setPath(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setPath(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (pathId) {
      fetchPath()
    }
  }, [pathId])

  return {
    path,
    loading,
    error,
    refetch: fetchPath
  }
}

// Hook for learning path enrollment
export function useLearningPathEnrollment(pathId: string | number) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const enroll = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/learning-paths/${pathId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to enroll in learning path')
      }

      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updateEnrollment = async (data: {
    status?: 'active' | 'completed' | 'paused' | 'dropped'
    current_module_id?: string
  }) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/learning-paths/${pathId}/enroll`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update enrollment')
      }

      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getEnrollment = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/learning-paths/${pathId}/enroll`)
      
      if (!response.ok) {
        if (response.status === 404) {
          return null // Not enrolled
        }
        throw new Error('Failed to fetch enrollment')
      }

      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    enroll,
    updateEnrollment,
    getEnrollment
  }
}

// Hook for user's enrolled learning paths
export function useUserLearningPaths() {
  const [enrollments, setEnrollments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEnrollments = async () => {
    try {
      setLoading(true)
      setError(null)

      // This would need a dedicated API endpoint for user enrollments
      const response = await fetch('/api/user/learning-path-enrollments')
      
      if (!response.ok) {
        throw new Error('Failed to fetch enrollments')
      }

      const data = await response.json()
      setEnrollments(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setEnrollments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEnrollments()
  }, [])

  return {
    enrollments,
    loading,
    error,
    refetch: fetchEnrollments
  }
}
