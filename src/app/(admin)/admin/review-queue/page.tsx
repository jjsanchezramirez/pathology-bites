import { Metadata } from 'next'
import { UnifiedReviewQueue } from '@/features/questions/components/unified-review-queue'
import { RequirePermission } from '@/shared/components/auth/role-guard'

export const metadata: Metadata = {
  title: 'Review Queue | Pathology Bites Admin',
  description: 'Review new question submissions and flagged questions',
}

export default function ReviewQueuePage() {
  return (
    <RequirePermission permission="questions.review">
      <UnifiedReviewQueue />
    </RequirePermission>
  )
}
