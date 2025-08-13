// src/features/learning-modules/hooks/use-learning-modules.ts

'use client'

import { useState, useEffect } from 'react'
import { LearningModule, LearningModuleFilters } from '../types/learning-modules'

interface UseLearningModulesOptions {
  filters?: LearningModuleFilters
  includeProgress?: boolean
}

interface UseLearningModulesReturn {
  modules: LearningModule[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  refetch: () => void
  setFilters: (filters: LearningModuleFilters) => void
}

export function useLearningModules(options: UseLearningModulesOptions = {}): UseLearningModulesReturn {
  const [modules, setModules] = useState<LearningModule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<LearningModuleFilters>(options.filters || {})
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchModules = async () => {
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

      if (options.includeProgress) {
        params.set('include_progress', 'true')
      }

      const response = await fetch(`/api/learning-modules?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch learning modules')
      }

      const data = await response.json()
      setModules(data.data || [])
      setPagination(data.pagination || pagination)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setModules([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModules()
  }, [filters])

  const handleSetFilters = (newFilters: LearningModuleFilters) => {
    setFilters({ ...newFilters, page: 1 }) // Reset to first page when filters change
  }

  return {
    modules,
    loading,
    error,
    pagination,
    refetch: fetchModules,
    setFilters: handleSetFilters
  }
}

// Hook for a single module
export function useLearningModule(moduleId: string, includeProgress = false) {
  const [module, setModule] = useState<LearningModule | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchModule = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (includeProgress) {
        params.set('include_progress', 'true')
      }

      const response = await fetch(`/api/learning-modules/${moduleId}?${params}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Module not found')
        }
        throw new Error('Failed to fetch module')
      }

      const data = await response.json()
      setModule(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setModule(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (moduleId) {
      fetchModule()
    }
  }, [moduleId])

  return {
    module,
    loading,
    error,
    refetch: fetchModule
  }
}

// Hook for module progress tracking
export function useModuleProgress(moduleId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startSession = async (learningPathId?: number) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/learning-modules/${moduleId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'start_session',
          learning_path_id: learningPathId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start session')
      }

      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updateProgress = async (data: {
    sections_viewed?: string[]
    completion_percentage?: number
  }) => {
    try {
      setError(null)

      const response = await fetch(`/api/learning-modules/${moduleId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'update_progress',
          ...data
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update progress')
      }

      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    }
  }

  const completeModule = async (data: {
    self_rating?: number
    confidence_level?: number
    feedback?: string
    found_helpful?: boolean
    assessment_score?: number
    learning_path_id?: number
  }) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/learning-modules/${moduleId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'complete_module',
          ...data
        })
      })

      if (!response.ok) {
        throw new Error('Failed to complete module')
      }

      return await response.json()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err
    } finally {
      setLoading(false)
    }
  }

  const getProgress = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/learning-modules/${moduleId}/progress`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch progress')
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
    startSession,
    updateProgress,
    completeModule,
    getProgress
  }
}
