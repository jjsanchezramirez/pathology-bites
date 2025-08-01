// src/features/questions/hooks/use-user-favorites.ts
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/shared/services/client'
import { toast } from 'sonner'

export interface UserFavorite {
  id: string
  question_id: string
  created_at: string
  questions: {
    id: string
    title: string
    category_id: string
    status: string
    difficulty: string
    categories: {
      id: string
      name: string
    }
  }
}

export interface UseFavoritesOptions {
  categoryId?: string
  limit?: number
  offset?: number
}

export function useUserFavorites(options: UseFavoritesOptions = {}) {
  const [favorites, setFavorites] = useState<UserFavorite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [favoriteQuestionIds, setFavoriteQuestionIds] = useState<Set<string>>(new Set())

  const supabase = createClient()

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (options.categoryId) params.append('category_id', options.categoryId)
      if (options.limit) params.append('limit', options.limit.toString())
      if (options.offset) params.append('offset', options.offset.toString())

      const response = await fetch(`/api/user/favorites?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch favorites')
      }

      setFavorites(result.data)
      setFavoriteQuestionIds(new Set(result.data.map((f: UserFavorite) => f.question_id)))

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch favorites'
      setError(errorMessage)
      console.error('Error fetching favorites:', err)
    } finally {
      setLoading(false)
    }
  }, [options.categoryId, options.limit, options.offset])

  const addToFavorites = useCallback(async (questionId: string) => {
    try {
      const response = await fetch('/api/user/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question_id: questionId }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          toast.error('Question is already in your favorites')
          return false
        }
        throw new Error(result.error || 'Failed to add to favorites')
      }

      // Update local state
      setFavoriteQuestionIds(prev => new Set([...prev, questionId]))
      
      // Refresh favorites list if we're showing all favorites
      if (!options.categoryId) {
        await fetchFavorites()
      }

      toast.success('Added to favorites')
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add to favorites'
      toast.error(errorMessage)
      console.error('Error adding to favorites:', err)
      return false
    }
  }, [options.categoryId, fetchFavorites])

  const removeFromFavorites = useCallback(async (questionId: string) => {
    try {
      const response = await fetch('/api/user/favorites', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question_id: questionId }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove from favorites')
      }

      // Update local state
      setFavoriteQuestionIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(questionId)
        return newSet
      })

      // Refresh favorites list if we're showing all favorites
      if (!options.categoryId) {
        await fetchFavorites()
      }

      toast.success('Removed from favorites')
      return true

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove from favorites'
      toast.error(errorMessage)
      console.error('Error removing from favorites:', err)
      return false
    }
  }, [options.categoryId, fetchFavorites])

  const toggleFavorite = useCallback(async (questionId: string) => {
    if (favoriteQuestionIds.has(questionId)) {
      return await removeFromFavorites(questionId)
    } else {
      return await addToFavorites(questionId)
    }
  }, [favoriteQuestionIds, addToFavorites, removeFromFavorites])

  const isFavorite = useCallback((questionId: string) => {
    return favoriteQuestionIds.has(questionId)
  }, [favoriteQuestionIds])

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  return {
    favorites,
    loading,
    error,
    favoriteQuestionIds,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    isFavorite,
    refetch: fetchFavorites
  }
}

// Hook for checking if specific questions are favorited (useful for question lists)
export function useFavoriteStatus(questionIds: string[]) {
  const [favoriteStatuses, setFavoriteStatuses] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    if (questionIds.length === 0) {
      setLoading(false)
      return
    }

    const checkFavoriteStatus = async () => {
      try {
        setLoading(true)

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setFavoriteStatuses({})
          return
        }

        const { data: favorites, error } = await supabase
          .from('user_favorites')
          .select('question_id')
          .eq('user_id', user.id)
          .in('question_id', questionIds)

        if (error) {
          console.error('Error checking favorite status:', error)
          return
        }

        const favoriteSet = new Set(favorites?.map(f => f.question_id) || [])
        const statuses: Record<string, boolean> = {}
        
        questionIds.forEach(id => {
          statuses[id] = favoriteSet.has(id)
        })

        setFavoriteStatuses(statuses)

      } catch (err) {
        console.error('Error checking favorite status:', err)
      } finally {
        setLoading(false)
      }
    }

    checkFavoriteStatus()
  }, [questionIds, supabase])

  return { favoriteStatuses, loading }
}
