// src/features/dashboard/components/simple-goals-widget.tsx
"use client"

import { useState, useEffect, memo } from 'react'
import { useCachedData } from '@/shared/hooks/use-cached-data'
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { 
  Target, 
  Plus, 
  Clock,
  CheckCircle,
  BookOpen,
  Timer,
  Award,
  TrendingUp,
  Flame
} from "lucide-react"
import { toast } from "sonner"

interface Goal {
  id: string
  type: 'daily' | 'weekly'
  category: string
  title: string
  description?: string
  target_value: number
  current_value: number
  unit: string
  progress: number
  hoursRemaining: number
  isExpired: boolean
  canComplete: boolean
  is_completed: boolean
  created_at: string
}

const ActiveGoalCard = memo(function ActiveGoalCard({ goal }: { goal: Goal }) {
  const progressPercentage = Math.min((goal.current_value / goal.target_value) * 100, 100)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-blue-500" />
            <h4 className="font-medium text-sm">{goal.title}</h4>
            <Badge variant="outline" className="text-xs">
              {goal.type}
            </Badge>
          </div>
          {goal.description && (
            <p className="text-xs text-muted-foreground mb-2">{goal.description}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">
            {goal.current_value} / {goal.target_value} {goal.unit}
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2" />
        <div className="text-xs text-muted-foreground">
          {progressPercentage.toFixed(0)}% complete
        </div>
      </div>
    </div>
  )
})

const ExpiredGoalCard = memo(function ExpiredGoalCard({ goal }: { goal: Goal }) {
  return (
    <div className="border rounded-lg p-3 opacity-60 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          <span className="font-medium text-sm">{goal.title}</span>
          <Badge variant="outline" className="text-xs">
            {goal.type}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          {goal.current_value} / {goal.target_value} {goal.unit}
        </span>
      </div>
    </div>
  )
})

const CompletedGoalCard = memo(function CompletedGoalCard({ goal }: { goal: Goal }) {
  return (
    <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="font-medium text-sm">{goal.title}</span>
          <Badge variant="outline" className="text-xs">
            {goal.type}
          </Badge>
        </div>
        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
          Completed!
        </span>
      </div>
    </div>
  )
})

interface SimpleGoalsWidgetProps {
  userId: string
}

export function SimpleGoalsWidget({ userId }: SimpleGoalsWidgetProps) {
  const [showCompleted, setShowCompleted] = useState(false)

  // Use cached data for goals to reduce API calls
  const { data: goalsData, isLoading: loading } = useCachedData(
    'dashboard-goals',
    async () => {
      const response = await fetch('/api/user/dashboard/goals?active=true')
      const result = await response.json()

      if (result.success) {
        return result.data.goals
      } else {
        throw new Error(result.error || 'Failed to fetch goals')
      }
    },
    {
      ttl: 3 * 60 * 1000, // 3 minutes cache
      staleTime: 1 * 60 * 1000, // 1 minute stale time
      storage: 'memory',
      prefix: 'pathology-bites-goals'
    }
  )

  const goals = goalsData || []

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'questions': return <BookOpen className="h-4 w-4" />
      case 'study_time': return <Timer className="h-4 w-4" />
      case 'quizzes': return <Award className="h-4 w-4" />
      case 'accuracy': return <TrendingUp className="h-4 w-4" />
      case 'streak': return <Flame className="h-4 w-4" />
      default: return <Target className="h-4 w-4" />
    }
  }

  const getProgressColor = (progress: number, isCompleted: boolean) => {
    if (isCompleted) return 'bg-green-500'
    if (progress >= 80) return 'bg-blue-500'
    if (progress >= 50) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const formatTimeRemaining = (hours: number) => {
    if (hours <= 0) return 'Expired'
    if (hours < 24) return `${hours}h left`
    const days = Math.floor(hours / 24)
    return `${days}d left`
  }

  const formatValue = (value: number, unit: string) => {
    switch (unit) {
      case 'questions': return `${value} questions`
      case 'minutes': return `${value} min`
      case 'quizzes': return `${value} quizzes`
      case 'percent': return `${value}%`
      case 'days': return `${value} days`
      default: return `${value} ${unit}`
    }
  }

  const activeGoals = goals.filter((g: any) => !g.is_completed && !g.isExpired)
  const completedGoals = goals.filter((g: any) => g.is_completed)
  const expiredGoals = goals.filter((g: any) => g.isExpired && !g.is_completed)

  if (loading) {
    return (
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="animate-pulse bg-accent rounded-lg p-4 h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <CardTitle>Goals</CardTitle>
            {completedGoals.length > 0 && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                {completedGoals.length} completed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {completedGoals.length > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? 'Hide' : 'Show'} Completed
              </Button>
            )}
            <Button size="sm" onClick={() => toast.info('Goal creation coming soon!')}>
              <Plus className="h-4 w-4 mr-1" />
              Add Goal
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeGoals.length === 0 && completedGoals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No goals set</p>
            <p className="text-sm">Set daily or weekly goals to track your progress!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Goals */}
            {activeGoals.map((goal: any) => (
              <ActiveGoalCard key={goal.id} goal={goal} />
            ))}

            {/* Expired Goals */}
            {expiredGoals.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-muted-foreground">Expired</h5>
                {expiredGoals.map((goal: any) => (
                  <ExpiredGoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            )}

            {/* Completed Goals */}
            {showCompleted && completedGoals.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-muted-foreground">Completed</h5>
                {completedGoals.map((goal: any) => (
                  <CompletedGoalCard key={goal.id} goal={goal} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
