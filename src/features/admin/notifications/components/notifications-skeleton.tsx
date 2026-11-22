// src/features/admin/components/notifications-skeleton.tsx
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Megaphone } from "lucide-react";

export function NotificationsSkeleton() {
  return (
    <SectionCard
      title="Broadcast System Update"
      icon={Megaphone}
      description="Send notifications to users about system updates, new features, or important announcements."
    >
      {/* Title Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Message Field */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-24 w-full" />
      </div>

      {/* Update Type */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Severity */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Target Audience */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>

      {/* Submit Button */}
      <Skeleton className="h-10 w-full" />
    </SectionCard>
  );
}
