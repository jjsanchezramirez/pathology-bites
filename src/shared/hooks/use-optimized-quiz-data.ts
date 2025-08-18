// src/shared/hooks/use-optimized-quiz-data.ts
/**
 * Optimized hook for quiz data with client-side caching and selective loading
 * Implements the database optimization patterns for reduced bandwidth consumption
 */

import { useState, useCallback } from 'react'
import { useCachedData } from './use-cached-data'

interface QuizQuestion {
  id: string
  title: string
  stem: string
  difficulty: string
  options: Array<{
    id: string
    text: string
    is_correct: boolean
    explanation?: string
  }>
}

interface QuizOptions {
  categories: Array<{
    id: string
    name: string
    shortName: string
    questionStats: {
      all: number
      unused: number
      incorrect: number
      marked: number
      correct: number
    }
  }>
  questionTypeStats: {
    all: any
    ap_only: any
    cp_only: any
  }
}

interface PaginatedQuestions {
  data: QuizQuestion[]
  pagination: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

/**
 * Hook for optimized quiz options with client-side caching
 */
export function useOptimizedQuizOptions() {
  return useCachedData<QuizOptions>(
    'quiz-options',
    async () => {
      const response = await fetch('/api/quiz/options')
      if (!response.ok) {
        throw new Error(`Failed to fetch quiz options: ${response.status}`)
      }
      return response.json()
    },
    {
      ttl: 5 * 60 * 1000, // 5 minutes cache
      staleTime: 2 * 60 * 1000, // 2 minutes stale time
      storage: 'localStorage', // Persist across sessions
      prefix: 'pathology-bites-quiz'
    }
  )
}

/**
 * Hook for paginated questions with intelligent caching
 */
export function usePaginatedQuestions(
  categoryId?: string,
  page: number = 1,
  limit: number = 10
) {
  const cacheKey = `questions-${categoryId || 'all'}-${page}-${limit}`
  
  return useCachedData<PaginatedQuestions>(
    cacheKey,
    async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })
      
      if (categoryId) {
        params.append('category_id', categoryId)
      }
      
      const response = await fetch(`/api/quiz/questions/paginated?${params}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch questions: ${response.status}`)
      }
      return response.json()
    },
    {
      ttl: 10 * 60 * 1000, // 10 minutes cache
      staleTime: 5 * 60 * 1000, // 5 minutes stale time
      storage: 'localStorage',
      prefix: 'pathology-bites-questions'
    }
  )
}

/**
 * Hook for individual question caching
 */
export function useOptimizedQuestion(questionId: string) {
  return useCachedData<QuizQuestion>(
    `question-${questionId}`,
    async () => {
      const response = await fetch(`/api/quiz/questions/${questionId}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch question: ${response.status}`)
      }
      return response.json()
    },
    {
      ttl: 30 * 60 * 1000, // 30 minutes cache (questions don't change often)
      staleTime: 15 * 60 * 1000, // 15 minutes stale time
      storage: 'localStorage',
      prefix: 'pathology-bites-question'
    }
  )
}


/**
 * Utility function to preload commonly accessed data
 */
export function useDataPreloader() {
  const [isPreloading, setIsPreloading] = useState(false)
  
  const preloadCommonData = useCallback(async () => {
    setIsPreloading(true)
    
    try {
      // Preload quiz options (most commonly accessed)
      const optionsPromise = fetch('/api/quiz/options').then(r => r.json())
      
      // Preload first page of questions
      const questionsPromise = fetch('/api/quiz/questions/paginated?page=1&limit=10')
        .then(r => r.json())
      
      // Wait for both to complete
      const [options, questions] = await Promise.all([optionsPromise, questionsPromise])
      
      // Cache the results
      localStorage.setItem('pathology-bites-quiz-quiz-options', JSON.stringify({
        data: options,
        timestamp: Date.now()
      }))
      
      localStorage.setItem('pathology-bites-questions-questions-all-1-10', JSON.stringify({
        data: questions,
        timestamp: Date.now()
      }))
      
      console.log('Common data preloaded successfully')
    } catch (error) {
      console.error('Failed to preload data:', error)
    } finally {
      setIsPreloading(false)
    }
  }, [])
  
  return { preloadCommonData, isPreloading }
}

/**
 * Utility to clear cached data when needed
 */
export function useCacheCleaner() {
  const clearQuizCache = useCallback(() => {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('pathology-bites-quiz') ||
      key.startsWith('pathology-bites-questions') ||
      key.startsWith('pathology-bites-question') ||
      key.startsWith('pathology-bites-slides')
    )
    
    keys.forEach(key => localStorage.removeItem(key))
    console.log(`Cleared ${keys.length} cached items`)
  }, [])
  
  return { clearQuizCache }
}
