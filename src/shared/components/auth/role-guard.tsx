// src/shared/components/auth/role-guard.tsx
'use client'

import { ReactNode } from 'react'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface RoleGuardProps {
  children: ReactNode
  requiredPermission?: string
  adminOnly?: boolean
  fallback?: ReactNode
  showFallback?: boolean
}

export function RoleGuard({ 
  children, 
  requiredPermission, 
  adminOnly = false, 
  fallback,
  showFallback = true 
}: RoleGuardProps) {
  const { isAdmin, canAccess, isLoading, role } = useUserRole()

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Check admin-only access
  if (adminOnly && !isAdmin) {
    if (!showFallback) return null
    
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Admin Access Required</CardTitle>
            <CardDescription>
              This feature is only available to administrators.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Your current role: <span className="font-medium capitalize">{role || 'Unknown'}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" asChild>
                <Link href="/admin/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check specific permission
  if (requiredPermission && !canAccess(requiredPermission)) {
    if (!showFallback) return null
    
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px] p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <ShieldAlert className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <CardTitle className="text-xl">Insufficient Permissions</CardTitle>
            <CardDescription>
              You don't have permission to access this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Required permission: <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{requiredPermission}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Your current role: <span className="font-medium capitalize">{role || 'Unknown'}</span>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" asChild>
                <Link href="/admin/dashboard">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // User has access, render children
  return <>{children}</>
}

// Convenience components for common use cases
export function AdminOnly({ children, fallback, showFallback = true }: { 
  children: ReactNode
  fallback?: ReactNode
  showFallback?: boolean 
}) {
  return (
    <RoleGuard adminOnly showFallback={showFallback} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

export function RequirePermission({ 
  permission, 
  children, 
  fallback, 
  showFallback = true 
}: { 
  permission: string
  children: ReactNode
  fallback?: ReactNode
  showFallback?: boolean 
}) {
  return (
    <RoleGuard 
      requiredPermission={permission} 
      showFallback={showFallback} 
      fallback={fallback}
    >
      {children}
    </RoleGuard>
  )
}

// Hook for conditional rendering
export function useRoleAccess() {
  const { isAdmin, isCreator, isReviewer, canAccess, role, isCreatorOrAbove } = useUserRole()

  return {
    isAdmin,
    isCreator,
    isReviewer,
    canAccess,
    role,
    hasAdminAccess: isAdmin,
    hasCreatorAccess: isCreator,
    hasReviewerAccess: isReviewer,
    hasAnyAdminAccess: isAdmin || isCreator || isReviewer,
    isCreatorOrAbove
  }
}
