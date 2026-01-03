// src/features/questions/hooks/use-question-queries.ts
// SWR-based hooks for fetching questions by role and context

import useSWR from 'swr'
import { createClient } from '@/shared/services/client'
import { useAuth } from '@/shared/hooks/use-auth'
import { toast } from '@/shared/utils/toast'
import { QuestionWithDetails } from '@/features/questions/types/questions'
import { formatDistanceToNow } from 'date-fns'

interface RejectedQuestion extends QuestionWithDetails {
  creator_name?: string
  resubmission_notes?: string | null
  resubmission_date?: string | null
}

interface UseQuestionQueryOptions {
  enabled?: boolean
  onError?: (error: Error) => void
}

/**
 * Fetch rejected questions for the current user (revision queue)
 */
async function fetchRejectedQuestions(userId: string) {
  const supabase = createClient()

  // Fetch rejected questions created by current user
  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      title,
      stem,
      difficulty,
      teaching_point,
      question_references,
      status,
      question_set_id,
      category_id,
      created_by,
      reviewer_id,
      reviewer_feedback,
      created_at,
      updated_at,
      question_sets(id, name),
      question_options(id, text, is_correct, explanation, order_index),
      question_images(
        question_section,
        order_index,
        images(id, url, alt_text, description)
      ),
      categories(*),
      created_by_user:users!questions_created_by_fkey(
        first_name,
        last_name
      ),
      updated_by_user:users!questions_updated_by_fkey(
        first_name,
        last_name
      ),
      reviewer_user:users!questions_reviewer_id_fkey(
        first_name,
        last_name
      )
    `)
    .eq('created_by', userId)
    .eq('status', 'rejected')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching rejected questions:', error)

    // Detect network errors
    const isNetworkError = error instanceof TypeError &&
                          (error.message?.includes('fetch') || error.message?.includes('network'))

    if (isNetworkError) {
      throw new Error('Network connection interrupted. Please refresh the page.')
    } else if (error.message?.includes('Timed out')) {
      throw new Error('Request timed out. Please check your network connection.')
    } else {
      throw new Error(error.message || 'Failed to load revision queue')
    }
  }

  // Fetch resubmission notes
  const questionIds = (data || []).map(q => q.id)
  let questionsWithResubmissionNotes = data || []

  if (questionIds.length > 0) {
    try {
      const { data: resubmissionData, error: resubmissionError } = await supabase
        .from('question_reviews')
        .select('question_id, changes_made, created_at')
        .in('question_id', questionIds)
        .eq('action', 'resubmitted')
        .order('created_at', { ascending: false })

      if (!resubmissionError && resubmissionData) {
        const resubmissionMap = new Map()
        resubmissionData.forEach(review => {
          if (!resubmissionMap.has(review.question_id) && review.changes_made?.resubmission_notes) {
            resubmissionMap.set(review.question_id, {
              notes: review.changes_made.resubmission_notes,
              date: review.created_at
            })
          }
        })

        questionsWithResubmissionNotes = (data || []).map(question => {
          const resubmissionInfo = resubmissionMap.get(question.id)
          return {
            ...question,
            resubmission_notes: resubmissionInfo?.notes || null,
            resubmission_date: resubmissionInfo?.date || null
          }
        })
      }
    } catch (error) {
      console.error('Error fetching resubmission notes:', error)
      // Continue with partial data rather than failing completely
    }
  }

  return questionsWithResubmissionNotes as RejectedQuestion[]
}

/**
 * Hook for fetching rejected questions (My Revision Queue)
 *
 * Features:
 * - Cached indefinitely (only refetches on manual refresh)
 * - Automatic deduplication
 * - Network error handling
 * - Manual refresh via mutate()
 *
 * Usage:
 * ```tsx
 * const { data: questions, isLoading, error, refresh } = useMyRevisionQueue()
 *
 * // After editing/resubmitting a question
 * await refresh()
 * ```
 */
export function useMyRevisionQueue(options: UseQuestionQueryOptions = {}) {
  const { enabled = true, onError } = options
  const { user } = useAuth({ minimal: true })

  const { data, error, isLoading, mutate } = useSWR<RejectedQuestion[]>(
    user && enabled ? ['revision-queue', user.id] : null,
    () => fetchRejectedQuestions(user!.id),
    {
      // Always fetch fresh data on mount
      revalidateIfStale: true,
      revalidateOnMount: true,

      // Dedupe rapid requests (5 seconds)
      dedupingInterval: 5000,

      // Revalidate on focus to catch changes made in other tabs
      revalidateOnFocus: true,

      // Revalidate on reconnect
      revalidateOnReconnect: true,

      // Keep previous data while revalidating
      keepPreviousData: true,

      // Error handling
      onError: (err) => {
        console.error('SWR error in useMyRevisionQueue:', err)
        toast.error(err.message || 'Failed to load revision queue')
        if (onError) onError(err)
      },

      errorRetryCount: 2,
      errorRetryInterval: 5000,
    }
  )

  return {
    questions: data || [],
    isLoading,
    error,
    refresh: mutate,
    mutate, // Alias for compatibility
  }
}

/**
 * Fetch questions pending review (for reviewers)
 */
async function fetchPendingReviewQuestions(userId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      title,
      stem,
      difficulty,
      teaching_point,
      question_references,
      status,
      question_set_id,
      category_id,
      created_by,
      reviewer_id,
      created_at,
      updated_at,
      question_sets(id, name),
      question_options(id, text, is_correct, explanation, order_index),
      question_images(
        question_section,
        order_index,
        images(id, url, alt_text, description)
      ),
      categories(*),
      created_by_user:users!questions_created_by_fkey(
        first_name,
        last_name
      )
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true }) // Oldest first for fairness

  if (error) {
    console.error('Error fetching pending review questions:', error)
    throw new Error(error.message || 'Failed to load review queue')
  }

  return data || []
}

/**
 * Hook for fetching questions pending review (My Review Queue)
 *
 * Usage:
 * ```tsx
 * const { data: questions, isLoading, refresh } = useMyReviewQueue()
 * ```
 */
export function useMyReviewQueue(options: UseQuestionQueryOptions = {}) {
  const { enabled = true, onError } = options
  const { user } = useAuth({ minimal: true })

  const { data, error, isLoading, mutate } = useSWR(
    user && enabled ? ['review-queue', user.id] : null,
    () => fetchPendingReviewQuestions(user!.id),
    {
      revalidateIfStale: false,
      revalidateOnMount: false,
      dedupingInterval: Infinity,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      onError: (err) => {
        console.error('SWR error in useMyReviewQueue:', err)
        toast.error(err.message || 'Failed to load review queue')
        if (onError) onError(err)
      },
      errorRetryCount: 2,
      errorRetryInterval: 5000,
    }
  )

  return {
    questions: data || [],
    isLoading,
    error,
    refresh: mutate,
    mutate,
  }
}

/**
 * Fetch draft questions for the current user
 */
async function fetchMyDrafts(userId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      title,
      stem,
      difficulty,
      teaching_point,
      question_references,
      status,
      question_set_id,
      category_id,
      created_by,
      created_at,
      updated_at,
      question_sets(id, name),
      question_options(id, text, is_correct, explanation, order_index),
      categories(*)
    `)
    .eq('created_by', userId)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching draft questions:', error)
    throw new Error(error.message || 'Failed to load drafts')
  }

  return data || []
}

/**
 * Hook for fetching draft questions (My Drafts)
 *
 * Usage:
 * ```tsx
 * const { data: drafts, isLoading, refresh } = useMyDrafts()
 * ```
 */
export function useMyDrafts(options: UseQuestionQueryOptions = {}) {
  const { enabled = true, onError } = options
  const { user } = useAuth({ minimal: true })

  const { data, error, isLoading, mutate } = useSWR(
    user && enabled ? ['my-drafts', user.id] : null,
    () => fetchMyDrafts(user!.id),
    {
      revalidateIfStale: false,
      revalidateOnMount: false,
      dedupingInterval: Infinity,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      onError: (err) => {
        console.error('SWR error in useMyDrafts:', err)
        toast.error(err.message || 'Failed to load drafts')
        if (onError) onError(err)
      },
      errorRetryCount: 2,
      errorRetryInterval: 5000,
    }
  )

  return {
    questions: data || [],
    isLoading,
    error,
    refresh: mutate,
    mutate,
  }
}

/**
 * Fetch all questions created by the current user
 */
async function fetchMyQuestions(userId: string) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('questions')
    .select(`
      id,
      title,
      stem,
      difficulty,
      teaching_point,
      question_references,
      status,
      question_set_id,
      category_id,
      created_by,
      reviewer_id,
      created_at,
      updated_at,
      published_at,
      version,
      question_sets(id, name),
      question_options(id, text, is_correct, explanation, order_index),
      question_images(
        question_section,
        order_index,
        images(id, url, alt_text, description)
      ),
      categories(*)
    `)
    .eq('created_by', userId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching my questions:', error)
    throw new Error(error.message || 'Failed to load questions')
  }

  return data || []
}

/**
 * Hook for fetching all questions by current user (My Questions)
 *
 * Usage:
 * ```tsx
 * const { data: questions, isLoading, refresh } = useMyQuestions()
 * ```
 */
export function useMyQuestions(options: UseQuestionQueryOptions = {}) {
  const { enabled = true, onError } = options
  const { user } = useAuth({ minimal: true })

  const { data, error, isLoading, mutate } = useSWR(
    user && enabled ? ['my-questions', user.id] : null,
    () => fetchMyQuestions(user!.id),
    {
      revalidateIfStale: false,
      revalidateOnMount: false,
      dedupingInterval: Infinity,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      keepPreviousData: true,
      onError: (err) => {
        console.error('SWR error in useMyQuestions:', err)
        toast.error(err.message || 'Failed to load questions')
        if (onError) onError(err)
      },
      errorRetryCount: 2,
      errorRetryInterval: 5000,
    }
  )

  return {
    questions: data || [],
    isLoading,
    error,
    refresh: mutate,
    mutate,
  }
}
