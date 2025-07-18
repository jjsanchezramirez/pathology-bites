// src/shared/components/performance/optimized-image.tsx
'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/shared/utils'

interface OptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  fill?: boolean
  sizes?: string
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  onLoad?: () => void
  onError?: () => void
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  fill = false,
  sizes,
  quality = 85,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
    onLoad?.()
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
    onError?.()
  }

  // Generate blur placeholder for better UX
  const generateBlurDataURL = (w: number, h: number) => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#f3f4f6'
      ctx.fillRect(0, 0, w, h)
    }
    return canvas.toDataURL()
  }

  if (hasError) {
    return (
      <div 
        className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-400',
          className
        )}
        style={{ width, height }}
      >
        <span className="text-sm">Image not available</span>
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && (
        <div 
          className="absolute inset-0 bg-gray-100 animate-pulse"
          style={{ width, height }}
        />
      )}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        quality={quality}
        sizes={sizes || (fill ? '100vw' : undefined)}
        placeholder={placeholder}
        blurDataURL={blurDataURL || (width && height ? generateBlurDataURL(width, height) : undefined)}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          fill ? 'object-cover' : ''
        )}
      />
    </div>
  )
}

// Specialized components for common use cases
interface PathologyImageProps extends Omit<OptimizedImageProps, 'sizes'> {
  variant?: 'thumbnail' | 'medium' | 'large' | 'hero'
}

export function PathologyImage({ 
  variant = 'medium', 
  ...props 
}: PathologyImageProps) {
  const sizeConfig = {
    thumbnail: {
      sizes: '(max-width: 768px) 100px, 150px',
      quality: 75,
      priority: false,
    },
    medium: {
      sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
      quality: 85,
      priority: false,
    },
    large: {
      sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw',
      quality: 90,
      priority: false,
    },
    hero: {
      sizes: '100vw',
      quality: 95,
      priority: true,
    },
  }

  const config = sizeConfig[variant]

  return (
    <OptimizedImage
      {...props}
      sizes={config.sizes}
      quality={config.quality}
      priority={config.priority || props.priority}
    />
  )
}

// Lazy loading wrapper for images below the fold
interface LazyImageProps extends OptimizedImageProps {
  threshold?: number
}

export function LazyImage({ 
  threshold = 0.1, 
  ...props 
}: LazyImageProps) {
  const [isInView, setIsInView] = useState(false)

  // Use Intersection Observer for lazy loading
  const handleIntersection = (entries: IntersectionObserverEntry[]) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setIsInView(true)
      }
    })
  }

  // This would need to be implemented with useEffect and IntersectionObserver
  // For now, we'll just render the image with lazy loading
  return (
    <OptimizedImage
      {...props}
      priority={false}
      placeholder="blur"
    />
  )
}
