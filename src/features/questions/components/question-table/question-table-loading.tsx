// src/components/questions/question-table/question-table-loading.tsx
import { Loader2 } from 'lucide-react'

export function QuestionTableLoading() {
  return (
    <div className="flex justify-center items-center h-32">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
}