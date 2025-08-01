// src/app/(admin)/admin/notifications/page.tsx
import { Metadata } from 'next'
import { SystemUpdateBroadcaster } from '@/features/admin/components/system-update-broadcaster'
import { RequirePermission } from '@/shared/components/auth/role-guard'

export const metadata: Metadata = {
  title: 'System Notifications - Admin Dashboard',
  description: 'Broadcast system updates and notifications to users',
}

export default function NotificationsPage() {
  return (
    <RequirePermission permission="notifications.manage">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Notifications</h1>
          <p className="text-muted-foreground">
            Broadcast system updates, maintenance notices, and announcements to users.
          </p>
        </div>
        
        <SystemUpdateBroadcaster />
      </div>
    </RequirePermission>
  )
}
