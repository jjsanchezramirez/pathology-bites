// src/components/questions/question-table/question-table-body.tsx
import QuestionRow from '../question-row'
import { Question, Category } from '@/types/questions'

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