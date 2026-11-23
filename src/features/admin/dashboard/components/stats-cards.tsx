"use client";

// src/shared/components/layout/dashboard/stats-cards.tsx
import { StatCard, StatGrid, StatTone } from "@/shared/components/ui/page-layout";
import {
  FileQuestion,
  Users,
  Image as ImageIcon,
  MessageSquare,
  Clock,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { DashboardStats } from "@/features/admin/dashboard/services/service";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context";

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const { isAdmin, canAccess } = useUserRole();
  const { adminMode } = useDashboardTheme();

  const allCards = [
    // Row 1: Platform overview
    {
      title: "Active Users",
      value: stats.activeUsers.toLocaleString(),
      description: `${stats.totalUsers} total registered`,
      icon: Users,
      trend: "neutral",
      permission: "users.view",
      adminOnly: true,
    },
    {
      title: "User Inquiries",
      value: stats.totalInquiries.toLocaleString(),
      description: `${stats.unreadInquiries} need attention`,
      icon: MessageSquare,
      trend: stats.unreadInquiries > 5 ? "warning" : "neutral",
      permission: "inquiries.manage",
      adminOnly: true,
    },
    {
      title: "Published Questions",
      // Use the view's published_questions count directly. The previous
      // total - draft - pending - rejected formula silently ignored
      // 'flagged' and 'archived', so the displayed number drifted from the
      // actual published count whenever non-zero questions sat in those
      // states.
      // `?? 0` defends against stale SWR cache entries written by builds
      // before `publishedQuestions` existed on DashboardStats.
      value: (stats.publishedQuestions ?? 0).toLocaleString(),
      description: "Live and available",
      icon: FileQuestion,
      trend: "positive",
      permission: "questions.view",
    },
    {
      title: "Image Library",
      value: stats.totalImages.toLocaleString(),
      description: "Pathology images available",
      icon: ImageIcon,
      trend: "neutral",
      permission: "images.manage",
      adminOnly: true,
    },

    // Row 2: Question workflow and issues (red cards for problems)
    {
      title: "Draft Questions",
      value: stats.draftQuestions.toLocaleString(),
      description: "Work in progress",
      icon: FileQuestion,
      trend: "neutral",
      permission: "questions.create",
    },
    {
      title: "Pending Reviews",
      value: stats.pendingQuestions.toLocaleString(),
      description: "Questions awaiting review",
      icon: Clock,
      trend: stats.pendingQuestions > 0 ? "warning" : "positive",
      permission: "questions.review",
    },
    {
      title: "Rejected Questions",
      value: stats.rejectedQuestions.toLocaleString(),
      description: "Need revision",
      icon: AlertCircle,
      trend: "critical", // Always critical styling for rejected questions
      permission: "questions.create",
    },
    {
      title: "Flagged Questions",
      value: stats.flaggedQuestions.toLocaleString(),
      description: `${stats.flaggedQuestions} need attention`,
      icon: AlertCircle,
      trend: "critical", // Always critical styling for flagged questions
      permission: "questions.review",
    },
  ];

  // Filter cards based on selected admin mode and user permissions
  const cards = allCards.filter((card) => {
    const viewingAsAdmin = adminMode === "admin";

    // Admin-only cards should only show when viewing as admin AND user has admin permissions
    if (card.adminOnly && (!viewingAsAdmin || !isAdmin)) return false;

    // Still check actual permissions for security
    if (card.permission && !canAccess(card.permission)) return false;

    return true;
  });

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "positive":
        return "text-green-600 dark:text-green-500";
      case "warning":
        return "text-yellow-600 dark:text-yellow-500";
      case "negative":
        return "text-destructive";
      case "critical":
        return "text-destructive font-medium";
      default:
        return "text-muted-foreground";
    }
  };

  const getTone = (trend: string): StatTone => {
    switch (trend) {
      case "critical":
      case "negative":
        return "danger";
      case "warning":
        return "warning";
      case "positive":
        return "success";
      default:
        return "default";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "positive":
        return <TrendingUp className="h-3 w-3" />;
      case "warning":
        return <AlertCircle className="h-3 w-3" />;
      case "negative":
        return <AlertCircle className="h-3 w-3" />;
      case "critical":
        return <AlertCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <StatGrid>
      {cards.map((card, index) => (
        <StatCard
          key={index}
          label={card.title}
          value={card.value}
          icon={card.icon}
          tone={getTone(card.trend)}
          hint={
            <span className={`flex items-center gap-1 ${getTrendColor(card.trend)}`}>
              {getTrendIcon(card.trend)}
              <span>{card.description}</span>
            </span>
          }
        />
      ))}
    </StatGrid>
  );
}
