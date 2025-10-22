// src/app/(dashboard)/dashboard/performance/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'
import { PerformanceAnalytics, FeaturePlaceholder } from '@/features/dashboard/components'
import { isQuizFeaturesEnabled } from '@/shared/config/feature-flags'

interface DashboardStats {
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

interface CategoryDetail {
  category_id: string
  category_name: string
  total_attempts: number
  correct_attempts: number
  accuracy: number
  average_time: number
  last_attempt_at: string
  recent_performance: Array<{
    date: string
    accuracy: number
    questions_answered: number
  }>
  trend?: 'up' | 'down' | 'stable'
}

export default function PerformancePage() {
  const featuresEnabled = isQuizFeaturesEnabled()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!featuresEnabled) return

    const fetchPerformanceData = async () => {
      try {
        // Fetch dashboard stats and category details in parallel
        const [statsResponse, categoryResponse] = await Promise.all([
          fetch('/api/user/dashboard/stats'),
          fetch('/api/user/performance/category-details')
        ])

        if (!statsResponse.ok || !categoryResponse.ok) {
          throw new Error('Failed to fetch performance data')
        }

        const [statsResult, categoryResult] = await Promise.all([
          statsResponse.json(),
          categoryResponse.json()
        ])

        setStats(statsResult.data)

        // Process category details and calculate trends
        const categoryData: CategoryDetail[] = categoryResult.data.map((cat: CategoryDetail) => {
          // Calculate trend based on recent performance
          let trend: 'up' | 'down' | 'stable' = 'stable'

          if (cat.recent_performance && cat.recent_performance.length >= 2) {
            const recentAccuracies = cat.recent_performance.slice(0, 3).map(p => p.accuracy)
            const avgRecent = recentAccuracies.reduce((sum, acc) => sum + acc, 0) / recentAccuracies.length

            if (avgRecent > cat.accuracy + 5) {
              trend = 'up'
            } else if (avgRecent < cat.accuracy - 5) {
              trend = 'down'
            }
          }

          return {
            ...cat,
            trend
          }
        })

        setCategoryDetails(categoryData)
      } catch (error) {
        console.error('Error fetching performance data:', error)
        toast.error('Failed to load performance data')
      } finally {
        setLoading(false)
      }
    }

    fetchPerformanceData()
  }, [featuresEnabled])

  // Show placeholder if features are disabled
  if (!featuresEnabled) {
    return (
      <FeaturePlaceholder
        title="Performance Analytics"
        description="We're preparing comprehensive performance analytics to help you track your mastery of pathology topics. Soon you'll be able to see detailed insights into your quiz performance, identify knowledge gaps, and measure your progress across different subjects."
        status="launching-soon"
      />
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
          <p className="text-muted-foreground">
            Detailed insights into your learning progress and areas for improvement.
          </p>
        </div>

        {/* Performance Overview Skeleton */}
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

        {/* Performance Charts Skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
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
                {Array.from({ length: 5 }).map((_, i) => (
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
    )
  }

  if (!stats?.performance) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
          <p className="text-muted-foreground">
            No performance data available yet. Start taking quizzes to see your analytics!
          </p>
        </div>
      </div>
    )
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Target className="h-4 w-4 text-gray-500" />
    }
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 80) return 'text-green-600'
    if (accuracy >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getAccuracyBadgeVariant = (accuracy: number) => {
    if (accuracy >= 80) return 'default'
    if (accuracy >= 70) return 'secondary'
    return 'destructive'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground">
          Detailed insights into your learning progress and areas for improvement.
        </p>
      </div>

      {/* Performance Overview Cards */}
      <PerformanceAnalytics data={stats.performance} />

      {/* Detailed Category Breakdown */}
      {categoryDetails.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Detailed Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {categoryDetails.map((category, index) => (
                <div key={category.category_id || index} className="space-y-3 pb-6 border-b last:border-b-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{category.category_name}</h3>
                      {category.trend && getTrendIcon(category.trend)}
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getAccuracyBadgeVariant(category.accuracy)}>
                        {category.accuracy}% accuracy
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {category.total_attempts} attempts
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {category.average_time}s avg
                      </span>
                    </div>
                  </div>

                  <Progress value={category.accuracy} className="h-3" />

                  {/* Recent Performance for this category */}
                  {category.recent_performance && category.recent_performance.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium mb-2">Recent Performance (Last 7 Days)</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {category.recent_performance.slice(0, 3).map((perf, perfIndex) => (
                          <div key={perfIndex} className="text-center p-2 bg-muted/50 rounded">
                            <div className="text-xs text-muted-foreground">
                              {new Date(perf.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            <div className={`text-sm font-medium ${getAccuracyColor(perf.accuracy)}`}>
                              {perf.accuracy}%
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {perf.questions_answered} questions
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Detailed Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <p>No category performance data available yet.</p>
              <p className="text-sm mt-2">Start taking quizzes to see your performance by category!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}