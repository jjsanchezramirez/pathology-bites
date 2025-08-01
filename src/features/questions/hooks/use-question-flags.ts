'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'
import { 
  QuestionFlagData, 
  FlagType, 
  FlagStatus,
  FlagFormData 
} from '@/features/questions/types/questions'

interface UseQuestionFlagsOptions {
  questionId?: string
  status?: FlagStatus
}

export function useQuestionFlags(options: UseQuestionFlagsOptions = {}) {
  const [flags, setFlags] = useState<QuestionFlagData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchFlags = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = new URL('/api/content/questions/flags', window.location.origin)
      if (options.questionId) {
        url.searchParams.set('question_id', options.questionId)
      }
      if (options.status) {
        url.searchParams.set('status', options.status)
      }

      const response = await fetch(url.toString())
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch flags')
      }

      setFlags(data.flags || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createFlag = async (questionId: string, flagData: FlagFormData) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/questions/flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: questionId,
          flag_type: flagData.flag_type,
          description: flagData.description
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to flag question')
      }

      toast.success(data.message || 'Question flagged successfully')
      
      // Refresh flags if we're viewing flags for this question
      if (!options.questionId || options.questionId === questionId) {
        await fetchFlags()
      }

      return data.flag
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  const updateFlag = async (flagId: string, status: FlagStatus, resolutionNotes?: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/questions/flags', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flag_id: flagId,
          status,
          resolution_notes: resolutionNotes
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update flag')
      }

      toast.success(data.message || 'Flag updated successfully')
      
      // Refresh flags
      await fetchFlags()

      return data.flag
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      toast.error(errorMessage)
      throw err
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFlags()
  }, [options.questionId, options.status])

  return {
    flags,
    loading,
    error,
    fetchFlags,
    createFlag,
    updateFlag,
    refetch: fetchFlags
  }
}
