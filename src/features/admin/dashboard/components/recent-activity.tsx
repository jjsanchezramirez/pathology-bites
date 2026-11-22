// src/shared/components/layout/dashboard/recent-activity.tsx
import { memo, useMemo } from "react";
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Badge } from "@/shared/components/ui/badge";
import { FileQuestion, Users, MessageSquare, Image as ImageIcon, Clock } from "lucide-react";
import { RecentActivity } from "@/features/admin/dashboard/services/service";
import { log } from "@/shared/utils/logging";

interface RecentActivityProps {
  activities: RecentActivity[];
}

export const RecentActivityCard = memo(function RecentActivityCard({
  activities,
}: RecentActivityProps) {
  const getActivityIcon = useMemo(
    () =>
      function getActivityIcon(type: string) {
        switch (type) {
          case "question":
            return <FileQuestion className="h-4 w-4 text-blue-500" />;
          case "user":
            return <Users className="h-4 w-4 text-green-500" />;
          case "inquiry":
            return <MessageSquare className="h-4 w-4 text-orange-500" />;
          case "image":
            return <ImageIcon className="h-4 w-4 text-purple-500" />;
          default:
            return <Clock className="h-4 w-4 text-gray-500" />;
        }
      },
    []
  );

  const getActivityBadge = useMemo(
    () =>
      function getActivityBadge(type: string) {
        switch (type) {
          case "question":
            return (
              <Badge variant="secondary" className="text-xs">
                Question
              </Badge>
            );
          case "user":
            return (
              <Badge variant="outline" className="text-xs">
                User
              </Badge>
            );
          case "inquiry":
            return (
              <Badge variant="default" className="text-xs">
                Inquiry
              </Badge>
            );
          case "image":
            return (
              <Badge variant="secondary" className="text-xs">
                Image
              </Badge>
            );
          default:
            return (
              <Badge variant="outline" className="text-xs">
                Activity
              </Badge>
            );
        }
      },
    []
  );

  const formatTimestamp = (timestamp: string) => {
    // Handle null, undefined, or empty timestamps
    if (!timestamp || timestamp === "null" || timestamp === "undefined") {
      return "Unknown time";
    }

    // Try to parse the timestamp
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      log.warn("Invalid timestamp received:", timestamp);
      return "Invalid date";
    }

    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      const diffInHours = Math.floor(diffInMinutes / 60);
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInMinutes / 1440);
      return `${diffInDays}d ago`;
    }
  };

  return (
    <SectionCard title="Recent Activity" icon={Clock}>
      {activities.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          <Clock className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
            >
              <div className="mt-0.5 shrink-0">{getActivityIcon(activity.type)}</div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{activity.title}</p>
                  {getActivityBadge(activity.type)}
                </div>
                <p className="truncate text-sm text-muted-foreground">{activity.description}</p>
                {activity.user && (
                  <p className="text-xs text-muted-foreground">by {activity.user}</p>
                )}
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {formatTimestamp(activity.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
});
