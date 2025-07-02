// src/features/dashboard/services/client-service.ts
'use client'

import { createClient } from '@/shared/services/client'
import { DashboardStats, RecentActivity, QuickAction } from './service'

class ClientDashboardService {
  private supabase = createClient()

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get all stats in parallel
      // Use Promise.allSettled to handle cases where tables might not exist
      const results = await Promise.allSettled([
        this.supabase.from('questions').select('id', { count: 'exact', head: true }),
        this.supabase.from('users').select('id', { count: 'exact', head: true }),
        this.supabase.from('images').select('id', { count: 'exact', head: true }),
        this.supabase.from('inquiries').select('id', { count: 'exact', head: true }),
        this.supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        this.supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        this.supabase.from('questions').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        this.supabase.from('inquiries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        this.supabase.from('question_reports').select('id', { count: 'exact', head: true }),
        this.supabase.from('question_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending')
      ])

      // Extract counts, defaulting to 0 if query failed
      const getCounts = (index: number) => {
        const result = results[index]
        return result.status === 'fulfilled' && result.value.count !== null ? result.value.count : 0
      }

      return {
        totalQuestions: getCounts(0),
        totalUsers: getCounts(1),
        totalImages: getCounts(2),
        totalInquiries: getCounts(3),
        pendingQuestions: getCounts(4),
        activeUsers: getCounts(5),
        recentQuestions: getCounts(6),
        unreadInquiries: getCounts(7),
        questionReports: getCounts(8),
        pendingReports: getCounts(9)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      // Return default stats on error
      return {
        totalQuestions: 0,
        totalUsers: 0,
        totalImages: 0,
        totalInquiries: 0,
        pendingQuestions: 0,
        activeUsers: 0,
        recentQuestions: 0,
        unreadInquiries: 0,
        questionReports: 0,
        pendingReports: 0
      }
    }
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    try {
      // Get recent activities from different tables using Promise.allSettled
      const results = await Promise.allSettled([
        this.supabase
          .from('questions')
          .select('id, title, created_at, created_by')
          .order('created_at', { ascending: false })
          .limit(5),
        this.supabase
          .from('users')
          .select('id, first_name, last_name, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        this.supabase
          .from('inquiries')
          .select('id, subject, created_at, user_email')
          .order('created_at', { ascending: false })
          .limit(3)
      ])

      const [questionsResult, usersResult, inquiriesResult] = results

      const activities: RecentActivity[] = []

      // Add question activities
      if (questionsResult.status === 'fulfilled' && questionsResult.value.data) {
        questionsResult.value.data.forEach(question => {
          activities.push({
            id: `question-${question.id}`,
            type: 'question',
            title: 'New Question Created',
            description: question.title || 'Untitled Question',
            timestamp: this.formatTimestamp(question.created_at),
            user: question.created_by || 'Unknown'
          })
        })
      }

      // Add user activities
      if (usersResult.status === 'fulfilled' && usersResult.value.data) {
        usersResult.value.data.forEach(user => {
          activities.push({
            id: `user-${user.id}`,
            type: 'user',
            title: 'New User Registered',
            description: `${user.first_name} ${user.last_name}`.trim() || 'New User',
            timestamp: this.formatTimestamp(user.created_at)
          })
        })
      }

      // Add inquiry activities
      if (inquiriesResult.status === 'fulfilled' && inquiriesResult.value.data) {
        inquiriesResult.value.data.forEach(inquiry => {
          activities.push({
            id: `inquiry-${inquiry.id}`,
            type: 'inquiry',
            title: 'New Inquiry Received',
            description: inquiry.subject || 'General Inquiry',
            timestamp: this.formatTimestamp(inquiry.created_at),
            user: inquiry.user_email || 'Anonymous'
          })
        })
      }

      // Sort by timestamp and return top 10
      const sortedActivities = activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)

      // If no activities, return some default ones
      if (sortedActivities.length === 0) {
        return [
          {
            id: 'default-1',
            type: 'question',
            title: 'Welcome to Admin Dashboard',
            description: 'Start by creating your first question',
            timestamp: 'Just now'
          }
        ]
      }

      return sortedActivities

    } catch (error) {
      console.error('Error fetching recent activity:', error)
      return []
    }
  }

  getQuickActions(stats: DashboardStats): QuickAction[] {
    return [
      {
        title: 'Review Draft Questions',
        description: `${stats.pendingQuestions} questions awaiting review`,
        count: stats.pendingQuestions,
        href: '/admin/questions/review',
        urgent: stats.pendingQuestions > 0,
        permission: 'questions.review'
      },
      {
        title: 'Review Queue',
        description: `${stats.pendingReports} flagged questions to review`,
        count: stats.pendingReports,
        href: '/admin/questions/review-queue',
        urgent: stats.pendingReports > 0,
        permission: 'questions.review'
      },
      {
        title: 'Manage Inquiries',
        description: `${stats.unreadInquiries} inquiries to review`,
        count: stats.unreadInquiries,
        href: '/admin/inquiries',
        urgent: stats.unreadInquiries > 5,
        permission: 'inquiries.manage',
        adminOnly: true
      },
      {
        title: 'Add New Question',
        description: 'Create a new pathology question',
        href: '/admin/questions/create',
        permission: 'questions.create',
        adminOnly: true
      },
      {
        title: 'Manage Images',
        description: `${stats.totalImages} images in library`,
        count: stats.totalImages,
        href: '/admin/images',
        permission: 'images.manage',
        adminOnly: true
      },
      {
        title: 'User Management',
        description: `${stats.activeUsers} active users`,
        count: stats.activeUsers,
        href: '/admin/users',
        permission: 'users.manage',
        adminOnly: true
      },
      {
        title: 'Question Management',
        description: 'Manage categories, tags, and sets',
        href: '/admin/question-management',
        permission: 'categories.manage',
        adminOnly: true
      }
    ]
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60)
      return `${hours} hour${hours === 1 ? '' : 's'} ago`
    } else {
      const days = Math.floor(diffInMinutes / 1440)
      return `${days} day${days === 1 ? '' : 's'} ago`
    }
  }
}

export const clientDashboardService = new ClientDashboardService()
