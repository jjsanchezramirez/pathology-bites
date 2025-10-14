'use client'

import { useState } from "react"
import Image from "next/image"
import { useImageCacheHandler } from '@/shared/hooks/use-smart-image-cache'
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMobile } from "@/shared/hooks/use-mobile"

interface ImageProps {
  url: string
  alt: string
  caption?: string
}

interface SimpleImageCarouselProps {
  images: ImageProps[]
  className?: string
}

export function SimpleImageCarousel({ images, className = '' }: SimpleImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const isMobile = useMobile()
  
  // Get the current image for hook usage
  const currentImage = images && images.length > 0 ? images[currentIndex] : null
  const handleImageLoad = useImageCacheHandler(currentImage?.url || '')

  const hasMultiple = images && images.length > 1

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1))
  }

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1))
  }

  if (!images || images.length === 0) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative rounded-lg overflow-hidden bg-muted" style={{ aspectRatio: '16/10' }}>
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            No image available
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main image */}
      <div
        className="relative rounded-lg overflow-hidden bg-muted group"
        style={{ aspectRatio: '16/10' }}
      >
        {currentImage?.url ? (
          <Image
            src={currentImage.url}
            alt={currentImage.alt}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized={true}
            onLoad={handleImageLoad}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            No image available
          </div>
        )}

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <div
              className={`absolute left-2 top-1/2 -translate-y-1/2 bg-black/20 backdrop-blur-sm rounded-full transition-all duration-200 ${
                isMobile
                  ? 'opacity-70' // Always visible on mobile
                  : 'opacity-0 group-hover:opacity-100' // Original behavior on desktop
              }`}
            >
              <button
                onClick={goToPrevious}
                className="p-2 text-white hover:text-white/80 transition-colors"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <div
              className={`absolute right-2 top-1/2 -translate-y-1/2 bg-black/20 backdrop-blur-sm rounded-full transition-all duration-200 ${
                isMobile
                  ? 'opacity-70' // Always visible on mobile
                  : 'opacity-0 group-hover:opacity-100' // Original behavior on desktop
              }`}
            >
              <button
                onClick={goToNext}
                className="p-2 text-white hover:text-white/80 transition-colors"
                aria-label="Next image"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Image indicators */}
      {hasMultiple && (
        <div className="flex justify-center mt-2 gap-1">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all duration-200 ${
                index === currentIndex
                  ? 'bg-primary'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Caption */}
      {currentImage?.caption && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          {currentImage.caption}
        </div>
      )}

      {/* Image counter */}
      {hasMultiple && (
        <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  )
}
