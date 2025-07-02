'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Image {
  url: string
  alt: string
  caption?: string
}

interface SimpleCarouselProps {
  images: Image[]
  className?: string
}

export function SimpleCarousel({ images, className = '' }: SimpleCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  if (!images || images.length === 0) return null

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const goToImage = (index: number) => {
    setCurrentIndex(index)
  }

  const currentImage = images[currentIndex]

  // Keyboard navigation for fullscreen
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setIsOpen(false)
          break
        case 'ArrowLeft':
          if (images.length > 1) prevImage()
          break
        case 'ArrowRight':
          if (images.length > 1) nextImage()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, images.length])

  return (
    <>
      {/* Carousel Container */}
      <div className={`relative bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden shadow-sm border border-gray-200/50 ${className}`}>
        {/* Main Image */}
        <div
          className="relative cursor-pointer group"
          style={{ aspectRatio: '16/10' }}
          onClick={() => setIsOpen(true)}
        >
          <img
            src={currentImage.url}
            alt={currentImage.alt}
            className="w-full h-full object-contain transition-all duration-300 group-hover:scale-[1.02]"
          />

          {/* Hover overlay with zoom indicator */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-all duration-300 flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
              <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Navigation arrows (only show if multiple images) */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevImage}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-white/20"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>

            <button
              onClick={nextImage}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 backdrop-blur-sm border border-white/20"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          </>
        )}

        {/* Dots indicator (only show if multiple images) */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur-sm rounded-full px-3 py-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => goToImage(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  index === currentIndex
                    ? 'bg-white scale-125'
                    : 'bg-white/60 hover:bg-white/80 hover:scale-110'
                }`}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Image counter (only show if multiple images) */}
        {images.length > 1 && (
          <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-full border border-white/20">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Fullscreen modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          {/* Image container - truly fullscreen */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={currentImage.url}
              alt={currentImage.alt}
              className="w-screen h-screen object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-6 right-6 w-14 h-14 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200 hover:scale-110 border border-white/20 z-20"
              aria-label="Close image"
            >
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Navigation in fullscreen (only if multiple images) */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-8 top-1/2 -translate-y-1/2 w-16 h-16 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110 border border-white/20 z-20"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-8 top-1/2 -translate-y-1/2 w-16 h-16 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all duration-200 hover:scale-110 border border-white/20 z-20"
                  aria-label="Next image"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>

                {/* Dots in fullscreen */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 bg-black/30 backdrop-blur-sm rounded-full px-6 py-3 z-20">
                  {images.map((_, index) => (
                    <button
                      key={index}
                      onClick={(e) => { e.stopPropagation(); goToImage(index); }}
                      className={`w-4 h-4 rounded-full transition-all duration-200 ${
                        index === currentIndex
                          ? 'bg-white scale-125'
                          : 'bg-white/60 hover:bg-white/80 hover:scale-110'
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Image counter in fullscreen */}
                <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full border border-white/20 z-20">
                  {currentIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
