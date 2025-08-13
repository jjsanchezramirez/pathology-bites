// src/features/dashboard/components/performance-analytics.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { TrendingUp, TrendingDown, Target, Users } from 'lucide-react'

interface PerformanceData {
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

interface PerformanceAnalyticsProps {
  data: PerformanceData
}

// Circle progress component
function CircleProgress({ 
  percentage, 
  size = 120, 
  strokeWidth = 8, 
  color = '#3b82f6',
  backgroundColor = '#e5e7eb'
}: {
  percentage: number
  size?: number
  strokeWidth?: number
  color?: string
  backgroundColor?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const strokeDasharray = circumference
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  )
}

export function PerformanceAnalytics({ data }: PerformanceAnalyticsProps) {
  const getPercentileColor = (percentile: number) => {
    if (percentile >= 90) return '#10b981' // green
    if (percentile >= 75) return '#3b82f6' // blue
    if (percentile >= 50) return '#f59e0b' // yellow
    return '#ef4444' // red
  }

  const getRankSuffix = (rank: number) => {
    if (rank % 100 >= 11 && rank % 100 <= 13) return 'th'
    switch (rank % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  // Only show percentile and ranking if there are at least 30 users
  const showRankingData = data.totalUsers >= 30

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* User Percentile - Only show if enough users */}
      {showRankingData ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Your Percentile
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-2">
            <CircleProgress
              percentage={data.userPercentile}
              color={getPercentileColor(data.userPercentile)}
            />
            <p className="text-xs text-muted-foreground text-center">
              You scored better than {data.userPercentile}% of users
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Your Percentile
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-2 py-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground mb-2">
                Coming Soon
              </div>
              <p className="text-xs text-muted-foreground">
                Percentile ranking available when we have 30+ active users
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Current users: {data.totalUsers}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peer Rank - Only show if enough users */}
      {showRankingData ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-500" />
              Peer Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-2 py-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">
                {data.peerRank}{getRankSuffix(data.peerRank)}
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                out of {data.totalUsers.toLocaleString()} users
              </div>
              <p className="text-xs text-muted-foreground">
                Based on overall performance
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Peer Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-2 py-8">
            <div className="text-center">
              <div className="text-2xl font-bold text-muted-foreground mb-2">
                Coming Soon
              </div>
              <p className="text-xs text-muted-foreground">
                Peer ranking available when we have 30+ active users
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Current users: {data.totalUsers}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Score */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Overall Score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-2">
          <CircleProgress 
            percentage={data.overallScore} 
            color="#10b981"
          />
          <p className="text-xs text-muted-foreground text-center">
            Average across all attempts
          </p>
        </CardContent>
      </Card>

      {/* Subjects for Improvement */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            Needs Improvement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.subjectsForImprovement.length > 0 ? (
              data.subjectsForImprovement.slice(0, 3).map((subject, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{subject.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {subject.attempts} attempts
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {subject.score}%
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Great job! No subjects need improvement.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Mastered Subjects */}
      <Card className="md:col-span-2 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-green-500" />
            Mastered Subjects
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.subjectsMastered.length > 0 ? (
              data.subjectsMastered.slice(0, 6).map((subject, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{subject.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {subject.attempts} attempts
                    </p>
                  </div>
                  <Badge variant="default" className="text-xs bg-green-100 text-green-800">
                    {subject.score}%
                  </Badge>
                </div>
              ))
            ) : (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keep practicing to master subjects!
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
