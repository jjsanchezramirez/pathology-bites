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

const MIN_IMAGES = 3
const MAX_IMAGES = 5
const CYCLE_INTERVAL = 8000
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
          pageSize: 50, // Fetch more for variety
          category: 'microscopic',
          showUnusedOnly: false,
          includeOnlyMicroscopicAndGross: true
        })
        if (!result.error && result.data.length > 0) {
          setImages(result.data)
        }
      } catch (error) {
        // Silent fail - images will just not appear
      }
    }
    loadMicroscopicImages()
  }, [])

  // Check if position overlaps with existing positions
  const hasOverlap = (newPos: DisplayImage['position'], existing: DisplayImage[]): boolean => {
    return existing.some(img => {
      const dx = Math.abs(newPos.left - img.position.left)
      const dy = Math.abs(newPos.top - img.position.top)
      // Require at least 35% separation in both directions for better spacing
      return dx < 35 && dy < 35
    })
  }

  const generatePosition = (existing: DisplayImage[] = []): DisplayImage['position'] => {
    let attempts = 0
    let position: DisplayImage['position']

    do {
      position = {
        top: 10 + Math.random() * 70,
        left: 5 + Math.random() * 60,
        rotate: -12 + Math.random() * 24,
        scale: 0.85 + Math.random() * 0.3,
      }
      attempts++
    } while (hasOverlap(position, existing) && attempts < 100) // More attempts for better spacing

    return position
  }

  const createDisplayImages = (imageList: ImageData[], excludeIds: string[] = []): DisplayImage[] => {
    const count = MIN_IMAGES + Math.floor(Math.random() * (MAX_IMAGES - MIN_IMAGES + 1))

    // Filter out previously shown images
    const available = imageList.filter(img => !excludeIds.includes(img.id))

    // If we don't have enough unique images, use all images
    const pool = available.length >= count ? available : imageList

    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    const selected = shuffled.slice(0, Math.min(count, pool.length))

    const result: DisplayImage[] = []
    selected.forEach(img => {
      result.push({
        id: img.id,
        url: img.url,
        alt: img.alt_text || img.description || 'Pathology image',
        position: generatePosition(result),
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
