// src/features/learning-modules/components/learning-path-card.tsx

'use client'

import React from 'react'
import Image from 'next/image'
import { Clock, BookOpen, Star, Users, CheckCircle, PlayCircle, Trophy, Target } from 'lucide-react'
import { LearningPath } from '../types/learning-modules'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { HealthIconImg } from '@/shared/components/ui/health-icon'

interface LearningPathCardProps {
  path: LearningPath
  showProgress?: boolean
  showEnrollment?: boolean
  variant?: 'default' | 'compact' | 'detailed'
  onClick?: () => void
  onEnroll?: () => void
  className?: string
}

export function LearningPathCard({
  path,
  showProgress = false,
  showEnrollment = true,
  variant = 'default',
  onClick,
  onEnroll,
  className = ''
}: LearningPathCardProps) {
  const isEnrolled = !!path.user_enrollment
  const isCompleted = path.user_enrollment?.status === 'completed'
  const isInProgress = path.user_enrollment?.status === 'active' && path.user_enrollment.modules_completed > 0
  const progressPercentage = path.user_enrollment?.progress_percentage || 0
  const moduleCount = path.modules?.length || 0
  const completedModules = path.user_enrollment?.modules_completed || 0

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = () => {
    if (isCompleted) {
      return <Trophy className="h-4 w-4 text-yellow-600" />
    } else if (isInProgress) {
      return <PlayCircle className="h-4 w-4 text-blue-600" />
    } else if (isEnrolled) {
      return <BookOpen className="h-4 w-4 text-green-600" />
    } else {
      return <Target className="h-4 w-4 text-gray-400" />
    }
  }

  const renderPathIcon = () => {
    if (path.icon_key) {
      return (
        <HealthIconImg
          iconKey={path.icon_key}
          size={24}
          className="text-gray-600"
          alt={`${path.title} icon`}
        />
      )
    }
    return <BookOpen className="h-6 w-6 text-gray-400" />
  }

  const getStatusText = () => {
    if (isCompleted) return 'Completed'
    if (isInProgress) return 'In Progress'
    if (isEnrolled) return 'Enrolled'
    return 'Available'
  }

  const getStatusColor = () => {
    if (isCompleted) return 'bg-yellow-100 text-yellow-800'
    if (isInProgress) return 'bg-blue-100 text-blue-800'
    if (isEnrolled) return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-800'
  }

  const getCompletionRate = () => {
    if (path.enrollment_count === 0) return 0
    return Math.round((path.completion_count / path.enrollment_count) * 100)
  }

  if (variant === 'compact') {
    return (
      <div 
        className={`flex items-center p-4 bg-white rounded-lg border hover:shadow-md transition-shadow cursor-pointer ${className}`}
        onClick={onClick}
      >
        <div className="flex-shrink-0 mr-4">
          {path.thumbnail_image ? (
            <Image
              src={path.thumbnail_image.url}
              alt={path.thumbnail_image.alt_text || path.title}
              width={48}
              height={48}
              className="rounded-lg object-cover"
              unoptimized={true}
            />
          ) : (
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
              {renderPathIcon()}
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center mb-1">
            {getStatusIcon()}
            <h4 className="text-sm font-medium text-gray-900 ml-2 truncate">
              {path.title}
            </h4>
          </div>
          
          <div className="flex items-center text-xs text-gray-500">
            <span>{moduleCount} modules</span>
            {path.estimated_total_duration_minutes && (
              <>
                <span className="mx-2">•</span>
                <Clock className="h-3 w-3 mr-1" />
                <span>{Math.round(path.estimated_total_duration_minutes / 60)}h</span>
              </>
            )}
            {path.difficulty_level && (
              <>
                <span className="mx-2">•</span>
                <span className="capitalize">{path.difficulty_level}</span>
              </>
            )}
          </div>

          {showProgress && isEnrolled && (
            <div className="mt-2">
              <Progress value={progressPercentage} className="h-1" />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{completedModules}/{moduleCount} modules</span>
                <span>{progressPercentage}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 ml-4">
          {showEnrollment && !isEnrolled && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); onEnroll?.() }}>
              Enroll
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${className}`} onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="relative w-full h-32 mb-3 rounded-lg overflow-hidden">
          {path.thumbnail_image ? (
            <>
              <Image
                src={path.thumbnail_image.url}
                alt={path.thumbnail_image.alt_text || path.title}
                fill
                className="object-cover"
                unoptimized={true}
              />
              <div className="absolute top-2 right-2">
                {getStatusIcon()}
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <HealthIconImg
                iconKey={path.icon_key || 'default'}
                size={48}
                className="text-gray-400"
                alt={`${path.title} icon`}
              />
              <div className="absolute top-2 right-2">
                {getStatusIcon()}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
              {path.title}
            </h3>
            {path.description && (
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                {path.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {path.difficulty_level && (
            <Badge variant="secondary" className={getDifficultyColor(path.difficulty_level)}>
              {path.difficulty_level}
            </Badge>
          )}
          
          <Badge variant="outline" className={getStatusColor()}>
            {getStatusText()}
          </Badge>

          {path.is_featured && (
            <Badge variant="outline" className="bg-purple-100 text-purple-800">
              Featured
            </Badge>
          )}

          {path.category && (
            <Badge 
              variant="outline" 
              style={{ 
                backgroundColor: path.category.color ? `${path.category.color}10` : undefined,
                borderColor: path.category.color || undefined,
                color: path.category.color || undefined
              }}
            >
              {path.category.name}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 mb-4">
          <div className="flex items-center">
            <BookOpen className="h-4 w-4 mr-2" />
            <span>{moduleCount} modules</span>
          </div>
          
          {path.estimated_total_duration_minutes && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              <span>{Math.round(path.estimated_total_duration_minutes / 60)}h total</span>
            </div>
          )}

          <div className="flex items-center">
            <Users className="h-4 w-4 mr-2" />
            <span>{path.enrollment_count} enrolled</span>
          </div>

          {path.average_rating && (
            <div className="flex items-center">
              <Star className="h-4 w-4 mr-2 fill-yellow-400 text-yellow-400" />
              <span>{path.average_rating.toFixed(1)} rating</span>
            </div>
          )}
        </div>

        {showProgress && isEnrolled && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{completedModules}/{moduleCount} modules ({progressPercentage}%)</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>
        )}

        {path.learning_objectives && path.learning_objectives.length > 0 && variant === 'detailed' && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Learning Objectives:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {path.learning_objectives.slice(0, 3).map((objective, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                  <span className="line-clamp-1">{objective}</span>
                </li>
              ))}
              {path.learning_objectives.length > 3 && (
                <li className="text-gray-400 text-xs ml-5">
                  +{path.learning_objectives.length - 3} more objectives...
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <span>{getCompletionRate()}% completion rate</span>
          {path.target_audience && (
            <>
              <span className="mx-2">•</span>
              <span>For {path.target_audience}</span>
            </>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center text-xs text-gray-500">
            {path.tags && path.tags.length > 0 && (
              <div className="flex gap-1">
                {path.tags.slice(0, 2).map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {path.tags.length > 2 && (
                  <span className="text-gray-400">+{path.tags.length - 2}</span>
                )}
              </div>
            )}
          </div>

          {showEnrollment && (
            <Button
              size="sm"
              variant={isEnrolled ? "outline" : "default"}
              onClick={(e) => {
                e.stopPropagation()
                if (isEnrolled) {
                  onClick?.()
                } else {
                  onEnroll?.()
                }
              }}
            >
              {isCompleted ? 'Review' : isInProgress ? 'Continue' : isEnrolled ? 'View' : 'Enroll'}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
