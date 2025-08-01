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
    
    this.setState({
      error,
      errorInfo
    })
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
        <Card className={`border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 ${isPageLevel ? 'min-h-[400px]' : ''}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900 dark:text-red-100">
              <AlertTriangle className="h-5 w-5" />
              {isPageLevel ? 'Page Error' : isFeatureLevel ? 'Feature Error' : 'Component Error'}
              {context && ` - ${context}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-red-700 dark:text-red-300">
              <p className="font-medium mb-2">
                {isPageLevel 
                  ? 'This page encountered an error and cannot be displayed.'
                  : isFeatureLevel
                  ? 'This feature encountered an error and cannot be loaded.'
                  : 'This component encountered an error.'
                }
              </p>
              <div className="bg-red-100 dark:bg-red-900 p-3 rounded text-xs">
                <strong>Error:</strong> {this.state.error?.message || 'Unknown error occurred'}
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error?.stack && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-medium">Stack Trace (Development)</summary>
                  <pre className="bg-red-100 dark:bg-red-900 p-3 rounded text-xs overflow-auto mt-2 max-h-40">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={this.retry}
                variant="outline"
                size="sm"
                className="text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              {showBackButton && (
                <Button
                  onClick={this.goBack}
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Back
                </Button>
              )}
              {showHomeButton && (
                <Button
                  onClick={this.goHome}
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-300 hover:bg-red-100 dark:text-red-300 dark:border-red-700 dark:hover:bg-red-900"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
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
