// src/shared/components/layout/dashboard/recent-activity.tsx
import { memo, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import {
  FileQuestion,
  Users,
  MessageSquare,
  Image as ImageIcon,
  Clock
} from "lucide-react"
import { RecentActivity } from "@/features/dashboard/services/service"

interface RecentActivityProps {
  activities: RecentActivity[]
}

export const RecentActivityCard = memo(function RecentActivityCard({ activities }: RecentActivityProps) {
  const getActivityIcon = useMemo(() => (type: string) => {
    switch (type) {
      case 'question':
        return <FileQuestion className="h-4 w-4 text-blue-500" />
      case 'user':
        return <Users className="h-4 w-4 text-green-500" />
      case 'inquiry':
        return <MessageSquare className="h-4 w-4 text-orange-500" />
      case 'image':
        return <ImageIcon className="h-4 w-4 text-purple-500" />
      default:
        return <Clock className="h-4 w-4 text-gray-500" />
    }
  }, [])

  const getActivityBadge = useMemo(() => (type: string) => {
    switch (type) {
      case 'question':
        return <Badge variant="secondary" className="text-xs">Question</Badge>
      case 'user':
        return <Badge variant="outline" className="text-xs">User</Badge>
      case 'inquiry':
        return <Badge variant="default" className="text-xs">Inquiry</Badge>
      case 'image':
        return <Badge variant="secondary" className="text-xs">Image</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Activity</Badge>
    }
  }, [])

  const formatTimestamp = (timestamp: string) => {
    // Handle null, undefined, or empty timestamps
    if (!timestamp || timestamp === 'null' || timestamp === 'undefined') {
      return 'Unknown time'
    }

    // Try to parse the timestamp
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      console.warn('Invalid timestamp received:', timestamp)
      return 'Invalid date'
    }

    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) {
      return 'Just now'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      const diffInHours = Math.floor(diffInMinutes / 60)
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInMinutes / 1440)
      return `${diffInDays}d ago`
    }
  }

  return (
    <Card className="col-span-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <div className="shrink-0 mt-1">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    {getActivityBadge(activity.type)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {activity.description}
                  </p>
                  {activity.user && (
                    <p className="text-xs text-muted-foreground mt-1">
                      by {activity.user}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {formatTimestamp(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
