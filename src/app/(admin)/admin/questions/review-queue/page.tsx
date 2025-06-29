// src/app/(admin)/admin/questions/review-queue/page.tsx
import { Metadata } from 'next'
import { ReviewQueueTable } from '@/features/questions/components/review-queue-table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { ClipboardList, Clock, AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Review Queue - Admin Dashboard',
  description: 'Review questions that need approval or attention',
}

export default function ReviewQueuePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review Queue</h1>
        <p className="text-muted-foreground">
          Review questions that need approval, are flagged, or require attention.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Questions awaiting review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Flagged Questions
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Published questions flagged for review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Review Time
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4h</div>
            <p className="text-xs text-muted-foreground">
              Average time to review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Review Queue Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Questions Requiring Review
          </CardTitle>
          <CardDescription>
            Questions that need review, approval, or have been flagged by users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReviewQueueTable />
        </CardContent>
      </Card>
    </div>
  )
}
