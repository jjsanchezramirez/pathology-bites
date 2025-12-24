'use client'

import { Button } from '@/shared/components/ui/button'
import { BookOpen, WifiOff } from 'lucide-react'

interface StartQuizButtonProps {
  creating: boolean
  isOnline: boolean
  isValid: boolean
  validationError: string | null
  onClick: () => void
}

export function StartQuizButton({
  creating,
  isOnline,
  isValid,
  validationError,
  onClick
}: StartQuizButtonProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-center">
        <Button
          onClick={onClick}
          size="lg"
          className="w-full h-16 text-lg font-semibold"
          disabled={creating || !isValid}
        >
          {creating ? (
            <>
              <div className="h-5 w-5 mr-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Creating...
            </>
          ) : !isOnline ? (
            <>
              <WifiOff className="h-5 w-5 mr-3" />
              No Connection
            </>
          ) : (
            <>
              <BookOpen className="h-5 w-5 mr-3" />
              Start Quiz
            </>
          )}
        </Button>
      </div>

      {/* Show helpful message when button is disabled */}
      {!creating && !isValid && validationError && (
        <p className="text-sm text-muted-foreground text-center">
          {validationError}
        </p>
      )}
    </div>
  )
}

