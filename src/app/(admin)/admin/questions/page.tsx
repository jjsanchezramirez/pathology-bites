// src/app/(admin)/admin/questions/page.tsx
'use client'


import { useUserRole } from '@/shared/hooks/use-user-role'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
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
  const { adminMode } = useDashboardTheme()

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
  // Get role-specific content based on adminMode
  const getPageContent = () => {
    switch (adminMode) {
      case 'creator':
        return {
          title: 'Question Database (Creator View)',
          description: 'Browse and search questions in the system. Limited to viewing and basic operations.',
          cardTitle: 'All Questions (Read-Only)',
          cardDescription: 'View questions in the database. Bulk operations are not available in creator view.'
        }
      case 'reviewer':
        return {
          title: 'Question Database (Reviewer View)',
          description: 'Browse and search questions for review purposes. Limited to viewing and basic operations.',
          cardTitle: 'All Questions (Read-Only)',
          cardDescription: 'View questions in the database. Bulk operations are not available in reviewer view.'
        }
      default: // admin
        return {
          title: 'Question Database',
          description: 'Browse, search, and manage all questions in the system. Export, edit, and organize questions with advanced filtering and bulk operations.',
          cardTitle: 'All Questions',
          cardDescription: 'Comprehensive view of all questions with advanced search, filtering, and bulk operations. Role-based permissions apply to editing and deletion.'
        }
    }
  }

  const content = getPageContent()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{content.title}</h1>
        <p className="text-muted-foreground">
          {content.description}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{content.cardTitle}</CardTitle>
          <CardDescription>
            {content.cardDescription}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionsTable adminMode={adminMode} />
        </CardContent>
      </Card>
    </div>
  )
}