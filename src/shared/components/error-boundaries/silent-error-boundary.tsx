'use client'

import React from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { RefreshCw, AlertCircle } from 'lucide-react'

interface SilentErrorBoundaryState {
  hasError: boolean
  error?: Error
  retryCount: number
  lastErrorTime: number
}

interface SilentErrorBoundaryProps {
  children: React.ReactNode
  maxRetries?: number
  retryDelay?: number
  fallbackMessage?: string
  showErrorDetails?: boolean
  onError?: (error: Error, retryCount: number) => void
  onMaxRetriesReached?: (error: Error) => void
}

export class SilentErrorBoundary extends React.Component<SilentErrorBoundaryProps, SilentErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout

  constructor(props: SilentErrorBoundaryProps) {
    super(props)
    this.state = { 
      hasError: false, 
      retryCount: 0,
      lastErrorTime: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<SilentErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now()
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { maxRetries = 2, retryDelay = 1000, onError, onMaxRetriesReached } = this.props
    const { retryCount } = this.state

    console.warn(`SilentErrorBoundary caught error (attempt ${retryCount + 1}):`, error.message)
    
    // Call custom error handler
    onError?.(error, retryCount)

    // Auto-retry if under the limit
    if (retryCount < maxRetries) {
      this.retryTimeout = setTimeout(() => {
        this.setState(prevState => ({
          hasError: false,
          error: undefined,
          retryCount: prevState.retryCount + 1
        }))
      }, retryDelay)
    } else {
      // Max retries reached
      onMaxRetriesReached?.(error)
    }

    this.setState({
      error,
      retryCount: retryCount + 1
    })
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  manualRetry = () => {
    this.setState({ 
      hasError: false, 
      error: undefined,
      retryCount: 0
    })
  }

  render() {
    if (this.state.hasError) {
      const { 
        maxRetries = 2, 
        fallbackMessage = "Something went wrong", 
        showErrorDetails = false 
      } = this.props
      const { retryCount, error } = this.state

      // If we're still under max retries, show a minimal loading state
      if (retryCount <= maxRetries) {
        return (
          <div className="flex items-center justify-center p-4 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">Retrying...</span>
          </div>
        )
      }

      // Max retries reached - show user-friendly error
      return (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {fallbackMessage}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    This component couldn't load properly. You can try refreshing or continue using the rest of the page.
                  </p>
                </div>
                
                {showErrorDetails && error && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100">
                      Error details
                    </summary>
                    <div className="mt-2 p-2 bg-amber-100 dark:bg-amber-900 rounded text-amber-800 dark:text-amber-200">
                      {error.message}
                    </div>
                  </details>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={this.manualRetry}
                    variant="outline"
                    size="sm"
                    className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900"
                  >
                    <RefreshCw className="mr-2 h-3 w-3" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components with silent retry
export function useSilentErrorBoundary(maxRetries: number = 2) {
  const [error, setError] = React.useState<Error | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)

  const resetError = React.useCallback(() => {
    setError(null)
    setRetryCount(0)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    if (retryCount < maxRetries) {
      // Auto-retry
      setTimeout(() => {
        setRetryCount(prev => prev + 1)
        setError(null)
      }, 1000)
    } else {
      setError(error)
    }
  }, [retryCount, maxRetries])

  React.useEffect(() => {
    if (error && retryCount >= maxRetries) {
      throw error
    }
  }, [error, retryCount, maxRetries])

  return { captureError, resetError, isRetrying: retryCount > 0 && retryCount < maxRetries }
}
