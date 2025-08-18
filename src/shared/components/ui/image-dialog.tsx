'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useImageCacheHandler } from '@/shared/hooks/use-smart-image-cache'
import { X } from 'lucide-react'

interface ImageDialogProps {
  src: string
  alt: string
  caption?: string
  className?: string
}

export function ImageDialog({ src, alt, caption, className = '' }: ImageDialogProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Clickable image */}
      <div
        className={`cursor-pointer rounded-lg overflow-hidden relative ${className}`}
        onClick={() => setIsOpen(true)}
      >
        <Image
          src={src}
          alt={alt}
          width={800}
          height={600}
          className="w-full h-auto object-contain hover:opacity-90 transition-opacity"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          unoptimized
          onLoad={useImageCacheHandler(src)}
        />
      </div>

      {/* Fullscreen dialog */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <div className="relative max-w-7xl max-h-[95vh] w-full">
            <Image
              src={src}
              alt={alt}
              width={1400}
              height={1000}
              className="w-full h-full object-contain"
              sizes="100vw"
              unoptimized
              onLoad={useImageCacheHandler(src)}
            />
            
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-colors"
              aria-label="Close image"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Caption */}
            {caption && (
              <div className="absolute bottom-4 left-4 right-4 bg-black/60 text-white p-3 rounded-lg">
                <p className="text-sm">{caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
