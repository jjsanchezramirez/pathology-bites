// src/features/dashboard/components/welcome-message.tsx
'use client'

import { useState } from 'react'
import { X, BookOpen, Target, TrendingUp } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { userSettingsService } from '@/shared/services/user-settings'
import Link from 'next/link'

interface WelcomeMessageProps {
  onDismiss: () => void
}

export function WelcomeMessage({ onDismiss }: WelcomeMessageProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false)

  const handleDismiss = async () => {
    setIsLoading(true)
    try {
      await userSettingsService.markWelcomeMessageSeen()
      onDismiss()
    } catch (error) {
      console.error('Error dismissing welcome message:', error)
      // Still dismiss the message locally even if the API call fails
      onDismiss()
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartQuiz = async () => {
    setIsCreatingQuiz(true)
    try {
      // Create a random 20-question quiz
      const quizPayload = {
        title: `Starter Quiz - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        mode: 'practice',
        timing: 'untimed',
        questionCount: 20,
        questionType: 'unused',
        categorySelection: 'all',
        selectedCategories: [],
        shuffleQuestions: true,
        shuffleAnswers: true,
        showProgress: true,
        showExplanations: true
      }

      const response = await fetch('/api/content/quiz/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quizPayload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create quiz')
      }

      const result = await response.json()

      // Mark welcome message as seen
      await userSettingsService.markWelcomeMessageSeen()

      // Redirect to the quiz
      window.location.href = `/dashboard/quiz/${result.data.sessionId}`
    } catch (error) {
      console.error('Error creating starter quiz:', error)
      // Fall back to the quiz creation page
      window.location.href = '/dashboard/quiz/new'
    } finally {
      setIsCreatingQuiz(false)
    }
  }

  return (
    <Card className="relative bg-card border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              📖 Welcome to PathologyBites!
            </h3>

            <div className="text-sm text-muted-foreground space-y-2 mb-4">
              <p>Your dashboard is empty because you're just getting started.</p>

              <p>
                <strong>Take a quick starter quiz</strong> to see how we track your progress. We'll track which questions you master,
                which ones need work, and what you should focus on next.
              </p>

              <p>
                Your percentile ranking and performance stats will update as you go. No pressure - this is all about
                finding your starting point and building from there.
              </p>

              <p className="font-medium">Ready to start?</p>
            </div>

            <div className="flex gap-3">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 w-sm px-16 py-3 flex items-center gap-2"
                onClick={handleStartQuiz}
                disabled={isCreatingQuiz}
              >
                {isCreatingQuiz ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Creating Quiz...
                  </>
                ) : (
                  'Start Quiz'
                )}
              </Button>
            </div>
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-gray-100 flex-shrink-0"
            onClick={handleDismiss}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
