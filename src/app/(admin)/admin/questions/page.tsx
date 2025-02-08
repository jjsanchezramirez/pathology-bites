// src/app/(admin)/admin/questions/page.tsx
import { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { QuestionsClient } from '@/components/questions/questions-client'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Questions - Admin Dashboard',
  description: 'Manage and organize your question bank',
}

// Example data - would normally come from database
const SAMPLE_QUESTIONS = [
  {
    id: '1',
    body: 'What is the most common cause of chronic kidney disease in adults?',
    difficulty: 'MEDIUM',
    rank: 'HIGH_YIELD',
    categories: [
      { id: 1, name: 'Nephrology', level: 1, parent_id: null, path: 'Nephrology' },
      { id: 2, name: 'CKD', level: 2, parent_id: 1, path: 'Nephrology/CKD' }
    ],
    explanation: 'Diabetes mellitus is the leading cause of CKD in adults...',
    reference_text: 'Harrison\'s Principles of Internal Medicine, 20e',
    images: [
      {
        id: 'img1',
        url: '/api/placeholder/400/300',
        description: 'Diabetic nephropathy histology',
        alt_text: 'Microscopic view of diabetic nephropathy'
      }
    ],
    created_at: '2024-01-01',
    updated_at: '2024-02-07'
  },
  {
    id: '2',
    body: 'Which of the following is characteristic of membranous nephropathy?',
    difficulty: 'HARD',
    rank: 'MEDIUM_YIELD',
    categories: [
      { id: 1, name: 'Nephrology', level: 1, parent_id: null, path: 'Nephrology' },
      { id: 3, name: 'Glomerular', level: 2, parent_id: 1, path: 'Nephrology/Glomerular' }
    ],
    explanation: 'Membranous nephropathy is characterized by...',
    reference_text: 'Robbins and Cotran Pathologic Basis of Disease, 10e',
    images: [],
    created_at: '2024-01-15',
    updated_at: '2024-02-01'
  }
]

export default async function QuestionsPage() {
  // Here you would normally fetch data from your database
  const questions = SAMPLE_QUESTIONS

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

      <QuestionsClient initialQuestions={questions} />
    </div>
  )
}