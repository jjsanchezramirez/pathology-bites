// src/shared/hooks/use-pending-inquiries-count.ts
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/shared/services/client'

export function usePendingInquiriesCount() {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    fetchPendingCount()

    // Subscribe to real-time updates on all inquiry changes
    // We listen to all events (not just pending) because status can change from pending to resolved
    const channel = supabase
      .channel('inquiries-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inquiries'
        },
        () => {
          // Refetch count when any inquiry changes
          fetchPendingCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchPendingCount = async () => {
    try {
      setLoading(true)
      const { count: pendingCount, error } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')

      if (error) {
        console.error('Error fetching pending inquiries count:', error)
        return
      }

      setCount(pendingCount || 0)
    } catch (error) {
      console.error('Unexpected error fetching pending inquiries count:', error)
    } finally {
      setLoading(false)
    }
  }

  return { count, loading }
}

