// src/app/(admin)/admin/questions/review/page.tsx
import { Metadata } from 'next'
import { DraftQuestionsTable } from '@/features/questions/components/draft-questions-table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"

export const metadata: Metadata = {
  title: 'Review Draft Questions - Admin Dashboard',
  description: 'Review and approve pending draft questions',
}

export default function ReviewDraftQuestionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Draft Questions</h1>
        <p className="text-muted-foreground">
          Review, approve, or reject questions that are pending publication.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Draft Questions</CardTitle>
          <CardDescription>
            Questions with "draft" status that require review before being published.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DraftQuestionsTable />
        </CardContent>
      </Card>
    </div>
  )
}
