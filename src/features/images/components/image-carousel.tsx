'use client'

import { useState, useEffect } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useMobile } from "@/shared/hooks/use-mobile"

interface ImageProps {
  url: string
  alt: string
  caption?: string
}

interface ImageCarouselProps {
  images: ImageProps[]
  className?: string
}

export function ImageCarousel({ images, className = '' }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const isMobile = useMobile()

  // Keyboard navigation for fullscreen - must be before early return
  useEffect(() => {
    if (!showModal || !images || images.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setShowModal(false)
          break
        case 'ArrowLeft':
          if (images.length > 1) {
            setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
          }
          break
        case 'ArrowRight':
          if (images.length > 1) {
            setCurrentIndex((prev) => (prev + 1) % images.length)
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showModal, images])

  if (!images || images.length === 0) return null

  const currentImage = images[currentIndex]
  const hasMultiple = images.length > 1

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const openModal = () => {
    // Disable zoom on mobile devices
    if (!isMobile) {
      setShowModal(true)
    }
  }
  const closeModal = () => setShowModal(false)



  return (
    <>
      {/* Carousel */}
      <div className={`relative ${className}`}>
        {/* Main image */}
        <div
          className={`relative rounded-lg overflow-hidden bg-muted group ${
            isMobile ? 'cursor-default' : 'cursor-pointer'
          }`}
          style={{ aspectRatio: '16/10' }}
          onClick={openModal}
        >
          {currentImage.url ? (
            <Image
              src={currentImage.url}
              alt={currentImage.alt}
              fill
              className="object-contain hover:opacity-90 transition-opacity"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              unoptimized={true}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    prevImage()
                  }}
                  className={`p-2 hover:bg-black/10 rounded-full transition-all duration-200 ${
                    isMobile ? 'p-3' : 'p-2'
                  }`}
                  aria-label="Previous image"
                >
                  <ChevronLeft size={16} className="text-white" />
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
                  onClick={(e) => {
                    e.stopPropagation()
                    nextImage()
                  }}
                  className={`p-2 hover:bg-black/10 rounded-full transition-all duration-200 ${
                    isMobile ? 'p-3' : 'p-2'
                  }`}
                  aria-label="Next image"
                >
                  <ChevronRight size={16} className="text-white" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Dots positioned on top of image */}
        {hasMultiple && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/20 backdrop-blur-sm rounded-full px-3 py-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  index === currentIndex
                    ? 'bg-white scale-125'
                    : 'bg-white/60 hover:bg-white/80 hover:scale-110'
                }`}
                aria-label={`View image ${index + 1}`}
              />
            ))}
          </div>
        )}


      </div>

      {/* Beautiful modal with subtle blur background */}
      {showModal && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setShowModal(false)}
        >
          {/* Image container - let image determine size within viewport limits */}
          <div className="relative bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
            {currentImage.url ? (
              <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <Image
                  src={currentImage.url}
                  alt={currentImage.alt}
                  width={1200}
                  height={800}
                  className="max-w-[90vw] max-h-[90vh] object-contain"
                  unoptimized={true}
                />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/70 min-w-[300px] min-h-[200px]">
                No image available
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white hover:text-white transition-all duration-200 hover:scale-110 border border-white/20 shadow-lg z-10"
              aria-label="Close image"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation controls (only if multiple images) */}
          {hasMultiple && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center text-white hover:text-white transition-all duration-200 hover:scale-110 border border-white/20 shadow-lg z-10"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center text-white hover:text-white transition-all duration-200 hover:scale-110 border border-white/20 shadow-lg z-10"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Image counter */}
              <div className="absolute top-4 left-4 bg-white/15 text-white text-sm px-3 py-1.5 rounded-full border border-white/20 shadow-lg z-10">
                {currentIndex + 1} / {images.length}
              </div>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}