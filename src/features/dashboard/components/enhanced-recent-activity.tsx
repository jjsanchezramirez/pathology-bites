// src/features/dashboard/components/enhanced-recent-activity.tsx
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { 
  Clock, 
  ChevronRight, 
  Filter,
  Award,
  Play,
  Target,
  TrendingUp,
  Trophy,
  Flame,
  BookOpen,
  Zap
} from "lucide-react"
import { toast } from "sonner"

interface Activity {
  id: string
  type: string
  title: string
  description: string
  created_at: string
  quiz_id?: string
  goal_id?: string
  subject_id?: string
  data: Record<string, any>
  is_read: boolean
  priority: 'low' | 'medium' | 'high'
}

interface ActivityGroup {
  key: string
  title: string
  activities: Activity[]
  count: number
}

interface EnhancedRecentActivityProps {
  userId: string
}

export function EnhancedRecentActivity({ userId }: EnhancedRecentActivityProps) {
  const router = useRouter()
  const [groups, setGroups] = useState<ActivityGroup[]>([])
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({ total: 0, unread: 0, byType: {} })

  useEffect(() => {
    fetchActivities()
  }, [])

  const fetchActivities = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: '30'
      })

      const response = await fetch(`/api/user/dashboard/activities?${params}`)
      const result = await response.json()

      if (result.success) {
        setGroups(result.data.groups)
        setStats(result.data.stats)
      } else {
        console.error('API returned error:', result.error)
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleActivityClick = async (activity: Activity) => {
    // Mark as read if unread
    if (!activity.is_read) {
      await markAsRead([activity.id])
    }

    // Navigate based on activity type
    switch (activity.type) {
      case 'quiz_completed':
        router.push(`/dashboard/quiz/${activity.quiz_id}/results`)
        break
      case 'quiz_started':
        router.push(`/dashboard/quiz/${activity.quiz_id}`)
        break
      case 'goal_achieved':
        toast.success('🎉 Congratulations on achieving your goal!')
        router.push('/dashboard/goals')
        break
      case 'subject_mastered':
        toast.success('🏆 Amazing work mastering this subject!')
        if (activity.subject_id) {
          router.push(`/dashboard/subjects/${activity.subject_id}`)
        }
        break
      case 'study_streak':
        toast.success('Keep that streak alive! 🔥')
        break
      case 'performance_milestone':
        toast.success('📈 Great milestone achievement!')
        router.push('/dashboard/performance')
        break
      case 'badge_earned':
        toast.success(`🏅 Badge earned: ${activity.data.badgeName}!`)
        router.push('/dashboard/achievements')
        break
      case 'weak_area_improved':
        toast.success('💪 Keep up the great improvement!')
        if (activity.subject_id) {
          router.push(`/dashboard/subjects/${activity.subject_id}`)
        }
        break
      default:
        break
    }
  }

  const markAsRead = async (activityIds: string[]) => {
    try {
      await fetch('/api/dashboard/activities/mark-read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityIds })
      })
      
      // Update local state
      setGroups(groups => 
        groups.map(group => ({
          ...group,
          activities: group.activities.map(activity => 
            activityIds.includes(activity.id) ? { ...activity, is_read: true } : activity
          )
        }))
      )
    } catch (error) {
      console.error('Failed to mark activities as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/dashboard/activities/mark-read', {
        method: 'PATCH'
      })
      
      // Update local state
      setGroups(groups => 
        groups.map(group => ({
          ...group,
          activities: group.activities.map(activity => ({ ...activity, is_read: true }))
        }))
      )
      
      setStats(prev => ({ ...prev, unread: 0 }))
    } catch (error) {
      console.error('Failed to mark all activities as read:', error)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'quiz_completed': return <Award className="h-4 w-4 text-green-500" />
      case 'quiz_started': return <Play className="h-4 w-4 text-orange-500" />
      case 'goal_achieved': return <Target className="h-4 w-4 text-blue-500" />
      case 'subject_mastered': return <Trophy className="h-4 w-4 text-yellow-500" />
      case 'study_streak': return <Flame className="h-4 w-4 text-red-500" />
      case 'performance_milestone': return <TrendingUp className="h-4 w-4 text-purple-500" />
      case 'badge_earned': return <Award className="h-4 w-4 text-indigo-500" />
      case 'weak_area_improved': return <Zap className="h-4 w-4 text-emerald-500" />
      default: return <BookOpen className="h-4 w-4 text-gray-500" />
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const now = new Date()
    const activityTime = new Date(timestamp)
    const diffHours = (now.getTime() - activityTime.getTime()) / (1000 * 60 * 60)

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffHours * 60)
      return `${diffMinutes}m ago`
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`
    } else {
      return activityTime.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <Card className="md:col-span-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse bg-accent rounded-lg p-4 h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="md:col-span-4">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Recent Activity</CardTitle>
            {stats.unread > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {stats.unread} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">

            {stats.unread > 0 && (
              <Button size="sm" variant="outline" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity</p>
            <p className="text-sm">Complete a quiz to see your progress!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-foreground">{group.title}</h4>
                  <Badge variant="outline" className="text-xs">
                    {group.count}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {group.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className={`flex items-start gap-4 rounded-lg border p-4 cursor-pointer transition-all group hover:bg-accent/70 ${
                        !activity.is_read ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800' : ''
                      }`}
                      onClick={() => handleActivityClick(activity)}
                    >
                      <div className="shrink-0 mt-0.5">
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className={`font-medium text-sm ${!activity.is_read ? 'text-blue-900 dark:text-blue-100' : ''}`}>
                          {activity.title}
                        </h5>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {activity.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(activity.created_at)}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
