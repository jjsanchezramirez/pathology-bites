'use client'

import React from 'react'
import { BaseErrorBoundary } from './base-error-boundary'

interface FeatureErrorBoundaryProps {
  children: React.ReactNode
  featureName?: string
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

export function FeatureErrorBoundary({ 
  children, 
  featureName,
  onError 
}: FeatureErrorBoundaryProps) {
  return (
    <BaseErrorBoundary
      level="feature"
      context={featureName}
      showHomeButton={false}
      showBackButton={false}
      onError={onError}
    >
      {children}
    </BaseErrorBoundary>
  )
}
