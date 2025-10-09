'use client'

// src/components/admin/dashboard/stats-cards.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import {
  FileQuestion,
  Users,
  Image as ImageIcon,
  MessageSquare,
  Clock,
  TrendingUp,
  AlertCircle
} from "lucide-react"
import { DashboardStats } from "@/features/dashboard/services/service"
import { useUserRole } from "@/shared/hooks/use-user-role"

interface StatsCardsProps {
  stats: DashboardStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { isAdmin, isCreator, isReviewer, canAccess } = useUserRole()

  const allCards = [
    // Row 1: Platform overview
    {
      title: "Active Users",
      value: stats.activeUsers.toLocaleString(),
      description: `${stats.totalUsers} total registered`,
      icon: Users,
      trend: "neutral",
      permission: "users.view",
      adminOnly: true
    },
    {
      title: "User Inquiries",
      value: stats.totalInquiries.toLocaleString(),
      description: `${stats.unreadInquiries} need attention`,
      icon: MessageSquare,
      trend: stats.unreadInquiries > 5 ? "warning" : "neutral",
      permission: "inquiries.manage",
      adminOnly: true
    },
    {
      title: "Published Questions",
      value: (stats.totalQuestions - stats.draftQuestions - stats.pendingQuestions - stats.rejectedQuestions).toLocaleString(),
      description: "Live and available",
      icon: FileQuestion,
      trend: "positive",
      permission: "questions.view"
    },
    {
      title: "Image Library",
      value: stats.totalImages.toLocaleString(),
      description: "Pathology images available",
      icon: ImageIcon,
      trend: "neutral",
      permission: "images.manage",
      adminOnly: true
    },

    // Row 2: Question workflow and issues (red cards for problems)
    {
      title: "Draft Questions",
      value: stats.draftQuestions.toLocaleString(),
      description: "Work in progress",
      icon: FileQuestion,
      trend: "neutral",
      permission: "questions.create",
      showToRoles: ['admin', 'creator']
    },
    {
      title: "Pending Reviews",
      value: stats.pendingQuestions.toLocaleString(),
      description: "Questions awaiting review",
      icon: Clock,
      trend: stats.pendingQuestions > 0 ? "warning" : "positive",
      permission: "questions.review",
      showToRoles: ['admin', 'reviewer']
    },
    {
      title: "Rejected Questions",
      value: stats.rejectedQuestions.toLocaleString(),
      description: "Need revision",
      icon: AlertCircle,
      trend: "critical", // Always critical styling for rejected questions
      permission: "questions.create",
      showToRoles: ['admin', 'creator']
    },
    {
      title: "Flagged Questions",
      value: stats.questionReports.toLocaleString(),
      description: `${stats.pendingReports} need attention`,
      icon: AlertCircle,
      trend: "critical", // Always critical styling for flagged questions
      permission: "questions.review"
    }
  ]

  // Filter cards based on user permissions and roles
  const cards = allCards.filter(card => {
    if (card.adminOnly && !isAdmin) return false
    if (card.permission && !canAccess(card.permission)) return false

    // Check role-specific visibility
    if (card.showToRoles) {
      const userRole = isAdmin ? 'admin' : isReviewer ? 'reviewer' : isCreator ? 'creator' : 'user'
      if (!card.showToRoles.includes(userRole)) return false
    }

    return true
  })

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "positive":
        return "text-green-600 dark:text-green-500"
      case "warning":
        return "text-yellow-600 dark:text-yellow-500"
      case "negative":
        return "text-destructive"
      case "critical":
        return "text-destructive font-medium"
      default:
        return "text-muted-foreground"
    }
  }

  const getCardBorderColor = (trend: string) => {
    // All cards have the same border and background
    return ""
  }

  const getValueColor = (trend: string) => {
    switch (trend) {
      case "critical":
        return "text-destructive"
      default:
        return ""
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "positive":
        return <TrendingUp className="h-3 w-3" />
      case "warning":
        return <AlertCircle className="h-3 w-3" />
      case "negative":
        return <AlertCircle className="h-3 w-3" />
      case "critical":
        return <AlertCircle className="h-3 w-3" />
      default:
        return null
    }
  }

  const getIconColor = (trend: string) => {
    switch (trend) {
      case "critical":
        return "text-destructive"
      case "negative":
        return "text-destructive"
      case "warning":
        return "text-yellow-500 dark:text-yellow-400"
      case "positive":
        return "text-green-500 dark:text-green-400"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, index) => (
        <Card key={index} className={getCardBorderColor(card.trend)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <card.icon className={`h-4 w-4 ${getIconColor(card.trend)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getValueColor(card.trend)}`}>
              {card.value}
            </div>
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
