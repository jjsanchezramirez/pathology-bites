// src/hooks/useQuestions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { questionApi } from '@/lib/api/questions'
import type { QuestionFilters, QuestionFormData } from '@/types/questions'

export function useQuestions(filters: QuestionFilters = {}, page = 1, limit = 10) {
  return useQuery({
    queryKey: ['questions', filters, page, limit],
    queryFn: () => questionApi.getQuestions(filters, page, limit)
  })
}

export function useCreateQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: QuestionFormData) => questionApi.createQuestion(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    }
  })
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<QuestionFormData> }) =>
      questionApi.updateQuestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    }
  })
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => questionApi.deleteQuestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questions'] })
    }
  })
}