// src/app/api/content/learning/modules/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/shared/services/server'
import { LEARNING_MODULES } from '@/features/learning-path/data/learning-categories'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      // Return static data for unauthenticated users
      return NextResponse.json({
        data: {
          modules: LEARNING_MODULES,
          userProgress: {},
          overallStats: {
            totalModules: 12, // 6 + 6
            completedModules: 0,
            progressPercentage: 0
          }
        }
      })
    }

    // For authenticated users, fetch their progress data
    // This would be a single optimized query to get all user progress
    const { data: userProgress, error: progressError } = await supabase
      .from('user_module_progress')
      .select(`
        module_id,
        status,
        progress_percentage,
        completed_at,
        score,
        time_spent_minutes
      `)
      .eq('user_id', user.id)

    if (progressError) {
      console.error('Error fetching user progress:', progressError)
      // Continue with static data if progress fetch fails
    }

    // Transform progress data into a lookup map for efficient access
    const progressMap = (userProgress || []).reduce((acc, progress) => {
      acc[progress.module_id] = progress
      return acc
    }, {} as Record<string, any>)

    // Calculate overall statistics
    const totalSubModules = LEARNING_MODULES.reduce((sum, module) => sum + module.modules.length, 0)
    const completedSubModules = Object.values(progressMap).filter(p => p.status === 'completed').length
    const overallProgress = totalSubModules > 0 ? (completedSubModules / totalSubModules) * 100 : 0

    // Merge static module data with user progress
    const modulesWithProgress = LEARNING_MODULES.map(module => ({
      ...module,
      modules: module.modules.map(subModule => {
        const progress = progressMap[subModule.id]
        return {
          ...subModule,
          status: progress?.status || subModule.status,
          progress: progress?.progress_percentage || subModule.progress,
          score: progress?.score || subModule.score,
          completedAt: progress?.completed_at,
          timeSpent: progress?.time_spent_minutes
        }
      })
    }))

    // Update module-level progress statistics
    modulesWithProgress.forEach(module => {
      const completedInModule = module.modules.filter(m => m.status === 'completed').length
      module.completedModules = completedInModule
      module.progress = (completedInModule / module.totalModules) * 100
    })

    return NextResponse.json({
      data: {
        modules: modulesWithProgress,
        userProgress: progressMap,
        overallStats: {
          totalModules: totalSubModules,
          completedModules: completedSubModules,
          progressPercentage: Math.round(overallProgress)
        }
      }
    })

  } catch (error) {
    console.error('Unexpected error in learning API:', error)
    
    // Return static data as fallback
    return NextResponse.json({
      data: {
        modules: LEARNING_MODULES,
        userProgress: {},
        overallStats: {
          totalModules: 12,
          completedModules: 0,
          progressPercentage: 0
        }
      }
    })
  }
}

// Update user progress for a specific module
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { moduleId, status, progressPercentage, score } = body

    if (!moduleId) {
      return NextResponse.json(
        { error: 'Module ID is required' },
        { status: 400 }
      )
    }

    // Upsert user progress
    const { data: progress, error } = await supabase
      .from('user_module_progress')
      .upsert({
        user_id: user.id,
        module_id: moduleId,
        status: status || 'in_progress',
        progress_percentage: progressPercentage || 0,
        score: score,
        updated_at: new Date().toISOString(),
        ...(status === 'completed' && !body.completed_at && { completed_at: new Date().toISOString() })
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating user progress:', error)
      return NextResponse.json(
        { error: 'Failed to update progress' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: progress })

  } catch (error) {
    console.error('Unexpected error updating progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}