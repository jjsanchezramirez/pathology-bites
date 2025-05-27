// src/app/(admin)/admin/users/page.tsx
import { Metadata } from 'next'
import { UsersTable } from '@/components/users/users-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = {
  title: 'Users - Admin Dashboard',
  description: 'Manage platform users and their permissions',
}

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage all registered users on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable />
        </CardContent>
      </Card>
    </div>
  )
}