// src/components/admin/notifications-handler.tsx
'use client'

import React, { useState } from 'react'
import {
  Bell,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Info,
  Flag,
  CheckCircle,
  Trophy,
  Award,
  Clock,
  FileText,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/shared/components/ui/dropdown-menu"

import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { useNotifications } from '@/shared/hooks/use-notifications'
import { NotificationWithSource } from '@/shared/types/notifications'

export function NotificationsHandler() {
  const [page, setPage] = useState(1)
  const limit = 20

  const { isHydrated, isAuthenticated, user } = useAuthStatus()

  const {
    notifications,
    loading,
    unreadCount,
    total,
    hasMore,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead
  } = useNotifications(page, limit)

  // Mark notification as read with error handling
  const markAsRead = async (notification: NotificationWithSource) => {
    try {
      await markNotificationAsRead(notification.id)
    } catch (_error) {
      toast.error("Failed to mark notification as read.")
    }
  }

  // Mark all as read with error handling
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead()
    } catch (_error) {
      toast.error("Failed to mark all notifications as read.")
    }
  }

  const getNotificationIcon = (notification: NotificationWithSource) => {
    switch (notification.source_type) {
      case 'inquiry':
        return <Info className="h-4 w-4 text-blue-500" />
      case 'report':
        return notification.status === 'resolved' ?
          <CheckCircle className="h-4 w-4 text-green-500" /> :
          <Flag className="h-4 w-4 text-red-500" />
      case 'admin_alert':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case 'question_review':
        return <FileText className="h-4 w-4 text-orange-500" />
      case 'question_status':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'system_update':
        const severity = notification.metadata?.severity
        return severity === 'critical' ?
          <AlertCircle className="h-4 w-4 text-red-500" /> :
          severity === 'warning' ?
          <AlertTriangle className="h-4 w-4 text-yellow-500" /> :
          <Info className="h-4 w-4 text-blue-500" />
      case 'milestone':
        return <Trophy className="h-4 w-4 text-yellow-500" />
      case 'achievement':
        return <Award className="h-4 w-4 text-purple-500" />
      case 'reminder':
        return <Clock className="h-4 w-4 text-orange-500" />
      case 'page_update':
        return <FileText className="h-4 w-4 text-green-500" />
      case 'learning_path_update':
        return <BookOpen className="h-4 w-4 text-indigo-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      case 'in_progress':
      case 'in_review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'resolved':
      case 'achieved':
      case 'published':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'dismissed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
      case 'active':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  // Don't render if not hydrated or authenticated
  if (!isHydrated || !isAuthenticated || !user) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="relative rounded-full opacity-50"
        disabled
      >
        <Bell className="h-5 w-5" />
      </Button>
    )
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Notifications</h2>
              {total > 0 && (
                <p className="text-xs text-muted-foreground">
                  {total} total • {unreadCount} unread
                </p>
              )}
            </div>
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
                          getStatusBadgeColor(notification.status || 'pending')
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
              No notifications
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {total > limit && (
          <div className="px-2 py-3 border-t">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Page {page} of {Math.ceil(total / limit)}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}