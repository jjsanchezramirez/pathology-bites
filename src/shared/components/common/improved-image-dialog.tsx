'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { X } from 'lucide-react'

interface ImprovedImageDialogProps {
  src: string
  alt: string
  caption?: string
  className?: string
  aspectRatio?: string
}

export function ImprovedImageDialog({
  src,
  alt,
  caption,
  className = '',
  aspectRatio = '16/10'
}: ImprovedImageDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const openDialog = () => {
    setIsOpen(true)
    setIsLoading(true)
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <>
      {/* Clickable image with consistent aspect ratio */}
      <div
        className={`relative cursor-pointer rounded-lg overflow-hidden bg-muted ${className}`}
        style={{ aspectRatio }}
        onClick={openDialog}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-contain hover:opacity-90 transition-opacity"
            onLoad={() => setIsLoading(false)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
            No image available
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* True fullscreen modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Image sized to fit screen without cropping */}
          {src ? (
            <Image
              src={src}
              alt={alt}
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/70">
              No image available
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-all duration-200 hover:scale-110 border border-white/20 z-10"
            aria-label="Close image"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Caption */}
          {caption && (
            <div className="absolute bottom-8 left-8 right-8 bg-black/40 backdrop-blur-sm text-white p-4 rounded-lg border border-white/20 z-10">
              <p className="text-sm text-center">{caption}</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
