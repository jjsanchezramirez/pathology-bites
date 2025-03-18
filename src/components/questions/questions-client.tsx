// src/components/questions/questions-client.tsx
'use client'

import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { QuestionFilters } from '@/components/questions/question-filters'
import { QuestionTable } from '@/components/questions/question-table'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { Question, Category } from '@/types/questions'

interface QuestionsClientProps {
  initialQuestions: Question[]
}

export function QuestionsClient({ initialQuestions }: QuestionsClientProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    difficulty: 'ALL',
    yield: 'ALL'
  })

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleDelete = async (id: string) => {
    // Would normally make API call here
    console.log('Deleting question:', id)
  }

  // Convert categories array to Map for the table component
  const categoryPaths = new Map(
    initialQuestions.flatMap(q => 
      q.categories.map(c => [c.id, c])
    )
  )

  const hasFilters = filters.search !== '' || 
    filters.difficulty !== 'ALL' || 
    filters.yield !== 'ALL'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Question Bank</CardTitle>
        <CardDescription>
          View, filter, and manage all questions in the database
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <QuestionFilters 
            filters={filters}
            onFilterChange={handleFilterChange}
          />
          
          <QuestionTable
            questions={initialQuestions}
            categoryPaths={categoryPaths}
            isLoading={isLoading}
            onDelete={handleDelete}
            hasFilters={hasFilters}
          />
        </div>
      </CardContent>
    </Card>
  )
}