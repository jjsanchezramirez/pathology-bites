'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import type { ImageData } from '@/features/images/types/images'
import { fetchImages } from '@/features/images/services/images'

interface OrganicImageGalleryProps {
  className?: string
}

interface DisplayImage {
  id: string
  url: string
  alt: string
  position: {
    top: number
    left: number
    rotate: number
    scale: number
  }
  floatDelay: number
  floatDuration: number
  opacity: number
}

const MIN_IMAGES = 2
const MAX_IMAGES = 4
const CYCLE_INTERVAL = 12000  // Increased from 8s to 12s to reduce cycles
const FADE_DURATION = 2000

export function OrganicImageGallery({ className = '' }: OrganicImageGalleryProps) {
  const [images, setImages] = useState<ImageData[]>([])
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([])

  // Fetch microscopic images for the gallery
  useEffect(() => {
    const loadMicroscopicImages = async () => {
      try {
        const result = await fetchImages({
          page: 0,
          pageSize: 10, // Reduced from 50 to optimize loading
          category: 'microscopic',
          showUnusedOnly: false,
          includeOnlyMicroscopicAndGross: true
        })
        if (!result.error && result.data.length > 0) {
          setImages(result.data)
        }
      } catch {
        // Silent fail - images will just not appear
      }
    }
    loadMicroscopicImages()
  }, [])

  // Predefined grid positions for organized layout
  const GRID_POSITIONS: DisplayImage['position'][] = [
    // Top row
    { top: 5, left: 10, rotate: -8, scale: 1.0 },
    { top: 8, left: 55, rotate: 6, scale: 0.95 },

    // Middle row
    { top: 35, left: 5, rotate: 4, scale: 0.9 },
    { top: 38, left: 50, rotate: -5, scale: 1.05 },

    // Bottom row
    { top: 65, left: 15, rotate: -6, scale: 0.95 },
    { top: 68, left: 60, rotate: 7, scale: 0.9 },
  ]

  const generatePosition = (index: number): DisplayImage['position'] => {
    // Use predefined positions in order, with slight randomization
    const basePosition = GRID_POSITIONS[index % GRID_POSITIONS.length]

    return {
      top: basePosition.top + (Math.random() - 0.5) * 4, // ±2% variation
      left: basePosition.left + (Math.random() - 0.5) * 4,
      rotate: basePosition.rotate + (Math.random() - 0.5) * 4, // ±2° variation
      scale: basePosition.scale + (Math.random() - 0.5) * 0.1, // ±0.05 variation
    }
  }

  // Fisher-Yates shuffle for truly random selection
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  const createDisplayImages = (imageList: ImageData[], excludeIds: string[] = []): DisplayImage[] => {
    const count = MIN_IMAGES + Math.floor(Math.random() * (MAX_IMAGES - MIN_IMAGES + 1))

    // Filter out previously shown images
    const available = imageList.filter(img => !excludeIds.includes(img.id))

    // If we don't have enough unique images, use all images
    const pool = available.length >= count ? available : imageList

    // Use Fisher-Yates shuffle for truly random selection
    const shuffled = shuffleArray(pool)
    const selected = shuffled.slice(0, Math.min(count, pool.length))

    const result: DisplayImage[] = []
    selected.forEach((img, index) => {
      result.push({
        id: img.id,
        url: img.url,
        alt: img.alt_text || img.description || 'Pathology image',
        position: generatePosition(index),
        floatDelay: Math.random() * 4,
        floatDuration: 6 + Math.random() * 4,
        opacity: 0,
      })
    })

    return result
  }

  // Initialize gallery
  useEffect(() => {
    if (images.length === 0) return

    const timers: NodeJS.Timeout[] = []

    // Set initial images
    const initial = createDisplayImages(images)
    setDisplayImages(initial)

    // Fade them in with staggered timing
    initial.forEach((img, index) => {
      const timer = setTimeout(() => {
        setDisplayImages(current =>
          current.map(di => di.id === img.id ? { ...di, opacity: 1 } : di)
        )
      }, 100 + index * 300) // 300ms between each image
      timers.push(timer)
    })

    // Cycle images
    const interval = setInterval(() => {
      // Step 1: Fade out all current images simultaneously
      setDisplayImages(current => current.map(img => ({ ...img, opacity: 0 })))

      // Step 2: After fade out completes, replace with new images
      const replaceTimer = setTimeout(() => {
        const currentIds = displayImages.map(img => img.id)
        const newImages = createDisplayImages(images, currentIds)
        setDisplayImages(newImages)

        // Step 3: Fade in new images with staggered timing
        newImages.forEach((img, index) => {
          const timer = setTimeout(() => {
            setDisplayImages(current =>
              current.map(di => di.id === img.id ? { ...di, opacity: 1 } : di)
            )
          }, 100 + index * 300)
          timers.push(timer)
        })
      }, FADE_DURATION)
      timers.push(replaceTimer)
    }, CYCLE_INTERVAL)

    return () => {
      clearInterval(interval)
      timers.forEach(timer => clearTimeout(timer))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images])

  return (
    <>
      <style jsx global>{`
        @keyframes galleryFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
      <div className={`relative w-full h-full ${className}`}>
        {displayImages.map((img) => (
          <div
            key={img.id}
            className="absolute"
            style={{
              top: `${img.position.top}%`,
              left: `${img.position.left}%`,
              opacity: img.opacity,
              transition: `opacity ${FADE_DURATION}ms ease-in-out`,
              animation: `galleryFloat ${img.floatDuration}s ease-in-out ${img.floatDelay}s infinite`,
            }}
          >
            <div
              className="rounded-xl overflow-hidden shadow-2xl border-4 border-white/80"
              style={{
                transform: `rotate(${img.position.rotate}deg) scale(${img.position.scale})`,
                width: '280px',
                height: '220px',
              }}
            >
              <Image
                src={img.url}
                alt={img.alt}
                fill
                className="object-cover pointer-events-none"
                sizes="280px"
                unoptimized
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
