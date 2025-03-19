// src/components/questions/questions-table.tsx
'use client'

import { QuestionTableHeader } from '@/components/questions/question-table/question-table-header'
import { QuestionTableBody } from '@/components/questions/question-table/question-table-body'
import { QuestionTableEmpty } from '@/components/questions/question-table/question-table-empty'
import { QuestionTableLoading } from '@/components/questions/question-table/question-table-loading'
import { Question, Category } from '@/types/questions'

interface QuestionTableProps {
  questions: Question[]
  categoryPaths: Map<number, Category>
  isLoading: boolean
  onDelete: (id: string) => void
  hasFilters: boolean
}

export function QuestionTable({
  questions,
  categoryPaths,
  isLoading,
  onDelete,
  hasFilters
}: QuestionTableProps) {
  if (isLoading) {
    return <QuestionTableLoading />
  }

  if (questions.length === 0) {
    return <QuestionTableEmpty hasFilters={hasFilters} />
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="min-w-full divide-y divide-border">
        <QuestionTableHeader />
        <QuestionTableBody
          questions={questions}
          categoryPaths={categoryPaths}
          onDelete={onDelete}
        />
      </table>
    </div>
  )
}