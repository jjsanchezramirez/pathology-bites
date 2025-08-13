// src/features/learning-modules/components/progress-tracker.tsx

'use client'

import React from 'react'
import { Clock, CheckCircle, PlayCircle, Trophy, Target, TrendingUp, Calendar, BookOpen } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { Badge } from '@/shared/components/ui/badge'
import { Separator } from '@/shared/components/ui/separator'

interface ProgressStats {
  totalModules: number
  completedModules: number
  inProgressModules: number
  totalTimeSpent: number // in minutes
  averageScore: number
  currentStreak: number
  totalPaths: number
  completedPaths: number
  recentActivity: {
    date: string
    type: 'module_completed' | 'path_started' | 'path_completed'
    title: string
    score?: number
  }[]
}

interface ProgressTrackerProps {
  stats: ProgressStats
  variant?: 'default' | 'compact' | 'detailed'
  showRecentActivity?: boolean
  className?: string
}

export function ProgressTracker({
  stats,
  variant = 'default',
  showRecentActivity = true,
  className = ''
}: ProgressTrackerProps) {
  const completionRate = stats.totalModules > 0 ? (stats.completedModules / stats.totalModules) * 100 : 0
  const pathCompletionRate = stats.totalPaths > 0 ? (stats.completedPaths / stats.totalPaths) * 100 : 0
  const totalHours = Math.round(stats.totalTimeSpent / 60 * 10) / 10

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays - 1} days ago`
    return date.toLocaleDateString()
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'module_completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'path_started':
        return <PlayCircle className="h-4 w-4 text-blue-600" />
      case 'path_completed':
        return <Trophy className="h-4 w-4 text-yellow-600" />
      default:
        return <Target className="h-4 w-4 text-gray-400" />
    }
  }

  const getActivityText = (activity: ProgressStats['recentActivity'][0]) => {
    switch (activity.type) {
      case 'module_completed':
        return `Completed module: ${activity.title}`
      case 'path_started':
        return `Started learning path: ${activity.title}`
      case 'path_completed':
        return `Completed learning path: ${activity.title}`
      default:
        return activity.title
    }
  }

  if (variant === 'compact') {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Progress</h3>
            <Badge variant="outline" className="bg-green-100 text-green-800">
              {Math.round(completionRate)}%
            </Badge>
          </div>
          
          <Progress value={completionRate} className="mb-3" />
          
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">{stats.completedModules}</div>
              <div className="text-xs text-gray-500">Completed</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{totalHours}h</div>
              <div className="text-xs text-gray-500">Study Time</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">{stats.currentStreak}</div>
              <div className="text-xs text-gray-500">Day Streak</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Modules Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.completedModules}
                  <span className="text-sm font-normal text-gray-500">
                    /{stats.totalModules}
                  </span>
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-2">
              <Progress value={completionRate} className="h-2" />
              <p className="text-xs text-gray-500 mt-1">{Math.round(completionRate)}% complete</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Study Time</p>
                <p className="text-2xl font-bold text-gray-900">{totalHours}h</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                {Math.round(stats.totalTimeSpent / (stats.completedModules || 1))} min avg per module
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.averageScore > 0 ? `${Math.round(stats.averageScore)}%` : 'N/A'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                {stats.averageScore >= 80 ? 'Excellent' : stats.averageScore >= 70 ? 'Good' : stats.averageScore > 0 ? 'Needs improvement' : 'No scores yet'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Streak</p>
                <p className="text-2xl font-bold text-gray-900">{stats.currentStreak}</p>
              </div>
              <Trophy className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="mt-2">
              <p className="text-xs text-gray-500">
                {stats.currentStreak > 0 ? 'days in a row' : 'Start your streak!'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Progress */}
      {variant === 'detailed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Module Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Module Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completed</span>
                  <span className="text-sm font-medium">{stats.completedModules} modules</span>
                </div>
                <Progress value={completionRate} className="h-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">In Progress</span>
                  <span className="text-sm font-medium">{stats.inProgressModules} modules</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Remaining</span>
                  <span className="text-sm font-medium">
                    {stats.totalModules - stats.completedModules - stats.inProgressModules} modules
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Learning Path Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Learning Paths
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completed Paths</span>
                  <span className="text-sm font-medium">{stats.completedPaths} paths</span>
                </div>
                <Progress value={pathCompletionRate} className="h-2" />
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Enrolled</span>
                  <span className="text-sm font-medium">{stats.totalPaths} paths</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Completion Rate</span>
                  <span className="text-sm font-medium">{Math.round(pathCompletionRate)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Activity */}
      {showRecentActivity && stats.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentActivity.slice(0, 5).map((activity, index) => (
                <div key={index}>
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {getActivityText(activity)}
                      </p>
                      <div className="flex items-center mt-1 space-x-2">
                        <p className="text-xs text-gray-500">
                          {formatDate(activity.date)}
                        </p>
                        {activity.score && (
                          <Badge variant="outline" className="text-xs">
                            {activity.score}% score
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {index < stats.recentActivity.length - 1 && index < 4 && (
                    <Separator className="mt-3" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
