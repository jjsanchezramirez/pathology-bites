// src/features/learning-modules/components/module-content-viewer.tsx

'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { Clock, BookOpen, Star, CheckCircle, PlayCircle, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'
import { LearningModule } from '../types/learning-modules'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { Separator } from '@/shared/components/ui/separator'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'

interface ModuleContentViewerProps {
  module: LearningModule
  onComplete?: (data: {
    self_rating?: number
    confidence_level?: number
    feedback?: string
    found_helpful?: boolean
  }) => void
  onNext?: () => void
  onPrevious?: () => void
  showNavigation?: boolean
  isCompleted?: boolean
  className?: string
}

export function ModuleContentViewer({
  module,
  onComplete,
  onNext,
  onPrevious,
  showNavigation = false,
  isCompleted = false,
  className = ''
}: ModuleContentViewerProps) {
  const [showCompletionForm, setShowCompletionForm] = useState(false)
  const [selfRating, setSelfRating] = useState<number>()
  const [confidenceLevel, setConfidenceLevel] = useState<number>()
  const [feedback, setFeedback] = useState('')
  const [foundHelpful, setFoundHelpful] = useState<boolean>()
  const [readingProgress, setReadingProgress] = useState(0)

  // Track reading progress
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrollPercent = (scrollTop / docHeight) * 100
      setReadingProgress(Math.min(scrollPercent, 100))
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleComplete = () => {
    if (isCompleted) {
      onNext?.()
      return
    }

    if (showCompletionForm) {
      onComplete?.({
        self_rating: selfRating,
        confidence_level: confidenceLevel,
        feedback: feedback.trim() || undefined,
        found_helpful: foundHelpful
      })
    } else {
      setShowCompletionForm(true)
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800'
      case 'intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const renderContent = (content: string) => {
    // Simple markdown-like rendering
    return content
      .split('\n')
      .map((line, index) => {
        if (line.startsWith('# ')) {
          return <h1 key={index} className="text-3xl font-bold text-gray-900 mt-8 mb-4">{line.slice(2)}</h1>
        } else if (line.startsWith('## ')) {
          return <h2 key={index} className="text-2xl font-semibold text-gray-900 mt-6 mb-3">{line.slice(3)}</h2>
        } else if (line.startsWith('### ')) {
          return <h3 key={index} className="text-xl font-semibold text-gray-900 mt-4 mb-2">{line.slice(4)}</h3>
        } else if (line.startsWith('- ')) {
          return <li key={index} className="ml-4 text-gray-700">{line.slice(2)}</li>
        } else if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={index} className="font-semibold text-gray-900 mt-2">{line.slice(2, -2)}</p>
        } else if (line.trim() === '') {
          return <br key={index} />
        } else {
          return <p key={index} className="text-gray-700 leading-relaxed mt-2">{line}</p>
        }
      })
  }

  return (
    <div className={`max-w-4xl mx-auto ${className}`}>
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Progress value={readingProgress} className="h-1 rounded-none" />
      </div>

      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {module.title}
              </h1>
              {module.description && (
                <p className="text-gray-600 mb-4">
                  {module.description}
                </p>
              )}
              
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="secondary" className={getDifficultyColor(module.difficulty_level)}>
                  {module.difficulty_level}
                </Badge>
                
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{module.estimated_duration_minutes} min</span>
                </div>

                <div className="flex items-center text-sm text-gray-500">
                  <BookOpen className="h-4 w-4 mr-1" />
                  <span className="capitalize">{module.content_type}</span>
                </div>

                {module.average_rating && (
                  <div className="flex items-center text-sm text-gray-500">
                    <Star className="h-4 w-4 mr-1 fill-yellow-400 text-yellow-400" />
                    <span>{module.average_rating.toFixed(1)}</span>
                  </div>
                )}

                {isCompleted && (
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Completed
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {module.learning_objectives && module.learning_objectives.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Learning Objectives</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                {module.learning_objectives.map((objective, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="h-3 w-3 text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Content */}
      <Card className="mb-6">
        <CardContent className="p-6">
          {module.content ? (
            <div className="prose prose-gray max-w-none">
              {renderContent(module.content)}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>Content is being prepared for this module.</p>
            </div>
          )}

          {/* Images */}
          {module.images && module.images.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Visual Resources</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {module.images
                  .filter(img => img.usage_type === 'content' || img.usage_type === 'diagram')
                  .map((moduleImage, index) => (
                    <div key={index} className="space-y-2">
                      {moduleImage.image && (
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                          <Image
                            src={moduleImage.image.url}
                            alt={moduleImage.alt_text || moduleImage.image.alt_text || ''}
                            fill
                            className="object-contain"
                            unoptimized={true}
                          />
                        </div>
                      )}
                      {moduleImage.caption && (
                        <p className="text-sm text-gray-600 text-center">
                          {moduleImage.caption}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* External content */}
          {module.external_content_url && (
            <div className="mt-8 p-4 border rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">External Resource</h3>
              <p className="text-gray-600 mb-3">
                This module includes additional content from an external source.
              </p>
              <Button variant="outline" asChild>
                <a 
                  href={module.external_content_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View External Content
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completion Form */}
      {showCompletionForm && !isCompleted && (
        <Card className="mb-6">
          <CardHeader>
            <h3 className="text-lg font-semibold text-gray-900">Module Feedback</h3>
            <p className="text-sm text-gray-600">
              Help us improve by sharing your experience with this module.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm font-medium">How would you rate your understanding? *</Label>
              <RadioGroup 
                value={selfRating?.toString()} 
                onValueChange={(value) => setSelfRating(parseInt(value))}
                className="flex gap-4 mt-2"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <div key={rating} className="flex items-center space-x-2">
                    <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} />
                    <Label htmlFor={`rating-${rating}`} className="text-sm">{rating}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium">How confident do you feel about this topic? *</Label>
              <RadioGroup 
                value={confidenceLevel?.toString()} 
                onValueChange={(value) => setConfidenceLevel(parseInt(value))}
                className="flex gap-4 mt-2"
              >
                {[1, 2, 3, 4, 5].map((level) => (
                  <div key={level} className="flex items-center space-x-2">
                    <RadioGroupItem value={level.toString()} id={`confidence-${level}`} />
                    <Label htmlFor={`confidence-${level}`} className="text-sm">{level}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium">Was this module helpful?</Label>
              <RadioGroup 
                value={foundHelpful?.toString()} 
                onValueChange={(value) => setFoundHelpful(value === 'true')}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="true" id="helpful-yes" />
                  <Label htmlFor="helpful-yes" className="text-sm">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="false" id="helpful-no" />
                  <Label htmlFor="helpful-no" className="text-sm">No</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="feedback" className="text-sm font-medium">
                Additional feedback (optional)
              </Label>
              <Textarea
                id="feedback"
                placeholder="Share any thoughts, suggestions, or questions..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {showNavigation && (
          <Button variant="outline" onClick={onPrevious} disabled={!onPrevious}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
        )}

        <div className="flex gap-3 ml-auto">
          <Button
            onClick={handleComplete}
            disabled={showCompletionForm && (!selfRating || !confidenceLevel)}
            className="min-w-[120px]"
          >
            {isCompleted ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Review Complete
              </>
            ) : showCompletionForm ? (
              'Complete Module'
            ) : (
              'Mark Complete'
            )}
          </Button>

          {showNavigation && onNext && (
            <Button onClick={onNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
