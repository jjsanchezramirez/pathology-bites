// src/features/auth/components/error-display.tsx
'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown, 
  ChevronUp,
  Shield,
  Wifi,
  Server,
  Clock
} from 'lucide-react'
import { AuthError, AuthErrorType } from '@/features/auth/utils/error-handling'

interface ErrorDisplayProps {
  error: AuthError | null
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
  className?: string
}

export function ErrorDisplay({ 
  error, 
  onRetry, 
  onDismiss, 
  showDetails = false,
  className 
}: ErrorDisplayProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)

  if (!error) return null

  const getIcon = () => {
    switch (error.type) {
      case AuthErrorType.NETWORK_ERROR:
        return <Wifi className="h-4 w-4" />
      case AuthErrorType.SERVER_ERROR:
        return <Server className="h-4 w-4" />
      case AuthErrorType.SESSION_EXPIRED:
        return <Clock className="h-4 w-4" />
      case AuthErrorType.SECURITY_ERROR:
      case AuthErrorType.CSRF_ERROR:
        return <Shield className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getVariant = () => {
    switch (error.severity) {
      case 'high':
        return 'destructive' as const
      case 'medium':
        return 'default' as const
      case 'low':
        return 'default' as const
      default:
        return 'default' as const
    }
  }

  const getRetryDelay = () => {
    switch (error.type) {
      case AuthErrorType.RATE_LIMITED:
        return 'Please wait 30 seconds before retrying'
      case AuthErrorType.NETWORK_ERROR:
        return 'Retrying in a moment...'
      case AuthErrorType.SERVER_ERROR:
        return 'Server may be temporarily unavailable'
      default:
        return null
    }
  }

  return (
    <Alert variant={getVariant()} className={className}>
      {getIcon()}
      <AlertDescription>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">{error.userMessage}</span>
            <div className="flex items-center gap-2">
              {error.retryable && onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  className="h-7"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              )}
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="h-7"
                >
                  Dismiss
                </Button>
              )}
            </div>
          </div>

          {getRetryDelay() && (
            <div className="text-sm text-muted-foreground">
              {getRetryDelay()}
            </div>
          )}

          {showDetails && (
            <div className="mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="h-6 p-0 text-xs"
              >
                {showTechnicalDetails ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Show Details
                  </>
                )}
              </Button>

              {showTechnicalDetails && (
                <div className="mt-2 p-2 bg-muted rounded text-xs font-mono">
                  <div><strong>Type:</strong> {error.type}</div>
                  <div><strong>Severity:</strong> {error.severity}</div>
                  <div><strong>Retryable:</strong> {error.retryable ? 'Yes' : 'No'}</div>
                  {error.technicalDetails && (
                    <div className="mt-1">
                      <strong>Details:</strong>
                      <pre className="mt-1 text-xs overflow-auto">
                        {JSON.stringify(error.technicalDetails, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

// Specialized error displays for common scenarios
export function NetworkErrorDisplay({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorDisplay
      error={{
        type: AuthErrorType.NETWORK_ERROR,
        message: 'Network connection failed',
        retryable: true,
        severity: 'medium',
        userMessage: 'Please check your internet connection and try again.'
      }}
      onRetry={onRetry}
    />
  )
}

export function SessionExpiredDisplay({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorDisplay
      error={{
        type: AuthErrorType.SESSION_EXPIRED,
        message: 'Session expired',
        retryable: true,
        severity: 'medium',
        userMessage: 'Your session has expired. Please log in again.'
      }}
      onRetry={onRetry}
    />
  )
}

export function RateLimitedDisplay({ onRetry }: { onRetry?: () => void }) {
  return (
    <ErrorDisplay
      error={{
        type: AuthErrorType.RATE_LIMITED,
        message: 'Rate limited',
        retryable: true,
        severity: 'low',
        userMessage: 'Too many attempts. Please wait a moment and try again.'
      }}
      onRetry={onRetry}
    />
  )
}

// Hook for managing error display state
export function useErrorDisplay() {
  const [currentError, setCurrentError] = useState<AuthError | null>(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const showError = (error: AuthError) => {
    setCurrentError(error)
  }

  const dismissError = () => {
    setCurrentError(null)
    setIsRetrying(false)
  }

  const retryOperation = async (operation: () => Promise<void>) => {
    if (!currentError?.retryable) return

    setIsRetrying(true)
    try {
      await operation()
      dismissError()
    } catch (error) {
      // Error will be handled by the operation itself
    } finally {
      setIsRetrying(false)
    }
  }

  return {
    currentError,
    isRetrying,
    showError,
    dismissError,
    retryOperation
  }
}
