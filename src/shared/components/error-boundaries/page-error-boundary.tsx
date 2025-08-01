'use client'

import React from 'react'
import { BaseErrorBoundary } from './base-error-boundary'

interface PageErrorBoundaryProps {
  children: React.ReactNode
  pageName?: string
  showHomeButton?: boolean
  showBackButton?: boolean
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function PageErrorBoundary({ 
  children, 
  pageName, 
  showHomeButton = true, 
  showBackButton = true,
  onError 
}: PageErrorBoundaryProps) {
  return (
    <BaseErrorBoundary
      level="page"
      context={pageName}
      showHomeButton={showHomeButton}
      showBackButton={showBackButton}
      onError={onError}
    >
      {children}
    </BaseErrorBoundary>
  )
}
