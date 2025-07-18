// src/shared/components/performance/lazy-component.tsx
'use client'

import { useEffect, useState, Suspense } from 'react'
import { cn } from '@/shared/utils'

interface LazyComponentProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  threshold?: number
  rootMargin?: string
  className?: string
  id?: string
  onVisible?: () => void
}

export function LazyComponent({
  children,
  fallback,
  threshold = 0.1,
  rootMargin = '200px',
  className,
  id,
  onVisible,
}: LazyComponentProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [hasBeenVisible, setHasBeenVisible] = useState(false)

  useEffect(() => {
    // Skip if already visible
    if (hasBeenVisible) return

    // Create ref for the element
    const element = id ? document.getElementById(id) : null
    if (!element && !id) return

    // Create intersection observer
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            setHasBeenVisible(true)
            onVisible?.()
            observer.disconnect()
          }
        })
      },
      {
        threshold,
        rootMargin,
      }
    )

    // Observe element
    if (element) {
      observer.observe(element)
    }

    // Cleanup
    return () => {
      observer.disconnect()
    }
  }, [hasBeenVisible, id, onVisible, rootMargin, threshold])

  // If no ID is provided, render immediately
  if (!id) {
    return <>{children}</>
  }

  return (
    <div id={id} className={cn(className)}>
      {hasBeenVisible ? (
        <Suspense fallback={fallback || <div className="min-h-[100px] animate-pulse bg-gray-100 rounded-md" />}>
          {children}
        </Suspense>
      ) : (
        fallback || <div className="min-h-[100px] animate-pulse bg-gray-100 rounded-md" />
      )}
    </div>
  )
}

// Specialized components for common use cases
interface LazyContentProps extends Omit<LazyComponentProps, 'fallback'> {
  height?: number | string
  width?: number | string
}

export function LazyContent({
  height = 200,
  width = '100%',
  ...props
}: LazyContentProps) {
  const fallback = (
    <div 
      className="animate-pulse bg-gray-100 rounded-md" 
      style={{ 
        height: typeof height === 'number' ? `${height}px` : height,
        width: typeof width === 'number' ? `${width}px` : width,
      }}
    />
  )

  return <LazyComponent {...props} fallback={fallback} />
}

// Specialized component for lazy loading sections
interface LazySectionProps extends Omit<LazyComponentProps, 'fallback'> {
  title?: string
  subtitle?: string
}

export function LazySection({
  title,
  subtitle,
  ...props
}: LazySectionProps) {
  const fallback = (
    <div className="space-y-4 w-full">
      {title && (
        <div className="h-8 w-1/3 bg-gray-100 animate-pulse rounded-md" />
      )}
      {subtitle && (
        <div className="h-6 w-2/3 bg-gray-100 animate-pulse rounded-md" />
      )}
      <div className="space-y-2">
        <div className="h-4 w-full bg-gray-100 animate-pulse rounded-md" />
        <div className="h-4 w-5/6 bg-gray-100 animate-pulse rounded-md" />
        <div className="h-4 w-4/6 bg-gray-100 animate-pulse rounded-md" />
      </div>
    </div>
  )

  return <LazyComponent {...props} fallback={fallback} />
}
