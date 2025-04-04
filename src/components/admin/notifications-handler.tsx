// src/components/admin/notifications-handler.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Bell, Loader2, AlertCircle, Info, ChevronDown, Flag, CheckCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

interface BaseNotification {
  id: string
  created_at: string
  read: boolean
}

interface InquiryNotification extends BaseNotification {
  type: 'technical_inquiry' | 'general_inquiry'
  title: string
  description: string
  metadata: {
    inquiryId: string
    requestType: string
    email: string
    status: string
  }
}

interface ReportNotification extends BaseNotification {
  type: 'question_report'
  title: string
  description: string
  metadata: {
    reportId: string
    questionId: string
    reportType: string
    reportedBy: string
    status: string
  }
}

type Notification = InquiryNotification | ReportNotification

// Define types for the inquiry and report payload
interface InquiryPayload {
  id: string
  first_name: string
  last_name: string
  organization?: string
  request_type: string
  email: string
  status: string
  created_at: string
}

interface ReportPayload {
  id: string
  question_id: string
  report_type: string
  reported_by: string
  status: string
  created_at: string
}

const NOTIFICATIONS_PER_PAGE = 10

export function NotificationsHandler() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<'all' | 'inquiries' | 'reports'>('all')
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Handle new inquiry notification
  const handleNewInquiry = useCallback((inquiry: InquiryPayload) => {
    if (filter === 'reports') return

    const notification: InquiryNotification = {
      id: inquiry.id,
      type: `${inquiry.request_type}_inquiry` as 'technical_inquiry' | 'general_inquiry',
      title: `New ${inquiry.request_type.charAt(0).toUpperCase() + inquiry.request_type.slice(1)} Inquiry`,
      description: `${inquiry.first_name} ${inquiry.last_name} from ${inquiry.organization || 'Unknown Organization'}`,
      created_at: inquiry.created_at,
      read: false,
      metadata: {
        inquiryId: inquiry.id,
        requestType: inquiry.request_type,
        email: inquiry.email,
        status: inquiry.status
      }
    }
    
    setNotifications(prev => [notification, ...prev])
    
    toast({
      title: notification.title,
      description: notification.description,
    })
  }, [filter, toast]);

  // Handle new report notification
  const handleNewReport = useCallback(async (report: ReportPayload) => {
    if (filter === 'inquiries') return

    // Fetch question details
    const { data: question } = await supabase
      .from('questions')
      .select('title')
      .eq('id', report.question_id)
      .single()

    const notification: ReportNotification = {
      id: report.id,
      type: 'question_report',
      title: 'New Question Report',
      description: `Report: ${report.report_type} for "${question?.title}"`,
      created_at: report.created_at,
      read: false,
      metadata: {
        reportId: report.id,
        questionId: report.question_id,
        reportType: report.report_type,
        reportedBy: report.reported_by,
        status: report.status
      }
    }
    
    setNotifications(prev => [notification, ...prev])
    
    toast({
      title: notification.title,
      description: notification.description,
    })
  }, [filter, supabase, toast]);

  // Setup subscriptions
  const setupSubscriptions = useCallback(() => {
    // Subscribe to new inquiries
    const inquiriesSubscription = supabase
      .channel('inquiries-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inquiries'
        },
        payload => handleNewInquiry(payload.new as InquiryPayload)
      )      

    // Subscribe to new reports
    const reportsSubscription = supabase
      .channel('reports-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'question_reports'
        },
        payload => handleNewReport(payload.new as ReportPayload)
      )      

    return () => {
      supabase.removeChannel(inquiriesSubscription)
      supabase.removeChannel(reportsSubscription)
    }
  }, [supabase, handleNewInquiry, handleNewReport]);

  // Load notifications
  const loadNotifications = useCallback(async (loadMore = false) => {
    try {
      setLoading(true)
      const currentPage = loadMore ? page + 1 : 0

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) throw new Error('Not authenticated')

      // Get notification states
      const { data: states, error: statesError } = await supabase
        .from('notification_states')
        .select('*')
        .eq('user_id', user.user.id)
        .order('created_at', { ascending: false })

      if (statesError) throw statesError

      // Create a map of read states
      const readStates = new Map(
        states.map(state => [`${state.source_type}-${state.source_id}`, state.read])
      )

      // Load notifications based on filter
      let notifications: Notification[] = []

      if (filter !== 'reports') {
        const { data: inquiries, error: inquiriesError } = await supabase
          .from('inquiries')
          .select('*')
          .order('created_at', { ascending: false })
          .range(currentPage * NOTIFICATIONS_PER_PAGE, (currentPage + 1) * NOTIFICATIONS_PER_PAGE)

        if (inquiriesError) throw inquiriesError

        const inquiryNotifications = inquiries.map(inquiry => ({
          id: inquiry.id,
          type: `${inquiry.request_type}_inquiry` as 'technical_inquiry' | 'general_inquiry',
          title: `New ${inquiry.request_type.charAt(0).toUpperCase() + inquiry.request_type.slice(1)} Inquiry`,
          description: `${inquiry.first_name} ${inquiry.last_name} from ${inquiry.organization || 'Unknown Organization'}`,
          created_at: inquiry.created_at,
          read: readStates.get(`inquiry-${inquiry.id}`) ?? false,
          metadata: {
            inquiryId: inquiry.id,
            requestType: inquiry.request_type,
            email: inquiry.email,
            status: inquiry.status
          }
        }))

        notifications = [...notifications, ...inquiryNotifications]
      }

      if (filter !== 'inquiries') {
        const { data: reports, error: reportsError } = await supabase
          .from('question_reports')
          .select(`
            *,
            questions (
              title
            )
          `)
          .order('created_at', { ascending: false })
          .range(currentPage * NOTIFICATIONS_PER_PAGE, (currentPage + 1) * NOTIFICATIONS_PER_PAGE)

        if (reportsError) throw reportsError

        const reportNotifications = reports.map(report => ({
          id: report.id,
          type: 'question_report' as const,
          title: 'Question Report',
          description: `Report: ${report.report_type} for "${report.questions.title}"`,
          created_at: report.created_at,
          read: readStates.get(`report-${report.id}`) ?? false,
          metadata: {
            reportId: report.id,
            questionId: report.question_id,
            reportType: report.report_type,
            reportedBy: report.reported_by,
            status: report.status
          }
        }))

        notifications = [...notifications, ...reportNotifications]
      }

      // Sort combined notifications by date
      notifications.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setNotifications(prev => 
        loadMore ? [...prev, ...notifications] : notifications
      )
      setHasMore(notifications.length === NOTIFICATIONS_PER_PAGE)
      setPage(currentPage)
    } catch (error) {
      console.error('Error loading notifications:', error)
      toast({
        variant: "destructive",
        title: "Error loading notifications",
        description: "Please try again later"
      })
    } finally {
      setLoading(false)
    }
  }, [filter, page, supabase, toast]);

  // Initialize notifications and subscriptions
  useEffect(() => {
    loadNotifications();
    return setupSubscriptions();
  }, [filter, loadNotifications, setupSubscriptions]);

  // Mark notification as read
  const markAsRead = async (notification: Notification) => {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      const sourceType = notification.type === 'question_report' ? 'report' : 'inquiry'

      const { error } = await supabase
        .from('notification_states')
        .upsert({
          user_id: user.user.id,
          source_type: sourceType,
          source_id: notification.id,
          read: true,
          updated_at: new Date().toISOString()
        })

      if (error) throw error

      setNotifications(prev =>
        prev.map(n =>
          n.id === notification.id ? { ...n, read: true } : n
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
      toast({
        variant: "destructive",
        title: "Error updating notification",
        description: "Please try again later"
      })
    }
  }

  const getNotificationIcon = (notification: Notification) => {
    if (notification.type === 'question_report') {
      return notification.metadata.status === 'resolved' ? 
        <CheckCircle className="h-4 w-4 text-green-500" /> :
        <Flag className="h-4 w-4 text-red-500" />
    }
    
    if (notification.metadata.status === 'resolved') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    
    return notification.type === 'technical_inquiry' ?
      <AlertCircle className="h-4 w-4 text-yellow-500" /> :
      <Info className="h-4 w-4 text-blue-500" />
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
        {/* Component content remains the same */}
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
                      {notification.type !== 'question_report' && notification.metadata.email && (
                        <div className="text-sm text-muted-foreground truncate">
                          {notification.metadata.email}
                        </div>
                      )}
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