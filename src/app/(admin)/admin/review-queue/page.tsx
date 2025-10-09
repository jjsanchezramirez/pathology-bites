import { Metadata } from 'next'
import { ReviewQueue } from '@/features/questions/components/review-queue'
import { RequirePermission } from '@/shared/components/auth/role-guard'

export const metadata: Metadata = {
  title: 'My Review Queue | Pathology Bites Admin',
  description: 'Review questions assigned to you',
}

export default function ReviewQueuePage() {
  return (
    <RequirePermission permission="questions.review">
      <div className="container mx-auto py-8 px-4">
        <ReviewQueue />
      </div>
    </RequirePermission>
  )
}
