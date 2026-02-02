// src/app/(admin)/admin/notifications/page.tsx
import { Metadata } from "next";
import { Suspense } from "react";
import { SystemUpdateBroadcaster } from "@/features/admin/notifications/components/system-update-broadcaster";
import { RequirePermission } from "@/shared/components/auth/role-guard";
import { NotificationsSkeleton } from "@/features/admin/notifications/components/notifications-skeleton";

export const metadata: Metadata = {
  title: "System Notifications - Admin Dashboard",
  description: "Broadcast system updates and notifications to users",
};

export default function NotificationsPage() {
  return (
    <RequirePermission permission="notifications.manage">
      <div className="container max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">System Notifications</h1>
          <p className="text-muted-foreground">
            Broadcast system updates, maintenance notices, and announcements to users.
          </p>
        </div>

        <Suspense fallback={<NotificationsSkeleton />}>
          <SystemUpdateBroadcaster />
        </Suspense>
      </div>
    </RequirePermission>
  );
}
