'use client'

import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

interface QuizEmptyStateProps {
  hasFilters: boolean
}

export function QuizEmptyState({ hasFilters }: QuizEmptyStateProps) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <div className="space-y-4">
          <div className="text-muted-foreground">
            {hasFilters
              ? "No quizzes match your current filters"
              : "You haven't taken any quizzes yet"
            }
          </div>
          <Link href="/dashboard/quiz/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Quiz
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

