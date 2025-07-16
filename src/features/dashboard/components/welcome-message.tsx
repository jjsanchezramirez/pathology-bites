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

  return (
    <Card className="relative bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
      <CardContent className="p-6">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-4 right-4 h-8 w-8 p-0 hover:bg-blue-100"
          onClick={handleDismiss}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="pr-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Welcome to Pathology Bites!
              </h2>
              <p className="text-sm text-gray-600">
                Your journey to pathology mastery starts here
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <p className="text-gray-700">
              Get ready to master pathology with our comprehensive question bank. 
              Track your progress, identify areas for improvement, and build confidence 
              for your exams.
            </p>

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">Smart Practice</h4>
                  <p className="text-sm text-gray-600">
                    Focus on questions that need review
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">Track Progress</h4>
                  <p className="text-sm text-gray-600">
                    Monitor your improvement over time
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-gray-900">Learn Deeply</h4>
                  <p className="text-sm text-gray-600">
                    Detailed explanations for every question
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link href="/dashboard/quiz/new" className="flex-1">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Start Your First Quiz
                </Button>
              </Link>
              
              <Button 
                variant="outline" 
                className="flex-1 border-blue-200 hover:bg-blue-50"
                onClick={handleDismiss}
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : 'Explore Dashboard'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
