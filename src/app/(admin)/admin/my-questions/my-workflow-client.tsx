'use client'

import { CreatorWorkflowDashboard } from '@/features/questions/components/creator-workflow-dashboard'
import { RoleGuard } from '@/shared/components/auth/role-guard'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import Link from 'next/link'

export function MyWorkflowClient() {
  const { canAccess, isLoading, role } = useUserRole()
  
  // Allow both creators and reviewers to access this page
  const hasAccess = canAccess('questions.create') || canAccess('questions.review')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!hasAccess) {
    return (
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
              Required role: Creator or Reviewer
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

  return (
    <div className="container mx-auto py-8 px-4">
      <CreatorWorkflowDashboard />
    </div>
  )
}

