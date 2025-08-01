'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import Image from 'next/image'

interface SimpleImageViewerProps {
  src: string
  alt: string
  caption?: string
  className?: string
}

export function SimpleImageViewer({ src, alt, caption, className = '' }: SimpleImageViewerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Thumbnail - click to open */}
      <div 
        className={`cursor-pointer rounded-lg overflow-hidden border bg-gray-50 ${className}`}
        onClick={() => setIsOpen(true)}
      >
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          className="object-contain hover:opacity-80 transition-opacity"
        />
      </div>

      {/* Modal overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Image container */}
          <div 
            className="relative bg-white rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 z-10 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Image */}
            <Image
              src={src}
              alt={alt}
              width={0}
              height={0}
              sizes="95vw"
              unoptimized
              className="w-full h-auto max-h-[80vh] object-contain"
              style={{
                width: 'auto',
                height: 'auto',
              }}
            />

            {/* Caption */}
            {caption && (
              <div className="p-4 bg-gray-50 border-t">
                <p className="text-sm text-gray-700">{caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
