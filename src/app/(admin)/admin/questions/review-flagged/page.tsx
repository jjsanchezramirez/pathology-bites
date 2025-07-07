// src/app/(admin)/admin/questions/review-flagged/page.tsx
import { Metadata } from 'next'
import { FlaggedQuestionsTable } from '@/features/questions/components/flagged-questions-table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"
import { Flag } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Review Flagged Questions - Admin Dashboard',
  description: 'Review and resolve user-flagged questions',
}

export default function ReviewFlaggedQuestionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Flag className="h-8 w-8" />
          Review Flagged Questions
        </h1>
        <p className="text-muted-foreground">
          Investigate and resolve questions that have been flagged by users for issues.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Flagged Questions</CardTitle>
          <CardDescription>
            Published questions with pending user-reported issues that require investigation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FlaggedQuestionsTable />
        </CardContent>
      </Card>
    </div>
  )
}
