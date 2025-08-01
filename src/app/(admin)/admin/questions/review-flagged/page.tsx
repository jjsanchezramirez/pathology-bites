// src/app/(admin)/admin/questions/review-flagged/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ReviewFlaggedQuestionsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to unified review queue with flagged filter
    router.replace('/admin/review-queue?tab=flagged_question')
  }, [router])

  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground mt-2">Redirecting to Review Queue...</p>
      </div>
    </div>
  )
}
