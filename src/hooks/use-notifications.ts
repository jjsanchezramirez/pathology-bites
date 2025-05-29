// src/hooks/use-notifications.ts
'use client'

import { useState, useEffect, useCallback } from 'react'
import { notificationsService, NotificationWithSource } from '@/lib/notifications/service'
import { useAuthStatus } from '@/hooks/use-auth-status'

export function useNotifications(filter: 'all' | 'inquiry' | 'report' = 'all') {
  const [notifications, setNotifications] = useState<NotificationWithSource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const { user, isAuthenticated } = useAuthStatus()

  const loadNotifications = useCallback(async () => {
    console.log('🔔 useNotifications.loadNotifications called with:', { isAuthenticated, user: user?.id, filter })

    if (!isAuthenticated || !user) {
      console.log('🔔 User not authenticated or missing, clearing notifications')
      setNotifications([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      console.log('🔔 Fetching notifications for user:', user.id)

      const [fetchedNotifications, count] = await Promise.all([
        notificationsService.getNotifications(user.id, filter),
        notificationsService.getUnreadCount(user.id)
      ])

      console.log('🔔 Notifications fetched:', { fetchedNotifications, count })

      setNotifications(fetchedNotifications)
      setUnreadCount(count)
    } catch (err) {
      console.error('Error loading notifications:', err)
      setError(err instanceof Error ? err : new Error('Failed to load notifications'))
    } finally {
      setLoading(false)
    }
  }, [user, isAuthenticated, filter])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) return

    try {
      await notificationsService.markAsRead(notificationId)

      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )

      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
      throw err
    }
  }, [user])

  const markAllAsRead = useCallback(async () => {
    if (!user) return

    try {
      await notificationsService.markAllAsRead(user.id)

      // Update local state
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      )

      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
      throw err
    }
  }, [user])

  const refresh = useCallback(() => {
    loadNotifications()
  }, [loadNotifications])

  return {
    notifications,
    loading,
    error,
    unreadCount,
    markAsRead,
    markAllAsRead,
    refresh
  }
}
