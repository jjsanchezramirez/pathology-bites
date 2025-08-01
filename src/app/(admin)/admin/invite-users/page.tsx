// src/app/(admin)/admin/invite-users/page.tsx
import { Metadata } from 'next'
import { InviteUsersTool } from '@/features/admin/components/invite-users-tool'
import { RequirePermission } from '@/shared/components/auth/role-guard'

export const metadata: Metadata = {
  title: 'Invite Users - Admin Dashboard',
  description: 'Invite new users to the platform',
}

export default function InviteUsersPage() {
  return (
    <RequirePermission permission="users.manage">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invite Users</h1>
          <p className="text-muted-foreground">
            Send invitation emails to new users with specific roles and permissions.
          </p>
        </div>

        <InviteUsersTool />
      </div>
    </RequirePermission>
  )
}
