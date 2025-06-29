'use client'

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"

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

  if (!images || images.length === 0) return null

  const currentImage = images[currentIndex]
  const hasMultiple = images.length > 1

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const openModal = () => setShowModal(true)
  const closeModal = () => setShowModal(false)

  return (
    <>
      {/* Carousel */}
      <div className={`relative ${className}`}>
        {/* Main image */}
        <div
          className="relative cursor-pointer rounded-lg overflow-hidden bg-muted group"
          onClick={openModal}
        >
          <img
            src={currentImage.url}
            alt={currentImage.alt}
            className="w-full h-auto object-contain hover:opacity-90 transition-opacity"
          />

          {/* Navigation arrows */}
          {hasMultiple && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  prevImage()
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  nextImage()
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Next image"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {hasMultiple && (
          <div className="flex justify-center mt-3 gap-2">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex ? 'bg-primary w-4' : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`View image ${index + 1}`}
              />
            ))}
          </div>
        )}

        {/* Caption */}
        {currentImage.caption && (
          <p className="mt-2 text-sm text-muted-foreground">{currentImage.caption}</p>
        )}
      </div>

      {/* Modal using proper Dialog component */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="p-0 border-0 bg-transparent overflow-hidden max-w-[90vw] max-h-[90vh] w-auto h-auto">
          <VisuallyHidden>
            <DialogTitle>{currentImage.alt}</DialogTitle>
            <DialogDescription>Image viewer for {currentImage.alt}</DialogDescription>
          </VisuallyHidden>

          {/* Full screen dark blurred background */}
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm -z-10" />

          <div className="relative flex items-center justify-center">
            {/* Main image - larger size */}
            <img
              src={currentImage.url}
              alt={currentImage.alt}
              className="max-w-[85vw] max-h-[85vh] w-auto h-auto object-contain"
            />

            {/* Navigation controls positioned relative to image */}
            {hasMultiple && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/70 hover:bg-black/90 text-white p-3 rounded-full transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight size={24} />
                </button>

                {/* Counter */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full">
                  {currentIndex + 1} of {images.length}
                </div>
              </>
            )}

            {/* Caption positioned at bottom of image */}
            {currentImage.caption && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/70 text-white p-4 rounded-lg">
                {currentImage.caption}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}