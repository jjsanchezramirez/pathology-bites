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

// src/components/questions/question-table/question-table-header.tsx
export function QuestionTableHeader() {
  return (
    <thead className="bg-muted/50">
      <tr>
        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-medium text-muted-foreground">
          Question
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Categories
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Images
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Difficulty
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Yield
        </th>
        <th scope="col" className="px-3 py-3.5 text-left text-sm font-medium text-muted-foreground">
          Updated
        </th>
        <th scope="col" className="relative py-3.5 pl-3 pr-4">
          <span className="sr-only">Actions</span>
        </th>
      </tr>
    </thead>
  )
}

// src/components/questions/question-table/question-table-empty.tsx
import { AlertCircle } from 'lucide-react'

interface QuestionTableEmptyProps {
  hasFilters: boolean
}

export function QuestionTableEmpty({ hasFilters }: QuestionTableEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-center">
      <AlertCircle className="h-6 w-6 text-muted-foreground mb-2" />
      <p className="text-muted-foreground">No questions found</p>
      <p className="text-sm text-muted-foreground">
        {hasFilters
          ? 'Try adjusting your search or filters'
          : 'Click "Add Question" to create your first question'}
      </p>
    </div>
  )
}

// src/components/questions/question-table/question-table-loading.tsx
import { Loader2 } from 'lucide-react'

export function QuestionTableLoading() {
  return (
    <div className="flex justify-center items-center h-32">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}

// src/components/questions/question-table/question-table-body.tsx
import QuestionRow from '../question-row'

interface QuestionTableBodyProps {
  questions: Question[]
  categoryPaths: Map<number, Category>
  onDelete: (id: string) => void
}

export function QuestionTableBody({ questions, categoryPaths, onDelete }: QuestionTableBodyProps) {
  return (
    <tbody className="divide-y divide-border bg-background">
      {questions.map((question) => (
        <QuestionRow 
          key={question.id} 
          question={question}
          categoryPaths={categoryPaths}
          onDelete={onDelete}
        />
      ))}
    </tbody>
  )
}