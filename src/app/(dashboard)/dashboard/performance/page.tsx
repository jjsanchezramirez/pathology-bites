// src/app/(dashboard)/dashboard/performance/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/shared/utils/toast'
import { PerformanceAnalytics, FeaturePlaceholder } from '@/features/dashboard/components'
import { PerformanceLoading, CategoryPerformanceCard } from '@/features/performance/components'
import {
  PerformanceTimelineChart,
  CategoryRadarChart,
  ActivityHeatmap
} from '@/features/performance/components/interactive-chart-demos'
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

interface UnifiedPerformanceData {
  summary: {
    overallScore: number
    completedQuizzes: number
    totalAttempts: number
    correctAttempts: number
    userPercentile: number
    peerRank: number
    totalUsers: number
  }
  subjects: {
    needsImprovement: Array<{ name: string; score: number; attempts: number }>
    mastered: Array<{ name: string; score: number; attempts: number }>
  }
  timeline: Array<{ date: string; accuracy: number; quizzes: number }>
  categories: CategoryDetail[]
  heatmap: {
    data: Array<{ date: string; quizzes: number; questions: number }>
    stats: {
      avgQuestionsPerDay: number
      avgQuizzesPerDay: string
      longestStreak: number
      currentStreak: number
      totalQuestions: number
      totalQuizzes: number
      daysWithActivity: number
    }
  }
}

export default function PerformancePage() {
  const featuresEnabled = isQuizFeaturesEnabled()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [performanceData, setPerformanceData] = useState<UnifiedPerformanceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!featuresEnabled) return

    const fetchPerformanceData = async () => {
      try {
        // Fetch ALL performance data from single unified API endpoint
        const response = await fetch('/api/user/performance/all')

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Performance API error:', errorText)
          throw new Error(`Performance API failed: ${response.status}`)
        }

        const result = await response.json()

        if (!result.success) {
          throw new Error('Performance API returned unsuccessful response')
        }

        console.log('Unified performance data loaded:', result.data)

        // Store the full performance data
        setPerformanceData(result.data)

        // Transform unified API response to match component expectations
        setStats({
          performance: {
            userPercentile: result.data.summary.userPercentile,
            peerRank: result.data.summary.peerRank,
            totalUsers: result.data.summary.totalUsers,
            completedQuizzes: result.data.summary.completedQuizzes,
            subjectsForImprovement: result.data.subjects.needsImprovement,
            subjectsMastered: result.data.subjects.mastered,
            overallScore: result.data.summary.overallScore
          }
        })

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
    return <PerformanceLoading />
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

      {/* Interactive Charts - All data from single API call */}
      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceTimelineChart
          data={performanceData?.timeline || []}
          loading={loading}
        />
        <CategoryRadarChart
          data={performanceData?.categories.map(cat => ({
            category_name: cat.category_name,
            accuracy: cat.accuracy
          })) || []}
          loading={loading}
        />
      </div>

      <ActivityHeatmap
        data={performanceData?.heatmap.data || []}
        stats={performanceData?.heatmap.stats || null}
        loading={loading}
      />

      {/* Detailed Category Breakdown */}
      <CategoryPerformanceCard categoryDetails={performanceData?.categories || []} />
    </div>
  )
}