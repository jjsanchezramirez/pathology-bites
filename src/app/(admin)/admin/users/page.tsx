// src/app/(admin)/admin/users/page.tsx
'use client'

import { useRef } from 'react'

import { UsersTable } from '@/features/users/components/users-table'
import { UserStatsCards, UserStatsRef } from '@/features/users/components/user-stats-cards'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'

export default function UsersPage() {
  const userStatsRef = useRef<UserStatsRef>(null);

  const handleUserChange = () => {
    // Refresh user stats when user data changes
    userStatsRef.current?.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      {/* User Statistics Cards */}
      <UserStatsCards ref={userStatsRef} />

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            View and manage all registered users on the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UsersTable onUserChange={handleUserChange} />
        </CardContent>
      </Card>
    </div>
  )
}