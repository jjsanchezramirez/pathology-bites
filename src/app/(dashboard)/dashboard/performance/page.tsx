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
import { PerformanceAnalytics } from '@/features/dashboard/components'

interface DashboardStats {
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

interface CategoryDetail {
  name: string
  accuracy: number
  totalQuestions: number
  averageTime: number
  trend: 'up' | 'down' | 'stable'
  recentPerformance: Array<{
    date: string
    accuracy: number
    questionsAnswered: number
  }>
}

export default function PerformancePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [categoryDetails, setCategoryDetails] = useState<CategoryDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        // Fetch dashboard stats (same as dashboard page)
        const response = await fetch('/api/user/dashboard/stats')
        if (!response.ok) {
          throw new Error('Failed to fetch performance data')
        }
        const result = await response.json()
        setStats(result.data)

        // Mock detailed category data for now
        const mockCategoryDetails: CategoryDetail[] = [
          {
            name: 'Cardiovascular Pathology',
            accuracy: 85,
            totalQuestions: 42,
            averageTime: 38,
            trend: 'up',
            recentPerformance: [
              { date: '2024-01-15', accuracy: 87, questionsAnswered: 8 },
              { date: '2024-01-14', accuracy: 83, questionsAnswered: 6 },
              { date: '2024-01-13', accuracy: 85, questionsAnswered: 4 },
            ]
          },
          {
            name: 'Respiratory Pathology',
            accuracy: 82,
            totalQuestions: 38,
            averageTime: 41,
            trend: 'stable',
            recentPerformance: [
              { date: '2024-01-15', accuracy: 80, questionsAnswered: 5 },
              { date: '2024-01-14', accuracy: 84, questionsAnswered: 7 },
              { date: '2024-01-13', accuracy: 82, questionsAnswered: 3 },
            ]
          },
          {
            name: 'Gastrointestinal Pathology',
            accuracy: 76,
            totalQuestions: 35,
            averageTime: 47,
            trend: 'up',
            recentPerformance: [
              { date: '2024-01-15', accuracy: 78, questionsAnswered: 4 },
              { date: '2024-01-14', accuracy: 74, questionsAnswered: 6 },
              { date: '2024-01-13', accuracy: 76, questionsAnswered: 5 },
            ]
          },
          {
            name: 'Genitourinary Pathology',
            accuracy: 74,
            totalQuestions: 28,
            averageTime: 52,
            trend: 'down',
            recentPerformance: [
              { date: '2024-01-15', accuracy: 72, questionsAnswered: 3 },
              { date: '2024-01-14', accuracy: 76, questionsAnswered: 4 },
              { date: '2024-01-13', accuracy: 74, questionsAnswered: 2 },
            ]
          },
          {
            name: 'Neuropathology',
            accuracy: 68,
            totalQuestions: 22,
            averageTime: 58,
            trend: 'down',
            recentPerformance: [
              { date: '2024-01-15', accuracy: 65, questionsAnswered: 2 },
              { date: '2024-01-14', accuracy: 70, questionsAnswered: 3 },
              { date: '2024-01-13', accuracy: 68, questionsAnswered: 1 },
            ]
          }
        ]

        setCategoryDetails(mockCategoryDetails)
      } catch (error) {
        console.error('Error fetching performance data:', error)
        toast.error('Failed to load performance data')
      } finally {
        setLoading(false)
      }
    }

    fetchPerformanceData()
  }, [])

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
              <div key={index} className="space-y-3 pb-6 border-b last:border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{category.name}</h3>
                    {getTrendIcon(category.trend)}
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getAccuracyBadgeVariant(category.accuracy)}>
                      {category.accuracy}% accuracy
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {category.totalQuestions} questions
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {category.averageTime}s avg
                    </span>
                  </div>
                </div>

                <Progress value={category.accuracy} className="h-3" />

                {/* Recent Performance for this category */}
                <div className="mt-3">
                  <h4 className="text-sm font-medium mb-2">Recent Performance</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {category.recentPerformance.map((perf, perfIndex) => (
                      <div key={perfIndex} className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-xs text-muted-foreground">{perf.date}</div>
                        <div className={`text-sm font-medium ${getAccuracyColor(perf.accuracy)}`}>
                          {perf.accuracy}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {perf.questionsAnswered} questions
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}