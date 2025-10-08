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

} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { WelcomeMessage, PerformanceAnalytics } from "@/features/dashboard/components"
// import { EnhancedRecentActivity } from "@/features/dashboard/components/enhanced-recent-activity"
import { SimpleGoalsWidget } from "@/features/dashboard/components/simple-goals-widget"
import { useAuthStatus } from "@/features/auth/hooks/use-auth-status"
import { userSettingsService } from "@/shared/services/user-settings"
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
  const [isFirstTimeUser, setIsFirstTimeUser] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)

  // Fetch dashboard stats and check welcome message status on component mount
  useEffect(() => {
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

        // Check if user has seen welcome message
        const hasSeenWelcome = await userSettingsService.hasSeenWelcomeMessage()
        setShowWelcomeMessage(!hasSeenWelcome)

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
  }, [])

  return (
    <PageErrorBoundary pageName="Dashboard" showHomeButton={false} showBackButton={false}>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          Dashboard
          <span className="text-sm font-medium px-2 py-1 bg-secondary/50 text-secondary-foreground rounded-md">
            Student
          </span>
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

      {/* Welcome Message for First-Time Users */}
      {showWelcomeMessage && (
        <WelcomeMessage onDismiss={() => setShowWelcomeMessage(false)} />
      )}

      {/* Stats Cards */}
      {loading ? (
        <StatsLoading />
      ) : stats ? (
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
              <CardTitle className="text-sm font-medium">All Questions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.allQuestions || stats.totalQuestions || 0}</div>
              <p className="text-xs text-muted-foreground">
                Total questions available
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No data available</p>
            </CardContent>
          </Card>
        </div>
      )}





      {/* Recent Activity Section */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Activity */}
        {loading ? (
          <ActivityLoading />
        ) : (
          <Card className="md:col-span-4">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                  stats.recentActivity.map((activity) => {
                    const activityContent = (
                      <div className={`flex items-start gap-4 rounded-lg border p-4 transition-all duration-200 ${
                        activity.navigationUrl ? 'hover:bg-muted/30 hover:shadow-sm cursor-pointer' : ''
                      } bg-card/50`}>
                        {/* Activity Icons - simplified without colors */}
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                          {activity.type === 'quiz_completed' && <Award className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === 'study_streak' && <TrendingUp className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === 'quiz_started' && <Play className="h-4 w-4 text-muted-foreground" />}
                          {activity.type === 'performance_milestone' && <Target className="h-4 w-4 text-muted-foreground" />}
                          {!['quiz_completed', 'study_streak', 'quiz_started', 'performance_milestone'].includes(activity.type) &&
                            <BookOpen className="h-4 w-4 text-muted-foreground" />}
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none truncate">{activity.title}</p>
                            {activity.timeGroup === 'today' && (
                              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-md font-medium">Today</span>
                            )}
                            {activity.timeGroup === 'yesterday' && (
                              <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-md font-medium">Yesterday</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{activity.description}</p>
                          {activity.metadata?.improvement && (
                            <p className="text-xs text-foreground/70 font-medium">
                              {activity.metadata.improvement > 0 ? '↗' : '↘'} {Math.abs(activity.metadata.improvement)}% change
                            </p>
                          )}
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="text-xs text-muted-foreground">{activity.timestamp}</div>
                          {activity.score && (
                            <div className="text-sm font-medium mt-1">{activity.score}%</div>
                          )}
                          {activity.navigationUrl && (
                            <div className="text-xs text-muted-foreground mt-1 opacity-70">View →</div>
                          )}
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
        )}

        {/* Quick Actions */}
        {loading ? (
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
        ) : (
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
                  <Clock className="h-4 w-4" />
                </Button>
              </Link>

              <Button
                variant="outline"
                className="w-full justify-between opacity-50 cursor-not-allowed"
                disabled
                onClick={() => toast.info('Goals feature coming soon!')}
              >
                Goals
                <Target className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                className="w-full justify-between opacity-50 cursor-not-allowed"
                disabled
                onClick={() => toast.info('Learning Modules feature coming soon!')}
              >
                Learning Modules
                <BookOpen className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance Analytics */}
      {loading ? (
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

          {/* Performance Details Skeleton */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-32" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-2 w-24" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <Skeleton className="h-4 w-28" />
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-2 w-20" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        stats?.performance && (
          <FeatureErrorBoundary featureName="Performance Analytics">
            <PerformanceAnalytics data={stats.performance} />
          </FeatureErrorBoundary>
        )
      )}

      {/* Goals and Learning Modules Section - In Development */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Goals Section - 1/3 width */}
        <Card className="md:col-span-1">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Goals
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Set and track objectives
                </p>
              </div>
              <div className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                In Dev
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-6 text-muted-foreground">
              <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="mb-2 text-sm">Goals coming soon!</p>
              <p className="text-xs mb-4">Track your progress and stay motivated.</p>
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                disabled
                onClick={() => toast.info('Goals feature is currently in development!')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Goal
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Learning Modules Section - 2/3 width */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Learning Modules
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Structured learning paths for comprehensive education
                </p>
              </div>
              <div className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-full">
                In Development
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Learning Modules coming soon!</p>
              <p className="text-sm mb-6">Follow guided learning paths with interactive content, assessments, and progress tracking.</p>
              <Button
                className="w-full"
                variant="outline"
                disabled
                onClick={() => toast.info('Learning Modules feature is currently in development!')}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Browse Modules
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>


      </div>
    </PageErrorBoundary>
  )
}