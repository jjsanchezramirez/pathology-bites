// src/features/learning-modules/services/integration-service.ts

import { createClient } from '@/shared/services/client'

/**
 * Service for integrating learning modules with existing systems
 * (categories, images, quizzes)
 */
export class LearningModuleIntegrationService {
  private supabase = createClient()

  /**
   * Get all categories for module assignment
   */
  async getCategories() {
    const { data, error } = await this.supabase
      .from('categories')
      .select('id, name, description, level, color, parent_id')
      .eq('status', 'active')
      .order('level', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch categories: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get category hierarchy for better organization
   */
  async getCategoryHierarchy() {
    const categories = await this.getCategories()
    
    // Build hierarchy
    const categoryMap = new Map()
    const rootCategories: any[] = []

    // First pass: create map
    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] })
    })

    // Second pass: build hierarchy
    categories.forEach(category => {
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id)
        if (parent) {
          parent.children.push(categoryMap.get(category.id))
        }
      } else {
        rootCategories.push(categoryMap.get(category.id))
      }
    })

    return rootCategories
  }

  /**
   * Get images for module content
   */
  async getImages(filters: {
    category?: string
    search?: string
    limit?: number
    offset?: number
  } = {}) {
    let query = this.supabase
      .from('images')
      .select('id, url, description, alt_text, category, file_type, width, height, created_at')
      .order('created_at', { ascending: false })

    if (filters.category) {
      query = query.eq('category', filters.category)
    }

    if (filters.search) {
      query = query.or(`description.ilike.%${filters.search}%,alt_text.ilike.%${filters.search}%`)
    }

    if (filters.limit) {
      const start = filters.offset || 0
      query = query.range(start, start + filters.limit - 1)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch images: ${error.message}`)
    }

    return data || []
  }

  /**
   * Associate images with a learning module
   */
  async associateImagesWithModule(moduleId: string, imageAssociations: {
    image_id: string
    usage_type: 'header' | 'content' | 'diagram' | 'example' | 'thumbnail'
    sort_order: number
    caption?: string
    alt_text?: string
    content_section?: string
  }[]) {
    // First, remove existing associations
    await this.supabase
      .from('module_images')
      .delete()
      .eq('module_id', moduleId)

    // Then add new associations
    if (imageAssociations.length > 0) {
      const { error } = await this.supabase
        .from('module_images')
        .insert(imageAssociations.map(assoc => ({
          module_id: moduleId,
          ...assoc
        })))

      if (error) {
        throw new Error(`Failed to associate images: ${error.message}`)
      }
    }
  }

  /**
   * Get quiz sessions that can be linked to modules
   */
  async getQuizSessions(filters: {
    search?: string
    limit?: number
    offset?: number
  } = {}) {
    let query = this.supabase
      .from('quiz_sessions')
      .select('id, title, config, status, created_at, total_questions')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (filters.search) {
      query = query.ilike('title', `%${filters.search}%`)
    }

    if (filters.limit) {
      const start = filters.offset || 0
      query = query.range(start, start + filters.limit - 1)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch quiz sessions: ${error.message}`)
    }

    return data || []
  }

  /**
   * Link a quiz to a learning module
   */
  async linkQuizToModule(moduleId: string, quizId: string) {
    const { error } = await this.supabase
      .from('learning_modules')
      .update({ quiz_id: quizId })
      .eq('id', moduleId)

    if (error) {
      throw new Error(`Failed to link quiz to module: ${error.message}`)
    }
  }

  /**
   * Create a quiz session specifically for a learning module
   */
  async createModuleQuiz(moduleId: string, quizData: {
    title: string
    questions: any[]
    config?: any
  }) {
    // Create quiz session
    const { data: quizSession, error: quizError } = await this.supabase
      .from('quiz_sessions')
      .insert({
        title: quizData.title,
        config: {
          mode: 'practice',
          questionCount: quizData.questions.length,
          showExplanations: true,
          allowReview: true,
          ...quizData.config
        },
        status: 'active',
        total_questions: quizData.questions.length
      })
      .select()
      .single()

    if (quizError) {
      throw new Error(`Failed to create quiz session: ${quizError.message}`)
    }

    // Link quiz to module
    await this.linkQuizToModule(moduleId, quizSession.id)

    return quizSession
  }

  /**
   * Get modules by category with full integration data
   */
  async getModulesByCategory(categoryId: string, includeChildren = false) {
    let query = this.supabase
      .from('learning_modules')
      .select(`
        *,
        category:categories(id, name, color, description),
        images:module_images(
          id, usage_type, sort_order, caption, alt_text,
          image:images(id, url, alt_text, description, width, height)
        ),
        quiz:quiz_sessions(id, title, config, total_questions)
      `)
      .eq('status', 'published')

    if (includeChildren) {
      // Get category and its children
      const { data: categories } = await this.supabase
        .from('categories')
        .select('id')
        .or(`id.eq.${categoryId},parent_id.eq.${categoryId}`)

      if (categories && categories.length > 0) {
        const categoryIds = categories.map(c => c.id)
        query = query.in('category_id', categoryIds)
      }
    } else {
      query = query.eq('category_id', categoryId)
    }

    const { data, error } = await query.order('sort_order', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch modules by category: ${error.message}`)
    }

    return data || []
  }

  /**
   * Migrate existing learning path data to new system
   */
  async migrateLearningPathData(existingPathData: any) {
    // This would be used to migrate from the existing learning-path data
    // to the new learning modules system
    
    const { data: learningPath, error: pathError } = await this.supabase
      .from('learning_paths')
      .insert({
        title: existingPathData.name,
        description: existingPathData.description,
        difficulty_level: existingPathData.type === 'ap' ? 'intermediate' : 'beginner',
        status: 'published',
        is_featured: true
      })
      .select()
      .single()

    if (pathError) {
      throw new Error(`Failed to create learning path: ${pathError.message}`)
    }

    // Create modules for each existing module
    const modulePromises = existingPathData.modules.map(async (moduleData: any, index: number) => {
      const { data: module, error: moduleError } = await this.supabase
        .from('learning_modules')
        .insert({
          title: moduleData.name,
          description: moduleData.description,
          difficulty_level: 'beginner',
          estimated_duration_minutes: (moduleData.estimatedHours || 1) * 60,
          content_type: 'text',
          status: moduleData.status === 'available' ? 'published' : 'draft',
          sort_order: moduleData.order || index
        })
        .select()
        .single()

      if (moduleError) {
        throw new Error(`Failed to create module: ${moduleError.message}`)
      }

      // Link module to path
      await this.supabase
        .from('learning_path_modules')
        .insert({
          learning_path_id: learningPath.id,
          module_id: module.id,
          sort_order: index,
          is_required: true
        })

      return module
    })

    const modules = await Promise.all(modulePromises)

    return {
      learningPath,
      modules
    }
  }

  /**
   * Sync module progress with quiz results
   */
  async syncModuleProgressWithQuiz(moduleId: string, userId: string, quizResults: any) {
    // Get or create module attempt
    const { data: existingAttempt } = await this.supabase
      .from('module_attempts')
      .select('*')
      .eq('module_id', moduleId)
      .eq('user_id', userId)
      .eq('quiz_attempt_id', quizResults.sessionId)
      .single()

    if (existingAttempt) {
      // Update existing attempt
      const { error } = await this.supabase
        .from('module_attempts')
        .update({
          assessment_score: quizResults.score,
          completion_status: quizResults.score >= 70 ? 'completed' : 'failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', existingAttempt.id)

      if (error) {
        throw new Error(`Failed to update module attempt: ${error.message}`)
      }
    } else {
      // Create new attempt
      const { error } = await this.supabase
        .from('module_attempts')
        .insert({
          user_id: userId,
          module_id: moduleId,
          quiz_attempt_id: quizResults.sessionId,
          assessment_score: quizResults.score,
          completion_status: quizResults.score >= 70 ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          attempt_number: 1
        })

      if (error) {
        throw new Error(`Failed to create module attempt: ${error.message}`)
      }
    }
  }

  /**
   * Get learning analytics integrated with existing quiz analytics
   */
  async getLearningAnalytics(filters: {
    moduleId?: string
    categoryId?: string
    userId?: string
    dateRange?: { start: string; end: string }
  } = {}) {
    // This would integrate with existing analytics systems
    // to provide comprehensive learning insights
    
    let moduleQuery = this.supabase
      .from('module_attempts')
      .select(`
        *,
        module:learning_modules(id, title, category_id),
        user:users(id, email)
      `)

    if (filters.moduleId) {
      moduleQuery = moduleQuery.eq('module_id', filters.moduleId)
    }

    if (filters.userId) {
      moduleQuery = moduleQuery.eq('user_id', filters.userId)
    }

    if (filters.dateRange) {
      moduleQuery = moduleQuery
        .gte('created_at', filters.dateRange.start)
        .lte('created_at', filters.dateRange.end)
    }

    const { data: attempts, error } = await moduleQuery

    if (error) {
      throw new Error(`Failed to fetch analytics: ${error.message}`)
    }

    // Process and aggregate data
    const analytics = {
      totalAttempts: attempts?.length || 0,
      averageScore: attempts?.reduce((sum, a) => sum + (a.assessment_score || 0), 0) / (attempts?.length || 1),
      completionRate: attempts?.filter(a => a.completion_status === 'completed').length / (attempts?.length || 1) * 100,
      moduleBreakdown: {} as Record<string, any>
    }

    // Group by module
    attempts?.forEach(attempt => {
      const moduleId = attempt.module_id
      if (!analytics.moduleBreakdown[moduleId]) {
        analytics.moduleBreakdown[moduleId] = {
          moduleTitle: attempt.module?.title,
          attempts: 0,
          totalScore: 0,
          completions: 0
        }
      }

      analytics.moduleBreakdown[moduleId].attempts++
      analytics.moduleBreakdown[moduleId].totalScore += attempt.assessment_score || 0
      if (attempt.completion_status === 'completed') {
        analytics.moduleBreakdown[moduleId].completions++
      }
    })

    return analytics
  }
}
