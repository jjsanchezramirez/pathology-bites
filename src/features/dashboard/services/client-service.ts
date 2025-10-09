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
          totalQuestions: viewData.total_questions,
          totalUsers: viewData.total_users,
          totalImages: viewData.total_images,
          totalInquiries: viewData.total_inquiries,
          pendingQuestions: viewData.pending_questions, // Questions with 'pending_review' status
          rejectedQuestions: viewData.rejected_questions, // Questions with 'rejected' status
          activeUsers: viewData.active_users, // Users with 'active' status
          recentQuestions: viewData.recent_questions,
          unreadInquiries: viewData.unread_inquiries, // Inquiries with 'open' status
          questionReports: viewData.question_reports,
          pendingReports: viewData.pending_reports,
          draftQuestions: viewData.draft_questions, // Questions with 'draft' status
          flaggedQuestions: viewData.flagged_questions // Questions with 'flagged' status
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
        pendingReports: getCounts(9),
        rejectedQuestions: 0,
        draftQuestions: 0,
        flaggedQuestions: 0
      }
    } catch (error) {
      // Return default stats on error
      return {
        totalQuestions: 0,
        totalUsers: 0,
        totalImages: 0,
        totalInquiries: 0,
        pendingQuestions: 0,
        rejectedQuestions: 0,
        activeUsers: 0,
        recentQuestions: 0,
        unreadInquiries: 0,
        questionReports: 0,
        pendingReports: 0,
        draftQuestions: 0,
        flaggedQuestions: 0
      }
    }
  }

  async getRecentActivity(userRole?: string, userId?: string): Promise<RecentActivity[]> {
    try {
      const activities: RecentActivity[] = []

      // Role-based activity filtering
      if (userRole === 'admin') {
        // Admins see all activities
        await this.getAdminActivities(activities)
      } else if (userRole === 'creator') {
        // Creators see their own questions and status changes
        await this.getCreatorActivities(activities, userId)
      } else if (userRole === 'reviewer') {
        // Reviewers see pending reviews and their review activity
        await this.getReviewerActivities(activities, userId)
      } else {
        // Default: get general recent questions
        await this.getGeneralActivities(activities)
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



  getQuickActions(stats: DashboardStats, userRole?: string): QuickAction[] {
    if (userRole === 'admin') {
      return this.getAdminQuickActions(stats)
    } else if (userRole === 'creator') {
      return this.getCreatorQuickActions(stats)
    } else if (userRole === 'reviewer') {
      return this.getReviewerQuickActions(stats)
    } else {
      return this.getDefaultQuickActions(stats)
    }
  }

  private getAdminQuickActions(stats: DashboardStats): QuickAction[] {
    return [
      {
        title: 'Create Question',
        description: 'Add a new pathology question',
        href: '/admin/create-question',
        permission: 'questions.create'
      },
      {
        title: 'Review Pending Questions',
        description: `${stats.pendingQuestions} awaiting review`,
        count: stats.pendingQuestions,
        href: '/admin/questions/review',
        urgent: stats.pendingQuestions > 0,
        permission: 'questions.review'
      },
      {
        title: 'Manage Users',
        description: `${stats.activeUsers} active users`,
        count: stats.activeUsers,
        href: '/admin/users',
        permission: 'users.manage'
      },
      {
        title: 'View Reports',
        description: `${stats.pendingReports} flagged questions`,
        count: stats.pendingReports,
        href: '/admin/questions/flagged',
        urgent: stats.pendingReports > 0,
        permission: 'questions.review'
      },
      {
        title: 'System Settings',
        description: 'Configure platform settings',
        href: '/admin/settings',
        permission: 'settings.manage'
      },
      {
        title: 'Manage Images',
        description: `${stats.totalImages} images available`,
        count: stats.totalImages,
        href: '/admin/images',
        permission: 'images.manage'
      }
    ]
  }

  private getCreatorQuickActions(stats: DashboardStats): QuickAction[] {
    return [
      {
        title: 'Create New Question',
        description: 'Add a new pathology question',
        href: '/admin/create-question',
        permission: 'questions.create'
      },
      {
        title: 'View My Drafts',
        description: `${stats.draftQuestions} draft questions`,
        count: stats.draftQuestions,
        href: '/admin/my-questions?status=draft',
        permission: 'questions.create'
      },
      {
        title: 'View Rejected Questions',
        description: `${stats.rejectedQuestions} need revision`,
        count: stats.rejectedQuestions,
        href: '/admin/my-questions?status=rejected',
        urgent: stats.rejectedQuestions > 0,
        permission: 'questions.create'
      },
      {
        title: 'Upload Images',
        description: 'Add images to library',
        href: '/admin/images/upload',
        permission: 'images.manage'
      }
    ]
  }

  private getReviewerQuickActions(stats: DashboardStats): QuickAction[] {
    return [
      {
        title: 'Review Pending Questions',
        description: `${stats.pendingQuestions} awaiting review`,
        count: stats.pendingQuestions,
        href: '/admin/questions/review',
        urgent: stats.pendingQuestions > 0,
        permission: 'questions.review'
      },
      {
        title: 'View My Reviews',
        description: 'Questions I have reviewed',
        href: '/admin/questions/my-reviews',
        permission: 'questions.review'
      },
      {
        title: 'Flagged Questions',
        description: `${stats.pendingReports} need attention`,
        count: stats.pendingReports,
        href: '/admin/questions/flagged',
        urgent: stats.pendingReports > 0,
        permission: 'questions.review'
      }
    ]
  }

  private getDefaultQuickActions(stats: DashboardStats): QuickAction[] {
    return [
      {
        title: 'View Questions',
        description: `${stats.totalQuestions} questions available`,
        count: stats.totalQuestions,
        href: '/admin/questions',
        permission: 'questions.view'
      }
    ]
  }

  // Role-specific activity methods
  private async getAdminActivities(activities: RecentActivity[]): Promise<void> {
    // Admins see comprehensive activity: users, questions, reviews, system events
    const [questionsData, usersData, inquiriesData] = await Promise.allSettled([
      this.supabase
        .from('questions')
        .select(`
          id, title, status, created_at, updated_at,
          created_by, updated_by,
          users!created_by(first_name, last_name),
          reviewer:users!reviewer_id(first_name, last_name)
        `)
        .order('updated_at', { ascending: false })
        .limit(5),

      this.supabase
        .from('users')
        .select('id, first_name, last_name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(3),

      this.supabase
        .from('inquiries')
        .select('id, first_name, last_name, request_type, created_at')
        .order('created_at', { ascending: false })
        .limit(3)
    ])

    // Process questions
    if (questionsData.status === 'fulfilled' && questionsData.value.data) {
      for (const question of questionsData.value.data) {
        const creator = question.users as any
        const creatorName = creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User'

        activities.push({
          id: question.id,
          type: 'question',
          title: `Question ${question.status === 'pending_review' ? 'Submitted for Review' : question.status === 'published' ? 'Published' : question.status === 'rejected' ? 'Rejected' : 'Updated'}`,
          description: question.title,
          timestamp: question.updated_at,
          user: creatorName
        })
      }
    }

    // Process users
    if (usersData.status === 'fulfilled' && usersData.value.data) {
      for (const user of usersData.value.data) {
        const displayName = `${user.first_name || ''} ${user.last_name || ''}`.trim()
        activities.push({
          id: user.id,
          type: 'user',
          title: 'New User Registered',
          description: displayName || user.email,
          timestamp: user.created_at
        })
      }
    }

    // Process inquiries
    if (inquiriesData.status === 'fulfilled' && inquiriesData.value.data) {
      for (const inquiry of inquiriesData.value.data) {
        activities.push({
          id: inquiry.id,
          type: 'inquiry',
          title: `New ${inquiry.request_type} Inquiry`,
          description: `${inquiry.first_name} ${inquiry.last_name}`,
          timestamp: inquiry.created_at
        })
      }
    }
  }

  private async getCreatorActivities(activities: RecentActivity[], userId?: string): Promise<void> {
    if (!userId) return

    // Creators see their own questions and status changes
    const { data: myQuestions } = await this.supabase
      .from('questions')
      .select(`
        id, title, status, created_at, updated_at,
        reviewer_feedback, rejected_at,
        reviewer:users!reviewer_id(first_name, last_name)
      `)
      .eq('created_by', userId)
      .order('updated_at', { ascending: false })
      .limit(10)

    if (myQuestions) {
      for (const question of myQuestions) {
        let title = 'Question Updated'
        let priority: 'low' | 'medium' | 'high' = 'low'

        if (question.status === 'rejected') {
          title = 'Question Rejected'
          priority = 'high'
        } else if (question.status === 'published') {
          title = 'Question Published'
          priority = 'medium'
        } else if (question.status === 'pending_review') {
          title = 'Question Submitted for Review'
          priority = 'medium'
        }

        activities.push({
          id: question.id,
          type: 'question',
          title,
          description: question.title,
          timestamp: question.updated_at,
          priority,
          metadata: {
            status: question.status,
            feedback: question.reviewer_feedback
          }
        })
      }
    }
  }

  private async getReviewerActivities(activities: RecentActivity[], userId?: string): Promise<void> {
    // Reviewers see pending reviews and their review activity
    const [pendingData, reviewedData] = await Promise.allSettled([
      this.supabase
        .from('questions')
        .select(`
          id, title, status, created_at,
          created_by,
          users!created_by(first_name, last_name)
        `)
        .eq('status', 'pending_review')
        .order('created_at', { ascending: false })
        .limit(8),

      userId ? this.supabase
        .from('questions')
        .select(`
          id, title, status, updated_at,
          created_by,
          users!created_by(first_name, last_name)
        `)
        .eq('reviewer_id', userId)
        .in('status', ['published', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(5) : Promise.resolve({ data: [] })
    ])

    // Process pending reviews
    if (pendingData.status === 'fulfilled' && pendingData.value.data) {
      for (const question of pendingData.value.data) {
        const creator = question.users as any
        const creatorName = creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User'

        activities.push({
          id: question.id,
          type: 'question',
          title: 'Question Pending Review',
          description: question.title,
          timestamp: question.created_at,
          user: creatorName,
          priority: 'high'
        })
      }
    }

    // Process reviewed questions
    if (reviewedData.status === 'fulfilled' && reviewedData.value.data) {
      for (const question of reviewedData.value.data) {
        const creator = question.users as any
        const creatorName = creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User'

        activities.push({
          id: question.id,
          type: 'question',
          title: `Question ${question.status === 'published' ? 'Approved' : 'Rejected'}`,
          description: question.title,
          timestamp: question.updated_at,
          user: creatorName
        })
      }
    }
  }

  private async getGeneralActivities(activities: RecentActivity[]): Promise<void> {
    // Default: get general recent questions
    const { data: recentQuestions } = await this.supabase
      .from('questions')
      .select(`
        id, title, created_at,
        created_by,
        users!created_by(first_name, last_name)
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(8)

    if (recentQuestions) {
      for (const question of recentQuestions) {
        const user = question.users as any
        const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Unknown User' : 'Unknown User'
        activities.push({
          id: question.id,
          type: 'question',
          title: 'New Question Published',
          description: question.title,
          timestamp: question.created_at,
          user: userName
        })
      }
    }
  }
}

export const clientDashboardService = new ClientDashboardService()
