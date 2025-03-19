// src/app/(admin)/admin/questions/page.tsx
import { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export const metadata: Metadata = {
  title: 'Questions - Admin Dashboard',
  description: 'Manage and organize your question bank',
}

export default function QuestionsPage() {
  return (
    <div className="space-y-6 p-6 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Questions</h1>
          <p className="text-muted-foreground">
            Manage and organize your question bank
          </p>
        </div>
        <Button className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      <Card className="p-6">
        <div className="text-center py-6">
          <p className="text-muted-foreground">This is a dummy question management page.</p>
          <p className="text-muted-foreground">In a real application, this would display a table of questions.</p>
        </div>
      </Card>
    </div>
  )
}