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
  Clock,
  Award,

  Play,
  Plus,
  BarChart3,
  Calendar
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { WelcomeMessage, PerformanceAnalytics } from "@/features/dashboard/components"
import { userSettingsService } from "@/shared/services/user-settings"

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
  recentActivity: Array<{
    id: string
    type: string
    title: string
    description: string
    timestamp: string
    score?: number
  }>

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
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(false)

  // Fetch dashboard stats and check welcome message status on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch dashboard stats
        const statsResponse = await fetch('/api/dashboard/stats')
        if (!statsResponse.ok) {
          throw new Error('Failed to fetch dashboard stats')
        }
        const statsResult = await statsResponse.json()
        setStats(statsResult.data)

        // Check if user has seen welcome message
        const hasSeenWelcome = await userSettingsService.hasSeenWelcomeMessage()
        setShowWelcomeMessage(!hasSeenWelcome)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        toast.error('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Track your progress and continue learning.
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No data available</p>
            </CardContent>
          </Card>
        </div>
      )}



      {/* Main Content Area */}
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
                  stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-4 rounded-lg border p-4">
                      {activity.type === 'quiz_completed' && <Award className="h-5 w-5 mt-0.5 text-green-500" />}
                      {activity.type === 'study_streak' && <TrendingUp className="h-5 w-5 mt-0.5 text-blue-500" />}
                      {activity.type === 'quiz_started' && <Play className="h-5 w-5 mt-0.5 text-orange-500" />}
                      <div className="space-y-1 flex-1">
                        <p className="text-sm font-medium leading-none">{activity.title}</p>
                        <p className="text-sm text-muted-foreground">{activity.description}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">{activity.timestamp}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No recent activity. Start a quiz to see your progress!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

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
                <Clock className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Performance Analytics */}
      {stats?.performance && (
        <PerformanceAnalytics data={stats.performance} />
      )}
    </div>
  )
}