// src/features/achievements/components/achievement-lottie.tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/shared/utils'

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false })

type AnimationType = 'badge' | 'medal' | 'star_badge' | 'star_medal' | 'crown' | 'trophy_large'

interface AchievementLottieProps {
  animationType: AnimationType
  isUnlocked: boolean
  className?: string
}

export function AchievementLottie({
  animationType,
  isUnlocked,
  className
}: AchievementLottieProps) {
  const [animationData, setAnimationData] = useState(null)

  useEffect(() => {
    // Fetch the Lottie animation from R2
    fetch(`https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/animations/${animationType}.json`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Failed to load animation: ${response.status}`)
        }
        return response.json()
      })
      .then(data => setAnimationData(data))
      .catch(err => console.error('Error loading animation:', err))
  }, [animationType])

  if (!animationData) {
    // Loading placeholder
    return (
      <div className={cn(
        "flex items-center justify-center",
        className
      )}>
        <div className="w-full h-full bg-muted/20 rounded-full animate-pulse" />
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center justify-center transition-all",
      !isUnlocked && "grayscale opacity-60",
      className
    )}>
      <Lottie
        animationData={animationData}
        loop={isUnlocked}
        autoplay={isUnlocked}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
