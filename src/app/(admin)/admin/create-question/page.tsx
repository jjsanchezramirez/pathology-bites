import { Metadata } from 'next'
import { CreateQuestionClient } from './create-question-client'
import { RequirePermission } from '@/shared/components/auth/role-guard'
import { PageErrorBoundary } from '@/shared/components/common'

export const metadata: Metadata = {
  title: 'Create Question | Pathology Bites Admin',
  description: 'Create questions using multi-step form with AI assistance and JSON import',
}

export default function CreateQuestionPage() {
  return (
    <RequirePermission permission="questions.create">
      <PageErrorBoundary pageName="Create Question" showHomeButton={true} showBackButton={true}>
        <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Question</h1>
          <p className="text-muted-foreground">
            Create multiple-choice questions using multi-step form with AI assistance and JSON import
          </p>
        </div>

        <CreateQuestionClient />
        </div>
      </PageErrorBoundary>
    </RequirePermission>
  )
}
