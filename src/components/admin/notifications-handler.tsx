// src/components/admin/notifications-handler.tsx
'use client'

import React, { useState } from 'react'
import { Bell, Loader2, AlertCircle, Info, Flag, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStatus } from '@/hooks/use-auth-status'
import { useNotifications } from '@/hooks/use-notifications'
import { NotificationWithSource } from '@/lib/notifications/service'

export function NotificationsHandler() {
  const [filter, setFilter] = useState<'all' | 'inquiry' | 'report'>('all')

  const { isHydrated, isAuthenticated, user } = useAuthStatus()
  const { toast } = useToast()

  const {
    notifications,
    loading,
    unreadCount,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead
  } = useNotifications(filter)

  // Mark notification as read with error handling
  const markAsRead = async (notification: NotificationWithSource) => {
    try {
      await markNotificationAsRead(notification.id)
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark notification as read."
      })
    }
  }

  // Mark all as read with error handling
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to mark all notifications as read."
      })
    }
  }

  const getNotificationIcon = (notification: NotificationWithSource) => {
    if (notification.source_type === 'report') {
      return notification.status === 'resolved' ?
        <CheckCircle className="h-4 w-4 text-green-500" /> :
        <Flag className="h-4 w-4 text-red-500" />
    }

    if (notification.status === 'resolved') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }

    return notification.source_type === 'inquiry' ?
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
              <TabsTrigger value="inquiry">Inquiries</TabsTrigger>
              <TabsTrigger value="report">Reports</TabsTrigger>
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
                          getStatusBadgeColor(notification.status)
                        }`}>
                          {(notification.status || 'pending').replace('_', ' ')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {filter === 'all'
                ? 'No notifications'
                : filter === 'inquiry'
                  ? 'No inquiries'
                  : 'No reports'}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}