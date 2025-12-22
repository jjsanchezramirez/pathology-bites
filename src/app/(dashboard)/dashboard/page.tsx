// src/app/(dashboard)/dashboard/page.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Skeleton } from "@/shared/components/ui/skeleton"
import {
  BookOpen,
  Target,
  TrendingUp,
  Plus,
  Play,
  BarChart3,
  Calendar,
  Award,
  Clock,
  Microscope,
  Library,
  ClipboardList,
} from "lucide-react"
import { toast } from '@/shared/utils/toast'
import Link from "next/link"
import { WelcomeMessage, SecurityNotice, PerformanceAnalytics } from "@/features/dashboard/components"
// import { EnhancedRecentActivity } from "@/features/dashboard/components/enhanced-recent-activity"
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

// Loading components
function StatsLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ActivityLoading() {
  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start space-x-4 p-3">
              <Skeleton className="h-4 w-4 mt-1" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
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
          <StatsLoading />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <ActivityLoading />
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-6">
            {/* Performance Overview Skeleton */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="text-center space-y-2">
                      <Skeleton className="h-8 w-16 mx-auto" />
                      <Skeleton className="h-4 w-24 mx-auto" />
                      <Skeleton className="h-3 w-20 mx-auto" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
              <BookOpen className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.needsReview || 0}</div>
              <p className="text-xs text-muted-foreground">
                Questions to practice more
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Mastered</CardTitle>
              <Target className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.mastered || 0}</div>
              <p className="text-xs text-muted-foreground">
                Questions answered correctly
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unused</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.unused || 0}</div>
              <p className="text-xs text-muted-foreground">
                Questions to explore
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.completedQuestions || 0}</div>
              <p className="text-xs text-muted-foreground">
                Questions attempted
              </p>
            </CardContent>
          </Card>
        </div>





      {/* Recent Activity Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity) => {
                    const activityContent = (
                      <div className={`flex items-center gap-3 rounded-md border p-3 transition-all duration-200 ${
                        activity.navigationUrl ? 'hover:bg-muted/30 hover:border-muted-foreground/30 cursor-pointer' : ''
                      }`}>
                        {/* Activity Icons - compact with color coding */}
                        <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                          activity.type === 'quiz_completed' ? 'bg-green-100 dark:bg-green-950' :
                          activity.type === 'quiz_started' ? 'bg-blue-100 dark:bg-blue-950' :
                          'bg-muted'
                        }`}>
                          {activity.type === 'quiz_completed' && <Award className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
                          {activity.type === 'study_streak' && <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />}
                          {activity.type === 'quiz_started' && <Play className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                          {activity.type === 'performance_milestone' && <Target className="h-3.5 w-3.5 text-muted-foreground" />}
                          {!['quiz_completed', 'study_streak', 'quiz_started', 'performance_milestone'].includes(activity.type) &&
                            <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">{activity.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{activity.description}</p>
                        </div>

                        <div className="text-right flex-shrink-0 flex items-center gap-2">
                          {activity.score !== undefined && (
                            <div className={`text-sm font-semibold px-2 py-0.5 rounded ${
                              activity.score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' :
                              activity.score >= 60 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400' :
                              'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                            }`}>
                              {activity.score}%
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground whitespace-nowrap">{activity.timestamp}</div>
                        </div>
                      </div>
                    )

                    // Return either a Link or div based on whether navigationUrl exists
                    return activity.navigationUrl ? (
                      <Link key={activity.id} href={activity.navigationUrl} className="block">
                        {activityContent}
                      </Link>
                    ) : (
                      <div key={activity.id}>
                        {activityContent}
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No recent activity. Start a quiz to see your progress!</p>
                    <Link href="/dashboard/quiz/new" className="inline-block mt-2">
                      <Button size="sm">Start Your First Quiz</Button>
                    </Link>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        {/* Quick Actions */}
        <Card className="md:col-span-3">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link href="/dashboard/quiz/new" className="block">
                <Button className="w-full justify-between">
                  Start New Quiz
                  <Plus className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/dashboard/performance" className="block">
                <Button variant="outline" className="w-full justify-between">
                  View Performance
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/dashboard/quizzes" className="block">
                <Button variant="outline" className="w-full justify-between">
                  My Quizzes
                  <ClipboardList className="h-4 w-4" />
                </Button>
              </Link>

              <div className="relative">
                <Link href="/dashboard/wsi-questions" className="block">
                  <Button variant="outline" className="w-full justify-between">
                    Slide-Based Questions
                    <Microscope className="h-4 w-4" />
                  </Button>
                </Link>
                <span className="absolute -top-2 -right-2 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  New
                </span>
              </div>

              <Link href="/dashboard/anki" className="block">
                <Button variant="outline" className="w-full justify-between">
                  Ankoma Deck Viewer
                  <Library className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/dashboard/progress" className="block">
                <Button variant="outline" className="w-full justify-between">
                  My Progress
                  <TrendingUp className="h-4 w-4" />
                </Button>
              </Link>

              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full justify-between opacity-50 cursor-not-allowed"
                  disabled
                >
                  Learning Modules
                  <BookOpen className="h-4 w-4" />
                </Button>
                <span className="absolute -top-2 -right-2 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                  Soon
                </span>
              </div>
            </CardContent>
          </Card>
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