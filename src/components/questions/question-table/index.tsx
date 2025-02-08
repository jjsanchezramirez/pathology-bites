// src/components/questions/question-table/index.tsx
'use client'

import { QuestionTableHeader } from './question-table-header'
import { QuestionTableBody } from './question-table-body'
import { QuestionTableEmpty } from './question-table-empty'
import { QuestionTableLoading } from './question-table-loading'

interface Category {
  id: number
  name: string
  level: number
  parent_id: number | null
  path: string
}

interface Image {
  id: string
  url: string
  description: string
  alt_text: string
}

interface Question {
  id: string
  body: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  rank: 'HIGH_YIELD' | 'MEDIUM_YIELD' | 'LOW_YIELD'
  categories: Category[]
  explanation: string
  reference_text: string | null
  images: Image[]
  created_at: string
  updated_at: string
}

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