// src/app/(admin)/admin/questions/page.tsx
import { Metadata } from 'next'
import { QuestionsTable } from '@/components/questions/questions-table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: 'Questions - Admin Dashboard',
  description: 'Manage and organize your question bank',
}

export default function QuestionsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Questions</h1>
        <p className="text-muted-foreground">
          Manage and organize your question bank with support for multiple question sets and image associations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question Management</CardTitle>
          <CardDescription>
            Create, edit, and organize questions. Associate questions with question sets and add relevant images.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionsTable />
        </CardContent>
      </Card>
    </div>
  )
}