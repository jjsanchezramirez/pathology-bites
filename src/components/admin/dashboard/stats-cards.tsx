// src/components/admin/dashboard/stats-cards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  FileQuestion,
  Users,
  Image as ImageIcon,
  MessageSquare,
  Clock,
  TrendingUp,
  AlertCircle
} from "lucide-react"
import { DashboardStats } from "@/lib/dashboard/service"

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Total Questions",
      value: stats.totalQuestions.toLocaleString(),
      description: `${stats.recentQuestions} added this month`,
      icon: FileQuestion,
      trend: stats.recentQuestions > 0 ? "positive" : "neutral"
    },
    {
      title: "Active Users",
      value: stats.activeUsers.toLocaleString(),
      description: `${stats.totalUsers} total registered`,
      icon: Users,
      trend: "neutral"
    },
    {
      title: "Image Library",
      value: stats.totalImages.toLocaleString(),
      description: "Pathology images available",
      icon: ImageIcon,
      trend: "neutral"
    },
    {
      title: "Pending Reviews",
      value: stats.pendingQuestions.toLocaleString(),
      description: "Questions awaiting review",
      icon: Clock,
      trend: stats.pendingQuestions > 0 ? "warning" : "positive"
    },
    {
      title: "User Inquiries",
      value: stats.totalInquiries.toLocaleString(),
      description: `${stats.unreadInquiries} need attention`,
      icon: MessageSquare,
      trend: stats.unreadInquiries > 5 ? "warning" : "neutral"
    }
  ]

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "positive":
        return "text-green-600"
      case "warning":
        return "text-yellow-600"
      case "negative":
        return "text-red-600"
      default:
        return "text-muted-foreground"
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "positive":
        return <TrendingUp className="h-3 w-3" />
      case "warning":
        return <AlertCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <div className={`text-xs flex items-center gap-1 ${getTrendColor(card.trend)}`}>
              {getTrendIcon(card.trend)}
              <span>{card.description}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
