// Debug component to check role information
'use client'

import { useSharedAuth } from '@/shared/hooks/use-shared-auth'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

export function RoleDebug() {
  const { user, isAuthenticated, isLoading: authLoading } = useSharedAuth()
  const { role, isAdmin, isLoading: roleLoading, error } = useUserRole()

  if (!isAuthenticated) {
    return <div>Not authenticated</div>
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Role Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div><strong>Auth Loading:</strong> {authLoading.toString()}</div>
        <div><strong>Role Loading:</strong> {roleLoading.toString()}</div>
        <div><strong>User ID:</strong> {user?.id}</div>
        <div><strong>User Email:</strong> {user?.email}</div>
        <div><strong>Auth User Role:</strong> {user && 'role' in user ? (user as { role?: string }).role || 'undefined' : 'undefined'}</div>
        <div><strong>Database Role:</strong> {role || 'null'}</div>
        <div><strong>Is Admin:</strong> {isAdmin.toString()}</div>
        <div><strong>Role Error:</strong> {error || 'none'}</div>
      </CardContent>
    </Card>
  )
}
