// src/features/learning-modules/components/module-card.tsx

'use client'

import React from 'react'
import Link from 'next/link'
import { Clock, BookOpen, Star, Users, CheckCircle, PlayCircle, Lock } from 'lucide-react'
import { LearningModule } from '../types/learning-modules'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { HealthIconImg } from '@/shared/components/ui/health-icon'

interface ModuleCardProps {
  module: LearningModule
  showProgress?: boolean
  showCategory?: boolean
  variant?: 'default' | 'compact' | 'detailed'
  onClick?: () => void
  className?: string
}

export function ModuleCard({
  module,
  showProgress = false,
  showCategory = true,
  variant = 'default',
  onClick,
  className = ''
}: ModuleCardProps) {
  const isCompleted = module.user_progress?.is_completed || false
  const hasProgress = module.user_progress && module.user_progress.sessions.length > 0
  const bestScore = module.user_progress?.best_score
  const totalTimeSpent = module.user_progress?.total_time_spent || 0

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = () => {
    if (isCompleted) {
      return <CheckCircle className="h-4 w-4 text-green-600" />
    } else if (hasProgress) {
      return <PlayCircle className="h-4 w-4 text-blue-600" />
    } else {
      return <BookOpen className="h-4 w-4 text-gray-400" />
    }
  }

  const renderModuleIcon = () => {
    if (module.icon_key) {
      return (
        <HealthIconImg
          iconKey={module.icon_key}
          size={20}
          className="text-gray-600"
          alt={`${module.title} icon`}
        />
      )
    }
    return <BookOpen className="h-5 w-5 text-gray-400" />
  }

  const getStatusText = () => {
    if (isCompleted) return 'Completed'
    if (hasProgress) return 'In Progress'
    return 'Available'
  }

  const getStatusColor = () => {
    if (isCompleted) return 'bg-green-100 text-green-800'
    if (hasProgress) return 'bg-blue-100 text-blue-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (variant === 'compact') {
    return (
      <div 
        className={`flex items-center p-3 bg-white rounded-lg border hover:shadow-md transition-shadow cursor-pointer ${className}`}
        onClick={onClick}
      >
        <div className="flex-shrink-0 mr-3 flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            {renderModuleIcon()}
          </div>
          {getStatusIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {module.title}
          </h4>
          <div className="flex items-center mt-1 text-xs text-gray-500">
            <Clock className="h-3 w-3 mr-1" />
            <span>{module.estimated_duration_minutes} min</span>
            {showCategory && module.category && (
              <>
                <span className="mx-2">•</span>
                <span>{module.category.name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex-shrink-0">
          <Badge variant="secondary" className={getDifficultyColor(module.difficulty_level)}>
            {module.difficulty_level}
          </Badge>
        </div>
      </div>
    )
  }

  return (
    <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${className}`} onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
              {renderModuleIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                {module.title}
              </h3>
              {module.description && (
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                  {module.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex-shrink-0 ml-3">
            {getStatusIcon()}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className={getDifficultyColor(module.difficulty_level)}>
            {module.difficulty_level}
          </Badge>
          
          <Badge variant="outline" className={getStatusColor()}>
            {getStatusText()}
          </Badge>

          {showCategory && module.category && (
            <Badge 
              variant="outline" 
              style={{ 
                backgroundColor: module.category.color ? `${module.category.color}10` : undefined,
                borderColor: module.category.color || undefined,
                color: module.category.color || undefined
              }}
            >
              {module.category.name}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            <span>{module.estimated_duration_minutes} min</span>
          </div>
          
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            <span>{module.view_count} views</span>
          </div>

          {module.average_rating && (
            <div className="flex items-center">
              <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
              <span>{module.average_rating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {showProgress && module.user_progress && (
          <div className="space-y-2">
            {hasProgress && (
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{isCompleted ? '100%' : 'In Progress'}</span>
                </div>
                <Progress 
                  value={isCompleted ? 100 : 50} 
                  className="h-2"
                />
              </div>
            )}

            {bestScore !== null && bestScore !== undefined && bestScore > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Best Score:</span>
                <span className="font-medium text-gray-900">{bestScore}%</span>
              </div>
            )}

            {totalTimeSpent > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Time Spent:</span>
                <span className="font-medium text-gray-900">{totalTimeSpent} min</span>
              </div>
            )}
          </div>
        )}

        {module.learning_objectives && module.learning_objectives.length > 0 && variant === 'detailed' && (
          <div className="mt-3">
            <h4 className="text-xs font-medium text-gray-700 mb-2">Learning Objectives:</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              {module.learning_objectives.slice(0, 3).map((objective, index) => (
                <li key={index} className="flex items-start">
                  <span className="inline-block w-1 h-1 bg-gray-400 rounded-full mt-2 mr-2 flex-shrink-0" />
                  <span className="line-clamp-1">{objective}</span>
                </li>
              ))}
              {module.learning_objectives.length > 3 && (
                <li className="text-gray-400">
                  +{module.learning_objectives.length - 3} more...
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center text-xs text-gray-500">
            {module.child_modules && module.child_modules.length > 0 && (
              <span>{module.child_modules.length} modules</span>
            )}
            {module.content_type !== 'text' && (
              <>
                {module.child_modules && module.child_modules.length > 0 && (
                  <span className="mx-2">•</span>
                )}
                <span className="capitalize">{module.content_type}</span>
              </>
            )}
          </div>

          <Button
            size="sm"
            variant={isCompleted ? "outline" : "default"}
            className="ml-auto"
          >
            {isCompleted ? 'Review' : hasProgress ? 'Continue' : 'Start'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
