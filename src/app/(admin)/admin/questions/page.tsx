// src/app/(admin)/admin/questions/page.tsx
'use client'


import { useUserRole } from '@/shared/hooks/use-user-role'
import { QuestionsTable } from '@/features/questions/components/questions-table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"

export default function QuestionsPage() {
  const { role, isLoading } = useUserRole()

  // Show loading while checking role
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  // All admin roles can access the question database
  if (!role || !['admin', 'creator', 'reviewer'].includes(role)) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Access denied. Admin privileges required.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Question Database</h1>
        <p className="text-muted-foreground">
          Browse, search, and manage all questions in the system. Export, edit, and organize questions with advanced filtering and bulk operations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Questions</CardTitle>
          <CardDescription>
            Comprehensive view of all questions with advanced search, filtering, and bulk operations. Role-based permissions apply to editing and deletion.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionsTable />
        </CardContent>
      </Card>
    </div>
  )
}