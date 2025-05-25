// src/components/admin/notifications-handler.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Bell, Loader2, AlertCircle, Info, ChevronDown, Flag, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStatus } from '@/hooks/use-auth-status'

// Simplified notification types
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
  
  const { user, isAuthenticated, isHydrated } = useAuthStatus()
  const { toast } = useToast()

  // Load notifications when user changes
  useEffect(() => {
    let mounted = true

    const loadNotifications = async () => {
      if (!isAuthenticated || !user) {
        setNotifications([])
        setLoading(false)
        return
      }
      
      try {
        setLoading(true)
        
        // Create mock notifications since we don't have the full notification system
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
          },
          {
            id: '3',
            type: 'inquiry',
            title: 'Content Request',
            description: 'Request for new pathology content',
            created_at: new Date(Date.now() - 7200000).toISOString(),
            read: false,
            metadata: { status: 'in_progress' }
          }
        ]
        
        // Apply filter
        let filteredNotifications = mockNotifications
        if (filter === 'inquiries') {
          filteredNotifications = mockNotifications.filter(n => n.type === 'inquiry')
        } else if (filter === 'reports') {
          filteredNotifications = mockNotifications.filter(n => n.type === 'report')
        }
        
        if (!mounted) return
        
        setNotifications(filteredNotifications)
        setHasMore(false) // No pagination for mock data
        
      } catch (error) {
        if (!mounted) return
        console.error("Error loading notifications:", error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to load notifications."
        })
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadNotifications()

    return () => {
      mounted = false
    }
  }, [user, isAuthenticated, filter, toast])

  // Mark notification as read
  const markAsRead = async (notification: BaseNotification) => {
    if (!isAuthenticated || !user) return
    
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

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(n => ({ ...n, read: true }))
    )
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

  // Don't render if not hydrated or authenticated
  if (!isHydrated || !isAuthenticated || !user) {
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
                onClick={markAllAsRead}
              >
                Mark all as read
              </Button>
            )}
          </div>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="inquiries">Inquiries</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
          </Tabs>
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
                  className={`px-4 py-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0 ${
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
                          {new Date(notification.created_at).toLocaleDateString()}
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