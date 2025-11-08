// src/shared/hooks/use-pending-questions-count.ts
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'

interface PendingCounts {
  revisionQueueCount: number // rejected questions for creators
  reviewQueueCount: number // pending_review questions for reviewers
  draftsCount: number // draft questions for creators
}

export function usePendingQuestionsCount() {
  const [counts, setCounts] = useState<PendingCounts>({
    revisionQueueCount: 0,
    reviewQueueCount: 0,
    draftsCount: 0
  })
  const [loading, setLoading] = useState(true)
  const { user } = useAuthStatus()

  useEffect(() => {
    async function fetchCounts() {
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()

        // Fetch rejected questions count (for creators - revision queue)
        const { count: rejectedCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .eq('status', 'rejected')

        // Fetch pending review questions count (for reviewers - review queue)
        const { count: pendingReviewCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('reviewer_id', user.id)
          .eq('status', 'pending_review')

        // Fetch draft questions count (for creators)
        const { count: draftsCount } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .eq('status', 'draft')

        setCounts({
          revisionQueueCount: rejectedCount || 0,
          reviewQueueCount: pendingReviewCount || 0,
          draftsCount: draftsCount || 0
        })
      } catch (error) {
        console.error('Error fetching pending questions count:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCounts()

    // Set up realtime subscription for question status changes
    const supabase = createClient()
    const channel = supabase
      .channel('pending-questions-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'questions'
        },
        () => {
          // Refetch counts when questions table changes
          fetchCounts()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  return { ...counts, loading }
}
