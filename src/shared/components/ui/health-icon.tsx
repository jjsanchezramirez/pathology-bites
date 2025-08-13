// src/shared/components/ui/health-icon.tsx

'use client'

import React from 'react'
import Image from 'next/image'
import { getHealthIconMeta, getHealthIconUrl } from '@/shared/config/learning-module-icons'

interface HealthIconProps {
  iconKey: string
  style?: 'outline' | 'filled'
  size?: number | string
  className?: string
  alt?: string
}

export function HealthIcon({ 
  iconKey, 
  style = 'outline', 
  size = 24, 
  className = '',
  alt 
}: HealthIconProps) {
  const iconMeta = getHealthIconMeta(iconKey)
  const iconUrl = getHealthIconUrl(iconKey, style)
  
  // Convert size to CSS value
  const sizeValue = typeof size === 'number' ? `${size}px` : size
  
  return (
    <Image
      src={iconUrl}
      alt={alt || iconMeta.title}
      width={typeof size === 'number' ? size : 24}
      height={typeof size === 'number' ? size : 24}
      className={className}
      style={{ 
        width: sizeValue, 
        height: sizeValue,
        objectFit: 'contain'
      }}
      unoptimized
    />
  )
}

// Alias for backward compatibility
export const HealthIconImg = HealthIcon