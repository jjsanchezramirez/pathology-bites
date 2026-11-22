// src/app/(admin)/admin/notifications/page.tsx
import { Metadata } from "next";
import { Suspense } from "react";
import { SystemUpdateBroadcaster } from "@/features/admin/notifications/components/system-update-broadcaster";
import { RequirePermission } from "@/shared/components/auth/role-guard";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer } from "@/shared/components/ui/page-layout";
import { NotificationsSkeleton } from "@/features/admin/notifications/components/notifications-skeleton";

export const metadata: Metadata = {
  title: "System Notifications - Admin Dashboard",
  description: "Broadcast system updates and notifications to users",
};

export default function NotificationsPage() {
  return (
    <RequirePermission permission="notifications.manage">
      <PageContainer width="narrow">
        <PageHeader
          title="System Notifications"
          description="Broadcast system updates, maintenance notices, and announcements to users."
        />

        <Suspense fallback={<NotificationsSkeleton />}>
          <SystemUpdateBroadcaster />
        </Suspense>
      </PageContainer>
    </RequirePermission>
  );
}
