// src/features/learning-path/types/learning-path.ts

export interface LearningModule {
  id: string
  name: string
  description: string
  questionCount: number
  estimatedHours: number
  status: 'completed' | 'in_progress' | 'locked' | 'available'
  progress?: number
  score?: number
  categoryId?: string
  prerequisites?: string[] // IDs of modules that must be completed first
  order: number
}

export interface LearningCategory {
  id: string
  name: string
  description: string
  type: 'ap' | 'cp'
  modules: LearningModule[]
  progress: number
  completedModules: number
  totalModules: number
  color?: string
  icon?: string
}

export interface LearningPathProgress {
  userId: string
  categoryId: string
  moduleId: string
  status: 'not_started' | 'in_progress' | 'completed'
  progress: number
  score?: number
  timeSpent: number
  lastAccessed: string
  completedAt?: string
}

export interface UserLearningStats {
  totalModulesCompleted: number
  totalModulesAvailable: number
  overallProgress: number
  apProgress: number
  cpProgress: number
  currentStreak: number
  totalStudyTime: number
  averageScore: number
}
