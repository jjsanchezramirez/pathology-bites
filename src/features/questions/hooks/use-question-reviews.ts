'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'
import { 
  QuestionReviewData, 
  ReviewAction, 
  ReviewFormData 
} from '@/features/questions/types/questions'

interface UseQuestionReviewsOptions {
  questionId?: string
}

export function useQuestionReviews(options: UseQuestionReviewsOptions = {}) {
  const [reviews, setReviews] = useState<QuestionReviewData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  const fetchReviews = async () => {
    try {
      setLoading(true)
      setError(null)

      const url = new URL('/api/content/questions/reviews', window.location.origin)
      if (options.questionId) {
        url.searchParams.set('question_id', options.questionId)
      }

      const response = await fetch(url.toString())
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reviews')
      }

      setReviews(data.reviews || [])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const createReview = async (questionId: string, reviewData: ReviewFormData) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/questions/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: questionId,
          action: reviewData.action,
          feedback: reviewData.feedback,
          changes_made: reviewData.changes_made
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create review')
      }

      toast.success(data.message || 'Review submitted successfully')
      
      // Refresh reviews if we're viewing reviews for this question
      if (!options.questionId || options.questionId === questionId) {
        await fetchReviews()
      }

      return data.review
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
    fetchReviews()
  }, [options.questionId])

  return {
    reviews,
    loading,
    error,
    fetchReviews,
    createReview,
    refetch: fetchReviews
  }
}
