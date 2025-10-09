'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface BaseErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void; goHome?: () => void; goBack?: () => void }>
  level?: 'page' | 'feature' | 'component'
  context?: string
  showHomeButton?: boolean
  showBackButton?: boolean
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export class BaseErrorBoundary extends React.Component<BaseErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: BaseErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`ErrorBoundary (${this.props.level || 'unknown'}) caught an error:`, error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Don't call setState here to avoid infinite loops
    // The error state is already set in getDerivedStateFromError
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  goHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
  }

  goBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back()
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return (
          <FallbackComponent 
            error={this.state.error!} 
            retry={this.retry}
            goHome={this.props.showHomeButton ? this.goHome : undefined}
            goBack={this.props.showBackButton ? this.goBack : undefined}
          />
        )
      }

      const { level = 'component', context, showHomeButton, showBackButton } = this.props
      const isPageLevel = level === 'page'
      const isFeatureLevel = level === 'feature'

      return (
        <div className="flex items-center justify-center min-h-[200px] p-6">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-red-500 mb-2">
              <AlertTriangle className="h-8 w-8 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Something went wrong
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isPageLevel ? 'Please try refreshing the page' : 'This component failed to load'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={this.retry}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              {showHomeButton && (
                <Button
                  onClick={this.goHome}
                  variant="outline"
                  size="sm"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { captureError, resetError }
}
