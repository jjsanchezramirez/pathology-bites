// src/lib/dashboard/service.ts
import { createClient } from '@/lib/supabase/client'

export interface DashboardStats {
  totalQuestions: number
  totalUsers: number
  totalImages: number
  totalInquiries: number
  pendingQuestions: number
  activeUsers: number
  recentQuestions: number
  unreadInquiries: number
}

export interface RecentActivity {
  id: string
  type: 'question' | 'user' | 'inquiry' | 'image'
  title: string
  description: string
  timestamp: string
  user?: string
}

export interface QuickAction {
  title: string
  description: string
  count?: number
  href: string
  urgent?: boolean
}

export class DashboardService {
  private supabase = createClient()

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get all counts in parallel
      const [
        questionsResult,
        usersResult,
        imagesResult,
        inquiriesResult,
        pendingQuestionsResult,
        activeUsersResult
      ] = await Promise.all([
        this.supabase.from('questions').select('*', { count: 'exact', head: true }),
        this.supabase.from('users').select('*', { count: 'exact', head: true }),
        this.supabase.from('images').select('*', { count: 'exact', head: true }),
        this.supabase.from('inquiries').select('*', { count: 'exact', head: true }),
        this.supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
        this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'active')
      ])

      // Get recent questions (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const recentQuestionsResult = await this.supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString())

      // Get unread inquiries (assuming we want to count all inquiries as potentially unread)
      const unreadInquiriesResult = await this.supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })

      return {
        totalQuestions: questionsResult.count || 0,
        totalUsers: usersResult.count || 0,
        totalImages: imagesResult.count || 0,
        totalInquiries: inquiriesResult.count || 0,
        pendingQuestions: pendingQuestionsResult.count || 0,
        activeUsers: activeUsersResult.count || 0,
        recentQuestions: recentQuestionsResult.count || 0,
        unreadInquiries: unreadInquiriesResult.count || 0
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
        unreadInquiries: 0
      }
    }
  }

  async getRecentActivity(): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = []

      // Get recent questions
      const { data: recentQuestions } = await this.supabase
        .from('questions')
        .select('id, title, created_at, created_by')
        .order('created_at', { ascending: false })
        .limit(5)

      if (recentQuestions) {
        for (const question of recentQuestions) {
          activities.push({
            id: question.id,
            type: 'question',
            title: 'New Question Added',
            description: question.title,
            timestamp: question.created_at,
            user: question.created_by
          })
        }
      }

      // Get recent inquiries
      const { data: recentInquiries } = await this.supabase
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
      const { data: recentUsers } = await this.supabase
        .from('users')
        .select('id, first_name, last_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(3)

      if (recentUsers) {
        for (const user of recentUsers) {
          activities.push({
            id: user.id,
            type: 'user',
            title: 'New User Registered',
            description: `${user.first_name || ''} ${user.last_name || ''} (${user.email})`.trim(),
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
        title: 'Review Pending Questions',
        description: `${stats.pendingQuestions} questions awaiting review`,
        count: stats.pendingQuestions,
        href: '/admin/questions?status=draft',
        urgent: stats.pendingQuestions > 0
      },
      {
        title: 'Manage Inquiries',
        description: `${stats.unreadInquiries} inquiries to review`,
        count: stats.unreadInquiries,
        href: '/admin/inquiries',
        urgent: stats.unreadInquiries > 5
      },
      {
        title: 'Add New Question',
        description: 'Create a new pathology question',
        href: '/admin/questions/new'
      },
      {
        title: 'Manage Images',
        description: `${stats.totalImages} images in library`,
        count: stats.totalImages,
        href: '/admin/images'
      },
      {
        title: 'User Management',
        description: `${stats.activeUsers} active users`,
        count: stats.activeUsers,
        href: '/admin/users'
      },
      {
        title: 'Question Management',
        description: 'Manage categories, tags, and sets',
        href: '/admin/question-management'
      }
    ]
  }
}

export const dashboardService = new DashboardService()
