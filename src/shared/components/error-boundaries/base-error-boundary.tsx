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
        <Card className={`border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 ${isPageLevel ? 'min-h-[400px]' : ''}`}>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100 text-lg">
              <AlertTriangle className="h-5 w-5" />
              {isPageLevel ? 'Oops! Something went wrong' : isFeatureLevel ? 'Feature temporarily unavailable' : 'Component error'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-amber-700 dark:text-amber-300">
              <p className="mb-3">
                {isPageLevel
                  ? 'We encountered an unexpected error while loading this page. This is usually temporary.'
                  : isFeatureLevel
                  ? 'This feature is temporarily unavailable. You can continue using other parts of the application.'
                  : 'This component couldn\'t load properly, but the rest of the page should work fine.'
                }
              </p>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-3">
                  <summary className="cursor-pointer font-medium text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100">
                    Technical details (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-amber-100 dark:bg-amber-900 rounded text-xs">
                    <div className="font-medium mb-1">Error:</div>
                    <div className="mb-2">{this.state.error?.message || 'Unknown error occurred'}</div>
                    {this.state.error?.stack && (
                      <>
                        <div className="font-medium mb-1">Stack Trace:</div>
                        <pre className="overflow-auto max-h-32 text-xs">{this.state.error.stack}</pre>
                      </>
                    )}
                  </div>
                </details>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={this.retry}
                variant="outline"
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              {showBackButton && (
                <Button
                  onClick={this.goBack}
                  variant="outline"
                  size="sm"
                  className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900"
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
                  className="text-amber-700 border-amber-300 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:hover:bg-amber-900"
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
