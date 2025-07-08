// src/app/(admin)/admin/questions/page.tsx
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUserRole } from '@/shared/hooks/use-user-role'
import { QuestionsTable } from '@/features/questions/components/questions-table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/shared/components/ui/card"

export default function QuestionsPage() {
  const router = useRouter()
  const { role, isLoading } = useUserRole()

  useEffect(() => {
    // Redirect creators to their personal dashboard
    if (!isLoading && role === 'creator') {
      router.push('/admin/my-questions')
    }
  }, [role, isLoading, router])

  // Show loading while checking role
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  // Only admins see the full questions table
  if (role !== 'admin') {
    return null // Will redirect via useEffect
  }
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