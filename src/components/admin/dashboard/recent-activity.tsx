// src/components/admin/dashboard/recent-activity.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  FileQuestion, 
  Users, 
  MessageSquare,
  Image as ImageIcon,
  Clock
} from "lucide-react"
import { RecentActivity } from "@/lib/dashboard/service"

interface RecentActivityProps {
  activities: RecentActivity[]
}

export function RecentActivityCard({ activities }: RecentActivityProps) {
  const getActivityIcon = (type: string) => {
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
  }

  const getActivityBadge = (type: string) => {
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
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      return `${diffInMinutes}m ago`
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
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
                <div className="flex-shrink-0 mt-1">
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
                <div className="flex-shrink-0 text-xs text-muted-foreground">
                  {formatTimestamp(activity.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
