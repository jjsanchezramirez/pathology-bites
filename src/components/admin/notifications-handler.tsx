// src/components/admin/notifications-handler.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js' // Add this import
import { Bell, Loader2, AlertCircle, Info, ChevronDown, Flag, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { useNetworkStatus } from '@/hooks/use-network-status'

// Simplified notification types without complex imports
interface BaseNotification {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at: string;
  read: boolean;
  metadata: {
    status: string;
    [key: string]: string | number | boolean | null;
  };
}

export function NotificationsHandler() {
  const [notifications, setNotifications] = useState<BaseNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [filter, setFilter] = useState<'all' | 'inquiries' | 'reports'>('all')
  const [user, setUser] = useState<User | null>(null) // Fix this line - add proper typing
  const supabase = createClient()
  const { toast } = useToast()
  const isOnline = useNetworkStatus()

  // Check auth status
  const checkAuth = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      return !!user
    } catch (error) {
      console.error('Auth check failed:', error)
      return false
    }
  }, [supabase])

  // Load notifications - simplified version
  const loadNotifications = useCallback(async (loadMore = false) => {
    if (!isOnline) return
    
    const isAuthenticated = await checkAuth()
    if (!isAuthenticated) return
    
    try {
      setLoading(true)
      
      // For now, create mock notifications since we don't have the full notification system
      const mockNotifications: BaseNotification[] = [
        {
          id: '1',
          type: 'inquiry',
          title: 'New General Inquiry',
          description: 'User has submitted a general inquiry',
          created_at: new Date().toISOString(),
          read: false,
          metadata: { status: 'pending' }
        },
        {
          id: '2',
          type: 'report',
          title: 'Question Report',
          description: 'User reported an issue with a question',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          read: true,
          metadata: { status: 'resolved' }
        }
      ]
      
      // Apply filter
      let filteredNotifications = mockNotifications
      if (filter === 'inquiries') {
        filteredNotifications = mockNotifications.filter(n => n.type === 'inquiry')
      } else if (filter === 'reports') {
        filteredNotifications = mockNotifications.filter(n => n.type === 'report')
      }
      
      if (loadMore) {
        setNotifications(prev => [...prev, ...filteredNotifications])
      } else {
        setNotifications(filteredNotifications)
      }
      
      setHasMore(false) // No pagination for mock data
      
    } catch (error) {
      console.error("Error loading notifications:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load notifications."
      })
    } finally {
      setLoading(false)
    }
  }, [filter, toast, isOnline, checkAuth])

  // Initialize notifications
  useEffect(() => {
    loadNotifications()
  }, [filter, loadNotifications])

  // Mark notification as read
  const markAsRead = async (notification: BaseNotification) => {
    if (!isOnline || !user) return
    
    try {
      // Update local state
      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const getNotificationIcon = (notification: BaseNotification) => {
    if (notification.type === 'report') {
      return notification.metadata.status === 'resolved' ? 
        <CheckCircle className="h-4 w-4 text-green-500" /> :
        <Flag className="h-4 w-4 text-red-500" />
    }
    
    if (notification.metadata.status === 'resolved') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    
    return notification.type === 'inquiry' ?
      <Info className="h-4 w-4 text-blue-500" /> :
      <AlertCircle className="h-4 w-4 text-yellow-500" />
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'in_progress':
      case 'in_review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'dismissed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length

  // Don't render if not authenticated or offline
  if (!user || !isOnline) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="relative rounded-full"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="w-[400px] max-h-[85vh]"
      >
        <div className="px-2 py-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  notifications
                    .filter(n => !n.read)
                    .forEach(n => markAsRead(n))
                }}
              >
                Mark all as read
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setFilter('all')}
            >
              All
            </Button>
            <Button
              variant={filter === 'inquiries' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setFilter('inquiries')}
            >
              Inquiries
            </Button>
            <Button
              variant={filter === 'reports' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setFilter('reports')}
            >
              Reports
            </Button>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex justify-center items-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : notifications.length > 0 ? (
            <div className="py-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 hover:bg-muted/50 cursor-pointer ${
                    !notification.read ? 'bg-muted/30' : ''
                  }`}
                  onClick={() => markAsRead(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getNotificationIcon(notification)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {notification.title}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {notification.description}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          getStatusBadgeColor(notification.metadata.status)
                        }`}>
                          {(notification.metadata.status || 'pending').replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {hasMore && (
                <div className="p-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8"
                    onClick={() => loadNotifications(true)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-1">
                        Load more
                        <ChevronDown className="h-3 w-3" />
                      </span>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {filter === 'all' 
                ? 'No notifications'
                : filter === 'inquiries'
                  ? 'No inquiries'
                  : 'No reports'}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}