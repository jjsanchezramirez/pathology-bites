// src/features/dashboard/components/welcome-message.tsx
'use client'

import { useState } from 'react'
import { X, Microscope, BookOpen } from 'lucide-react'
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
    <Card className="relative bg-card border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              🎓 Welcome to Pathology Bites!
            </h3>

            <div className="text-sm text-muted-foreground space-y-2 mb-4">
              <p>
                We're thrilled to have you join our pathology learning community! 🎉
              </p>

              <p>
                <strong>Explore our learning tools:</strong>
              </p>

              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <strong>WSI Questions:</strong> Test yourself with whole slide image-based questions to practice real-world pathology analysis
                </li>
                <li>
                  <strong>Anki Deck:</strong> Learn something new with our comprehensive online Anki deck for spaced repetition learning
                </li>
              </ul>

              <p>
                Both tools are available now and ready to help you master pathology at your own pace.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard/wsi-questions" className="flex-1">
                <Button
                  size="lg"
                  className="w-full bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
                >
                  <Microscope className="h-4 w-4" />
                  Try WSI Questions
                </Button>
              </Link>
              <Link href="/dashboard/anki" className="flex-1">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  View Anki Deck
                </Button>
              </Link>
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
