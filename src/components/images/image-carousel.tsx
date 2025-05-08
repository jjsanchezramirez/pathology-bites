// src/components/images/image-carousel.tsx
'use client'

import { useState, useRef, useEffect } from "react"
import { ChevronLeft, ChevronRight, Maximize } from "lucide-react"
import Image from "next/image"

interface ImageProps {
  url: string
  alt: string
  caption?: string
}

interface ImageCarouselProps {
  images: ImageProps[]
  className?: string
  fillContainer?: boolean
}

export function ImageCarousel({ 
  images, 
  className = '', 
  fillContainer = true 
}: ImageCarouselProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const currentImage = images[currentImageIndex]
  
  // Handle image loading state
  useEffect(() => {
    setIsLoading(true)
    
    // Use window.Image instead of Image to avoid the naming conflict
    const img = new window.Image()
    img.src = currentImage.url
    img.onload = () => setIsLoading(false)
    img.onerror = () => setIsLoading(false)
    
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [currentImage])
  
  // Handle fullscreen mode
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isFullscreen])
  
  const canNavigate = images.length > 1
  
  const handlePrev = () => {
    if (canNavigate) {
      setCurrentImageIndex(prev => 
        prev === 0 ? images.length - 1 : prev - 1
      )
    }
  }
  
  const handleNext = () => {
    if (canNavigate) {
      setCurrentImageIndex(prev => 
        prev === images.length - 1 ? 0 : prev + 1
      )
    }
  }
  
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }
  
  return (
    <div className={`relative w-full rounded-lg overflow-hidden ${className}`}>
      {/* Main image container */}
      <div 
        ref={containerRef}
        className={`relative rounded-lg overflow-hidden bg-muted ${isLoading ? 'animate-pulse' : ''}`}
        style={fillContainer ? { aspectRatio: '16/9' } : undefined}
      >
        <Image
          key={currentImage.url}
          src={currentImage.url}
          alt={currentImage.alt || "Pathology image"}
          fill={true}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className={`${fillContainer ? 'object-cover' : 'object-contain'} 
            transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
        />
        
        {/* Controls overlay */}
        <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity">
          {/* Navigation buttons */}
          {canNavigate && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-md text-foreground"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-md text-foreground"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
          
          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-md text-foreground"
            aria-label="Toggle fullscreen"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Image indicator pills */}
      {canNavigate && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentImageIndex
                  ? 'bg-primary w-4'
                  : 'bg-primary/30'
              }`}
              aria-label={`View image ${index + 1}`}
            />
          ))}
        </div>
      )}
      
      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-background/90 flex items-center justify-center p-4" onClick={toggleFullscreen}>
          <div className="relative max-w-5xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <div className="relative w-full h-full">
              <Image
                src={currentImage.url}
                alt={currentImage.alt || "Pathology image fullscreen view"}
                fill={true}
                sizes="100vw"
                className="object-contain"
                priority={true} // Load fullscreen image with higher priority
              />
            </div>
            <button
              onClick={toggleFullscreen}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow-md"
              aria-label="Exit fullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            
            {canNavigate && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 flex items-center justify-center shadow-md"
                  aria-label="Previous image in fullscreen"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 flex items-center justify-center shadow-md"
                  aria-label="Next image in fullscreen"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}