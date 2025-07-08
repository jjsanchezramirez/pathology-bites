import { Metadata } from 'next'
import { CreatorQuestionsDashboard } from '@/features/questions/components/creator-questions-dashboard'
import { RequirePermission } from '@/shared/components/auth/role-guard'

export const metadata: Metadata = {
  title: 'My Questions | Pathology Bites Admin',
  description: 'Manage your questions and track their review status',
}

export default function MyQuestionsPage() {
  return (
    <RequirePermission permission="questions.create">
      <CreatorQuestionsDashboard />
    </RequirePermission>
  )
}
