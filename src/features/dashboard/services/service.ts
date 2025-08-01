// src/lib/dashboard/service.ts
import { createClient } from '@/shared/services/server'

export interface DashboardStats {
  totalQuestions: number
  totalUsers: number
  totalImages: number
  totalInquiries: number
  pendingQuestions: number
  activeUsers: number
  recentQuestions: number
  unreadInquiries: number
  questionReports: number
  pendingReports: number
}

export interface RecentActivity {
  id: string
  type: 'question' | 'user' | 'inquiry' | 'image' | 'quiz_completed' | 'quiz_started' | 'study_streak' | 'performance_milestone'
  title: string
  description: string
  timestamp: string
  user?: string
  // Enhanced properties for the new system
  timeGroup?: string
  score?: number
  navigationUrl?: string
  priority?: 'low' | 'medium' | 'high'
  metadata?: Record<string, any>
}

export interface QuickAction {
  title: string
  description: string
  count?: number
  href: string
  urgent?: boolean
  permission?: string
  adminOnly?: boolean
}

export class DashboardService {
  private async getSupabaseClient() {
    return await createClient()
  }

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const supabase = await this.getSupabaseClient()

      // Try to use the optimized view first, fallback to individual queries
      const { data: viewData, error: viewError } = await supabase
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
      console.warn('Dashboard view failed, using individual queries:', viewError);

      // Get all counts in parallel
      const [
        questionsResult,
        usersResult,
        imagesResult,
        inquiriesResult,
        pendingQuestionsResult,
        activeUsersResult,
        questionReportsResult,
        pendingReportsResult
      ] = await Promise.all([
        supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('images').select('*', { count: 'exact', head: true }),
        supabase.from('inquiries').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('question_reports').select('*', { count: 'exact', head: true }),
        supabase.from('question_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending')
      ])

      // Get recent questions (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentQuestionsResult = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString())

      return {
        totalQuestions: questionsResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalImages: imagesResult.count || 0,
        totalInquiries: inquiriesResult.count || 0,
        pendingQuestions: pendingQuestionsResult.count || 0,
        activeUsers: activeUsersResult.count || 0,
        recentQuestions: recentQuestionsResult.count || 0,
        unreadInquiries: inquiriesResult.count || 0, // All inquiries are considered unread for now
        questionReports: questionReportsResult.count || 0,
        pendingReports: pendingReportsResult.count || 0
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      // Return default values on error
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
      const supabase = await this.getSupabaseClient()
      const activities: RecentActivity[] = []

      // Get recent questions with user names
      const { data: recentQuestions } = await supabase
        .from('questions')
        .select(`
          id,
          title,
          created_at,
          created_by,
          users!created_by(first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentQuestions) {
        for (const question of recentQuestions) {
          const user = question.users as any
          const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User'
          activities.push({
            id: question.id,
            type: 'question',
            title: 'New Question Created',
            description: question.title,
            timestamp: question.created_at,
            user: userName
          })
        }
      }

      // Get recent inquiries
      const { data: recentInquiries } = await supabase
        .from('inquiries')
        .select('id, first_name, last_name, request_type, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentInquiries) {
        for (const inquiry of recentInquiries) {
          activities.push({
            id: inquiry.id,
            type: 'inquiry',
            title: `New ${inquiry.request_type} Inquiry`,
            description: `${inquiry.first_name} ${inquiry.last_name} submitted an inquiry`,
            timestamp: inquiry.created_at
          })
        }
      }

      // Get recent users
      const { data: recentUsers } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      if (recentUsers) {
        for (const user of recentUsers) {
          const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
          const description = displayName ? `${displayName} (${user.email})` : user.email
          activities.push({
            id: user.id,
            type: 'user',
            title: 'New User Registered',
            description: description,
            timestamp: user.created_at
          })
        }
      }

      // Sort all activities by timestamp and return top 10
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)

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

export const dashboardService = new DashboardService()
