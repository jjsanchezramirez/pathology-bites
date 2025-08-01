'use client'

import React from 'react'
import { BaseErrorBoundary } from './base-error-boundary'

interface ComponentErrorBoundaryProps {
  children: React.ReactNode
  componentName?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function ComponentErrorBoundary({ 
  children, 
  componentName,
  onError 
}: ComponentErrorBoundaryProps) {
  return (
    <BaseErrorBoundary
      level="component"
      context={componentName}
      showHomeButton={false}
      showBackButton={false}
      onError={onError}
    >
      {children}
    </BaseErrorBoundary>
  )
}
