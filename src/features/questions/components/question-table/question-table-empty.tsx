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