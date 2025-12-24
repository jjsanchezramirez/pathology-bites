// src/app/(dashboard)/dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { toast } from '@/shared/utils/toast'
import {
  WelcomeMessage,
  SecurityNotice,
  PerformanceAnalytics,
  StudentStatsCards,
  StudentStatsCardsLoading,
  StudentRecentActivity,
  StudentRecentActivityLoading,
  StudentQuickActions,
  StudentQuickActionsLoading
} from "@/features/dashboard/components"
import { useAuthStatus } from "@/features/auth/hooks/use-auth-status"
import { userSettingsService } from "@/shared/services/user-settings"
import { useUserSettings } from "@/shared/hooks/use-user-settings"
import { RecentActivity } from "@/features/dashboard/services/service"
import { PageErrorBoundary, FeatureErrorBoundary } from "@/shared/components/common"

interface DashboardStats {
  // New meaningful categories
  allQuestions?: number
  needsReview?: number
  mastered?: number
  unused?: number

  // Legacy fields for backward compatibility
  totalQuestions: number
  completedQuestions: number

  // Other stats
  averageScore: number
  studyStreak: number
  recentQuizzes: number
  weeklyGoal: number
  currentWeekProgress: number
  recentActivity: RecentActivity[]

  // Performance analytics
  performance?: {
    userPercentile: number
    peerRank: number
    totalUsers: number
    completedQuizzes: number
    subjectsForImprovement: Array<{
      name: string
      score: number
      attempts: number
    }>
    subjectsMastered: Array<{
      name: string
      score: number
      attempts: number
    }>
    overallScore: number
  }
}

export default function DashboardPage() {
  const { user } = useAuthStatus()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)
  const [showSecurityNotice, setShowSecurityNotice] = useState(false)
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)

  // Use cached user settings (eliminates redundant API call)
  const { data: userSettings } = useUserSettings({
    enabled: !!user
  })

  // Fetch dashboard stats and check welcome message status on component mount
  useEffect(() => {
    // Don't fetch until user is loaded
    if (!user) {
      return
    }

    const fetchData = async () => {
      try {
        // Fetch dashboard stats
        const statsResponse = await fetch('/api/user/dashboard/stats')
        if (!statsResponse.ok) {
          throw new Error(`Failed to fetch dashboard stats: ${statsResponse.status}`)
        }

        // Check if response is JSON
        const contentType = statsResponse.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Dashboard API returned non-JSON response')
        }

        const statsResult = await statsResponse.json()
        if (!statsResult.success) {
          throw new Error(statsResult.error || 'Dashboard API returned error')
        }
        setStats(statsResult.data)

        // Check if user has seen welcome message (use cached settings if available)
        const hasSeenWelcome = userSettings?.ui_settings?.welcome_message_seen ??
                               await userSettingsService.hasSeenWelcomeMessage()
        setShowWelcomeMessage(!hasSeenWelcome)

        // Check if security notice has been dismissed (use cached settings if available)
        const securityNoticeDismissed = userSettings?.ui_settings?.security_notice_dismissed ??
                                        await userSettingsService.hasSeenSecurityNotice()
        setShowSecurityNotice(!securityNoticeDismissed)

        // Determine user status based on activity
        const isFirstTime = !hasSeenWelcome && (statsResult.data.recentQuizzes === 0 || statsResult.data.completedQuestions === 0)
        setIsFirstTimeUser(isFirstTime)

        // Check if user is returning after 7+ days (based on recent activity)
        const hasRecentActivity = statsResult.data.recentActivity && statsResult.data.recentActivity.length > 0
        if (hasRecentActivity && !isFirstTime) {
          // If they have activity but the most recent is more than 7 days old
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

          // This is a simplified check - in a real implementation you'd parse the timestamp
          setIsReturningUser(!hasRecentActivity || statsResult.data.recentQuizzes === 0)
        }
      } catch (error) {

        // Provide more specific error messages
        if (error instanceof Error) {
          if (error.message.includes('JSON')) {
            toast.error('Dashboard data format error. Please refresh the page.')
          } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            toast.error('Please log in again to view your dashboard.')
          } else {
            toast.error(`Failed to load dashboard: ${error.message}`)
          }
        } else {
          toast.error('Failed to load dashboard data')
        }
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.id])

  return (
    <PageErrorBoundary pageName="Dashboard" showHomeButton={false} showBackButton={false}>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          {isFirstTimeUser
            ? "Nice to meet you! Let's get you started with a quick quiz."
            : isReturningUser
            ? "Good to see you again! Ready to pick up where you left off?"
            : "Welcome back! Ready to continue your learning journey?"
          }
        </p>
      </div>

      {/* Security Notice */}
      {showSecurityNotice && (
        <SecurityNotice onDismiss={() => setShowSecurityNotice(false)} />
      )}

      {/* Welcome Message for First-Time Users */}
      {showWelcomeMessage && (
        <WelcomeMessage onDismiss={() => setShowWelcomeMessage(false)} />
      )}

      {/* Show loading state for everything until data is ready */}
      {loading || !stats ? (
        <>
          <StudentStatsCardsLoading />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <StudentRecentActivityLoading />
            <StudentQuickActionsLoading />
          </div>
        </>
      ) : (
        <>
        {/* Stats Cards */}
        <StudentStatsCards stats={stats} />

        {/* Recent Activity Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <StudentRecentActivity activities={stats.recentActivity} />
          <StudentQuickActions />
        </div>

      {/* Performance Analytics */}
      {stats?.performance && (
        <FeatureErrorBoundary featureName="Performance Analytics">
          <PerformanceAnalytics data={stats.performance} />
        </FeatureErrorBoundary>
      )}
      </>
      )}

      </div>
    </PageErrorBoundary>
  )
}