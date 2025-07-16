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
    <Card className="relative border-l-4 border-l-green-500 bg-green-50/50">
      <CardContent className="p-4">
        {/* Close Button */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-green-100"
          onClick={handleDismiss}
          disabled={isLoading}
        >
          <X className="h-3 w-3" />
        </Button>

        <div className="pr-6">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen className="h-4 w-4 text-green-600" />
            <h3 className="font-medium text-gray-900">Welcome to Pathology Bites!</h3>
          </div>

          <p className="text-sm text-gray-600 mb-3">
            Start practicing with our comprehensive question bank to master pathology concepts.
          </p>

          <div className="flex gap-2">
            <Link href="/dashboard/quiz/new">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-xs">
                Start Quiz
              </Button>
            </Link>

            <Button
              variant="outline"
              size="sm"
              className="text-xs border-green-200 hover:bg-green-50"
              onClick={handleDismiss}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Dismiss'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
