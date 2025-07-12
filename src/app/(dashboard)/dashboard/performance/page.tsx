// src/app/(dashboard)/dashboard/performance/page.tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Progress } from "@/shared/components/ui/progress"
import {
  BarChart3,
  TrendingUp,
  Target,
  Clock,
  Award,
  CheckCircle,
  XCircle,
  Calendar
} from "lucide-react"
import { QuizStats } from "@/features/quiz/types/quiz"
import { toast } from "sonner"

export default function PerformancePage() {
  const [stats, setStats] = useState<QuizStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch performance stats on component mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/quiz/stats')
        if (!response.ok) {
          throw new Error('Failed to fetch performance stats')
        }
        const result = await response.json()
        setStats(result.data)
      } catch (error) {
        console.error('Error fetching performance stats:', error)
        toast.error('Failed to load performance data')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground">Loading your performance data...</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-6 bg-gray-200 rounded animate-pulse w-1/2" />
                  <div className="h-8 bg-gray-200 rounded animate-pulse w-1/3" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              No performance data available. Take some quizzes to see your analytics!
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Performance Analytics</h1>
        <p className="text-muted-foreground">
          Track your learning progress and identify areas for improvement.
        </p>
      </div>
        
      {/* Overview Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quizzes</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalQuizzes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedQuizzes} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageScore}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.averageScore >= 80 ? 'Excellent' : stats.averageScore >= 70 ? 'Good' : 'Needs improvement'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(stats.totalTimeSpent)}</div>
            <p className="text-xs text-muted-foreground">
              Total time spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.currentStreak}</div>
            <p className="text-xs text-muted-foreground">
              {stats.currentStreak === 1 ? 'day' : 'days'} in a row
            </p>
          </CardContent>
        </Card>
      </div>
      {/* Performance Breakdown */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recent Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.recentPerformance.map((performance, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{performance.quizCount} quiz{performance.quizCount !== 1 ? 'es' : ''}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(performance.date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={performance.score >= 80 ? 'default' : performance.score >= 70 ? 'secondary' : 'destructive'}>
                    {performance.score}%
                  </Badge>
                  {performance.score >= 80 ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>
              </div>
            ))}
            {stats.recentPerformance.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent quizzes completed
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.favoriteCategories.map((category, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{category.categoryName}</span>
                  <span className="text-muted-foreground">
                    {category.quizCount} quiz{category.quizCount !== 1 ? 'es' : ''} ({category.averageScore}% avg)
                  </span>
                </div>
                <Progress
                  value={category.averageScore}
                  className="h-2"
                />
              </div>
            ))}
            {stats.favoriteCategories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No category data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Study Goals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Study Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Weekly Quiz Goal</span>
                <span>0/5 quizzes</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Weekly Study Time Goal</span>
                <span>{formatTime(0)}/3h</span>
              </div>
              <Progress value={0} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    )
  }