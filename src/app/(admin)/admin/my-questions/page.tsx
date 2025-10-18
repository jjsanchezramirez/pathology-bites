import { Metadata } from 'next'
import { CreatorWorkflowDashboard } from '@/features/questions/components/creator-workflow-dashboard'
import { RequirePermission } from '@/shared/components/auth/role-guard'

export const metadata: Metadata = {
  title: 'My Workflow | Pathology Bites Admin',
  description: 'Manage questions that need your attention',
}

export default function MyQuestionsPage() {
  return (
    <RequirePermission permission="questions.create">
      <div className="container mx-auto py-8 px-4">
        <CreatorWorkflowDashboard />
      </div>
    </RequirePermission>
  )
}
