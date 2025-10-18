import { Metadata } from 'next'
import { RequirePermission } from '@/shared/components/auth/role-guard'
import { PageErrorBoundary } from '@/shared/components/common'
import { EditQuestionClient } from './edit-question-client'

export const metadata: Metadata = {
  title: 'Edit Question | Pathology Bites Admin',
  description: 'Edit question details, images, and metadata',
}

export default function EditQuestionPage({ params }: { params: { id: string } }) {
  return (
    <RequirePermission permission="questions.update">
      <PageErrorBoundary pageName="Edit Question" showHomeButton={true} showBackButton={true}>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Question</h1>
            <p className="text-muted-foreground">
              Update question content, images, and metadata
            </p>
          </div>

          <EditQuestionClient questionId={params.id} />
        </div>
      </PageErrorBoundary>
    </RequirePermission>
  )
}

