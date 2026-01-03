'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import Image from 'next/image'

interface ImageViewerModalProps {
  src: string
  alt: string
  description?: string
  onClose: () => void
}

export function ImageViewerModal({ src, alt, description, onClose }: ImageViewerModalProps) {
  useEffect(() => {
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden'

    // Keyboard support
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = 'auto'
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
    >
      {/* Image container */}
      <div
        className="relative bg-white/5 rounded-2xl border border-white/10 shadow-2xl overflow-hidden max-w-[90vw] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={src}
          alt={alt}
          width={1920}
          height={1080}
          className="max-w-[90vw] max-h-[90vh] object-contain"
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
          aria-label="Close image viewer"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Description */}
        {description && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm">
            <p className="text-sm">{description}</p>
          </div>
        )}
      </div>
    </div>
  )
}
