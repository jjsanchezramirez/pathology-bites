// src/features/dashboard/services/client-service.ts
import { createClient } from '@/shared/services/client'
import { DashboardStats, RecentActivity, QuickAction } from './service'

class ClientDashboardService {
  private supabase = createClient()

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Try to use the optimized view first, fallback to individual queries
      const { data: viewData, error: viewError } = await this.supabase
        .from('v_dashboard_stats')
        .select('*')
        .single();

      if (!viewError && viewData) {
        // Map view data to our interface
        return {
          totalQuestions: viewData.published_questions,
          totalUsers: viewData.total_users,
          totalImages: viewData.total_images,
          totalInquiries: viewData.total_inquiries,
          pendingQuestions: viewData.draft_questions, // This maps to 'pending' status questions
          activeUsers: viewData.recent_users, // Using recent_users as proxy for active
          recentQuestions: viewData.recent_questions,
          unreadInquiries: viewData.total_inquiries, // All inquiries are considered unread for now
          questionReports: viewData.question_reports,
          pendingReports: viewData.pending_reports
        };
      }

      // Fallback to individual queries if view fails

      // Get all stats in parallel
      // Use Promise.allSettled to handle cases where tables might not exist
      const results = await Promise.allSettled([
        this.supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        this.supabase.from('users').select('id', { count: 'exact', head: true }),
        this.supabase.from('images').select('id', { count: 'exact', head: true }),
        this.supabase.from('inquiries').select('id', { count: 'exact', head: true }),
        this.supabase.from('questions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        this.supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        this.supabase.from('questions').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        this.supabase.from('inquiries').select('id', { count: 'exact', head: true }),
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
          .select(`
            id,
            title,
            created_at,
            created_by,
            users!created_by(first_name, last_name)
          `)
          .order('created_at', { ascending: false })
          .limit(5),
        this.supabase
          .from('users')
          .select('id, first_name, last_name, created_at')
          .order('created_at', { ascending: false })
          .limit(3),
        this.supabase
          .from('inquiries')
          .select('id, first_name, last_name, email, request_type, created_at')
          .order('created_at', { ascending: false })
          .limit(3)
      ])

      const [questionsResult, usersResult, inquiriesResult] = results

      const activities: RecentActivity[] = []

      // Add question activities
      if (questionsResult.status === 'fulfilled' && questionsResult.value.data) {
        questionsResult.value.data.forEach(question => {
          const user = question.users as { first_name?: string; last_name?: string } | null
          const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User'
          activities.push({
            id: `question-${question.id}`,
            type: 'question',
            title: 'New Question Created',
            description: question.title || 'Untitled Question',
            timestamp: question.created_at,
            user: userName
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
            timestamp: user.created_at
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
            description: `${inquiry.request_type} inquiry from ${inquiry.first_name} ${inquiry.last_name}`.trim(),
            timestamp: inquiry.created_at,
            user: inquiry.email || 'Anonymous'
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
        title: 'Label Management',
        description: 'Manage categories, tags, and sets',
        href: '/admin/labels',
        permission: 'categories.manage',
        adminOnly: true
      }
    ]
  }


}

export const clientDashboardService = new ClientDashboardService()
