// src/features/performance/components/interactive-chart-demos.tsx
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'

import { Skeleton } from '@/shared/components/ui/skeleton'
import { TrendingUp, Calendar, Target } from 'lucide-react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'

interface TimelineData {
  date: string
  accuracy: number
  quizzes: number
}

interface HeatmapData {
  date: string
  quizzes: number
  questions: number
}

interface HeatmapStats {
  avgQuestionsPerDay: number
  avgQuizzesPerDay: string
  longestStreak: number
  currentStreak: number
  totalQuestions: number
  totalQuizzes: number
  daysWithActivity: number
}

interface CategoryData {
  category_name: string
  accuracy: number
}

/**
 * Chart 1: Performance Timeline
 */
interface PerformanceTimelineChartProps {
  data?: TimelineData[]
  loading?: boolean
}

export function PerformanceTimelineChart({
  data = [],
  loading = false
}: PerformanceTimelineChartProps) {
  const [error] = useState<string | null>(null)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Timeline
          </CardTitle>
          <CardDescription>Your accuracy over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Timeline
          </CardTitle>
          <CardDescription>Your accuracy over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-destructive">
            Error loading timeline data: {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Timeline
          </CardTitle>
          <CardDescription>Your accuracy over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No quiz data available yet. Start taking quizzes to see your progress!
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Timeline
        </CardTitle>
        <CardDescription>Your accuracy over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorAccuracy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#3b82f6" opacity={0.1} />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--foreground))' } }}
              domain={[0, 100]}
              tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">
                        {new Date(payload[0].payload.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm" style={{ color: '#3b82f6' }}>
                        Accuracy: {payload[0].value?.toFixed(1)}%
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payload[0].payload.quizzes} quiz{payload[0].payload.quizzes !== 1 ? 'zes' : ''}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="accuracy"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorAccuracy)"
              dot={{ fill: '#3b82f6', r: 4 }}
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/**
 * Chart 2: Category Radar Chart
 */
interface CategoryRadarChartProps {
  data?: CategoryData[]
  loading?: boolean
}

export function CategoryRadarChart({
  data = [],
  loading = false
}: CategoryRadarChartProps) {
  const [error] = useState<string | null>(null)

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Category Comparison
          </CardTitle>
          <CardDescription>Your performance across all categories</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Category Comparison
          </CardTitle>
          <CardDescription>Your performance across all categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-destructive">
            Error loading category data: {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Category Comparison
          </CardTitle>
          <CardDescription>Your performance across all categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No category data available yet. Start taking quizzes to see your performance!
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Category Comparison
        </CardTitle>
        <CardDescription>Your performance across all categories</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <RadarChart data={data}>
            <PolarGrid stroke="#3b82f6" opacity={0.2} />
            <PolarAngleAxis
              dataKey="category_name"
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'hsl(var(--foreground))' }}
            />
            <Radar
              name="Accuracy"
              dataKey="accuracy"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-popover border rounded-lg p-3 shadow-lg">
                      <p className="font-semibold">{payload[0].payload.category_name}</p>
                      <p className="text-sm" style={{ color: '#3b82f6' }}>
                        Accuracy: {payload[0].value?.toFixed(1)}%
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

/**
 * Chart 3: Activity Heatmap - Anki-style with months
 */
interface ActivityHeatmapProps {
  data?: HeatmapData[]
  stats?: HeatmapStats | null
  loading?: boolean
}

export function ActivityHeatmap({
  data = [],
  stats = null,
  loading = false
}: ActivityHeatmapProps) {
  const [error] = useState<string | null>(null)

  const getColor = (questions: number) => {
    if (questions === 0) return 'bg-muted/50 dark:bg-muted/30'
    if (questions <= 5) return 'bg-green-300 dark:bg-green-700'
    if (questions <= 10) return 'bg-green-400 dark:bg-green-600'
    if (questions <= 20) return 'bg-green-500 dark:bg-green-500'
    if (questions <= 30) return 'bg-green-600 dark:bg-green-400'
    return 'bg-green-700 dark:bg-green-300'
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Calendar
          </CardTitle>
          <CardDescription>Your quiz activity over the past year</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Calendar
          </CardTitle>
          <CardDescription>Your quiz activity over the past year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-destructive">
            Error loading activity data: {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Activity Calendar
          </CardTitle>
          <CardDescription>Your quiz activity over the past year</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            No activity data available yet.
          </div>
        </CardContent>
      </Card>
    )
  }

  // Create a map for quick lookup
  const dataMap = new Map(data.map(d => [d.date, d]))

  // Start from one year ago
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const oneYearAgo = new Date(today)
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)

  // Find the first Sunday on or before one year ago
  const startDate = new Date(oneYearAgo)
  const dayOfWeek = startDate.getDay() // 0 = Sunday, 1 = Monday, etc.
  startDate.setDate(startDate.getDate() - dayOfWeek) // Go back to Sunday

  // Build all days from start to today
  const allDays: HeatmapData[] = []
  const currentDate = new Date(startDate)

  while (currentDate <= today) {
    const dateStr = currentDate.toISOString().split('T')[0]
    const dayData = dataMap.get(dateStr) || { date: dateStr, quizzes: 0, questions: 0 }
    allDays.push(dayData)
    currentDate.setDate(currentDate.getDate() + 1)
  }

  // Group into weeks (Sunday to Saturday)
  const weeks: HeatmapData[][] = []
  for (let i = 0; i < allDays.length; i += 7) {
    const week = allDays.slice(i, i + 7)
    if (week.length === 7) {
      weeks.push(week)
    }
  }

  // Calculate month labels based on weeks
  const monthLabels: Array<{ month: string; weekIndex: number }> = []
  let lastMonth = ''

  weeks.forEach((week, weekIndex) => {
    // Use the Sunday (first day) of the week to determine the month
    const weekStartDate = new Date(week[0].date)
    const monthName = weekStartDate.toLocaleDateString('en-US', { month: 'short' })

    if (monthName !== lastMonth) {
      monthLabels.push({ month: monthName, weekIndex })
      lastMonth = monthName
    }
  })

  console.log('[ActivityHeatmap] Rendering:', {
    totalWeeks: weeks.length,
    totalDays: allDays.length,
    daysWithActivity: allDays.filter(d => d.questions > 0).length,
    monthLabels: monthLabels.map(m => `${m.month} (week ${m.weekIndex})`),
    activeDates: allDays.filter(d => d.questions > 0).map(d => ({ date: d.date, questions: d.questions, color: getColor(d.questions) }))
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Activity Calendar
        </CardTitle>
        <CardDescription>Your quiz activity over the past year</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Statistics */}
          {stats && (
            <div className="flex items-center justify-center gap-6 text-sm border-b pb-4">
              <div className="text-center">
                <div className="font-semibold text-green-600 dark:text-green-400">
                  {stats.avgQuestionsPerDay} questions
                </div>
                <div className="text-xs text-muted-foreground">Daily average</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-600 dark:text-blue-400">
                  {stats.avgQuizzesPerDay} quizzes
                </div>
                <div className="text-xs text-muted-foreground">Daily average</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-orange-600 dark:text-orange-400">
                  {stats.longestStreak} days
                </div>
                <div className="text-xs text-muted-foreground">Longest streak</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-purple-600 dark:text-purple-400">
                  {stats.currentStreak} days
                </div>
                <div className="text-xs text-muted-foreground">Current streak</div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto pb-2">
            <div className="inline-block">
              {/* Month labels */}
              <div className="flex mb-2 pl-8">
                {monthLabels.map((label, index) => {
                  const nextLabelIndex = monthLabels[index + 1]?.weekIndex || weeks.length
                  const widthInWeeks = nextLabelIndex - label.weekIndex
                  const widthPx = widthInWeeks * 12 // 10px width + 2px gap

                  return (
                    <div
                      key={index}
                      className="text-xs text-muted-foreground font-medium"
                      style={{ width: `${widthPx}px`, minWidth: `${widthPx}px` }}
                    >
                      {label.month}
                    </div>
                  )
                })}
              </div>

              {/* Heatmap grid */}
              <div className="flex">
                {/* Day labels */}
                <div className="flex flex-col gap-[2px] mr-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                    <div key={index} className="h-[10px] flex items-center">
                      <span className="text-[10px] text-muted-foreground w-6 text-right">
                        {index % 2 === 1 ? day : ''}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Weeks */}
                <div className="flex gap-[2px]">
                  {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[2px]">
                      {week.map((day, dayIndex) => {
                        const hasActivity = day.questions > 0
                        return (
                          <div
                            key={dayIndex}
                            className={`w-[10px] h-[10px] rounded-sm ${getColor(day.questions)} ${hasActivity ? 'cursor-pointer hover:ring-2 hover:ring-primary' : 'cursor-default'} transition-all`}
                            title={`${new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}\n${day.questions} question${day.questions !== 1 ? 's' : ''}\n${day.quizzes} quiz${day.quizzes !== 1 ? 'zes' : ''}`}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-end gap-2 text-xs mt-4">
                <span className="text-muted-foreground">Less</span>
                <div className="flex gap-1">
                  {[0, 5, 10, 20, 30, 40].map((level) => (
                    <div
                      key={level}
                      className={`w-[10px] h-[10px] rounded-sm ${getColor(level)}`}
                      title={`${level}+ questions`}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground">More</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
