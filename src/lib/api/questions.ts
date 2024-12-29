// src/lib/api/questions.ts
import { supabase } from '@/lib/supabase/client'
import type { Question, QuestionFormData, QuestionFilters } from '@/types/questions'

export const questionApi = {
  async getQuestions(filters: QuestionFilters = {}, page = 1, limit = 10) {
    let query = supabase
      .from('questions')
      .select(`
        *,
        question_options(*),
        question_categories(
          category_id,
          categories(*)
        ),
        question_tags(
          tag_id,
          tags(*)
        )
      `)
      .range((page - 1) * limit, page * limit - 1)
      .order('created_at', { ascending: false })

    if (filters.categories?.length) {
      query = query.in('question_categories.category_id', filters.categories)
    }

    if (filters.tags?.length) {
      query = query.in('question_tags.tag_id', filters.tags)
    }

    if (filters.difficulty) {
      query = query.eq('difficulty', filters.difficulty)
    }

    if (filters.rank) {
      query = query.eq('rank', filters.rank)
    }

    if (filters.search) {
      query = query.ilike('body', `%${filters.search}%`)
    }

    const { data, error, count } = await query.returns<Question[]>()

    if (error) throw error

    return {
      questions: data || [],
      total: count || 0
    }
  },

  async createQuestion(questionData: QuestionFormData) {
    const { body, explanation, reference_text, difficulty, rank, options, category_ids, tag_ids } = questionData

    // Start a transaction
    const { data: question, error: questionError } = await supabase
      .from('questions')
      .insert({
        body,
        explanation,
        reference_text,
        difficulty,
        rank
      })
      .select()
      .single()

    if (questionError) throw questionError

    // Insert options
    const { error: optionsError } = await supabase
      .from('question_options')
      .insert(
        options.map(option => ({
          question_id: question.id,
          ...option
        }))
      )

    if (optionsError) throw optionsError

    // Insert category relationships
    if (category_ids.length) {
      const { error: categoriesError } = await supabase
        .from('question_categories')
        .insert(
          category_ids.map(category_id => ({
            question_id: question.id,
            category_id
          }))
        )

      if (categoriesError) throw categoriesError
    }

    // Insert tag relationships
    if (tag_ids.length) {
      const { error: tagsError } = await supabase
        .from('question_tags')
        .insert(
          tag_ids.map(tag_id => ({
            question_id: question.id,
            tag_id
          }))
        )

      if (tagsError) throw tagsError
    }

    return question
  },

  async updateQuestion(id: string, questionData: Partial<QuestionFormData>) {
    const { body, explanation, reference_text, difficulty, rank, options, category_ids, tag_ids } = questionData

    // Update question
    const { error: questionError } = await supabase
      .from('questions')
      .update({
        body,
        explanation,
        reference_text,
        difficulty,
        rank
      })
      .eq('id', id)

    if (questionError) throw questionError

    // Update options if provided
    if (options) {
      // Delete existing options
      const { error: deleteError } = await supabase
        .from('question_options')
        .delete()
        .eq('question_id', id)

      if (deleteError) throw deleteError

      // Insert new options
      const { error: optionsError } = await supabase
        .from('question_options')
        .insert(
          options.map(option => ({
            question_id: id,
            ...option
          }))
        )

      if (optionsError) throw optionsError
    }

    // Update categories if provided
    if (category_ids) {
      const { error: deleteCategoriesError } = await supabase
        .from('question_categories')
        .delete()
        .eq('question_id', id)

      if (deleteCategoriesError) throw deleteCategoriesError

      if (category_ids.length) {
        const { error: categoriesError } = await supabase
          .from('question_categories')
          .insert(
            category_ids.map(category_id => ({
              question_id: id,
              category_id
            }))
          )

        if (categoriesError) throw categoriesError
      }
    }

    // Update tags if provided
    if (tag_ids) {
      const { error: deleteTagsError } = await supabase
        .from('question_tags')
        .delete()
        .eq('question_id', id)

      if (deleteTagsError) throw deleteTagsError

      if (tag_ids.length) {
        const { error: tagsError } = await supabase
          .from('question_tags')
          .insert(
            tag_ids.map(tag_id => ({
              question_id: id,
              tag_id
            }))
          )

        if (tagsError) throw tagsError
      }
    }

    return id
  },

  async deleteQuestion(id: string) {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', id)

    if (error) throw error

    return id
  }
}