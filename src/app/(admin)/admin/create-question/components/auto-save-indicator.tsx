'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/shared/components/ui/badge'
import { Save, Check, AlertCircle } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface AutoSaveIndicatorProps {
  hasUnsavedChanges: boolean
  lastSaveTime?: number
  className?: string
}

export function AutoSaveIndicator({ hasUnsavedChanges, lastSaveTime, className }: AutoSaveIndicatorProps) {
  const [timeAgo, setTimeAgo] = useState<string>('')

  useEffect(() => {
    if (!lastSaveTime) return

    const updateTimeAgo = () => {
      const now = Date.now()
      const diff = now - lastSaveTime
      const seconds = Math.floor(diff / 1000)
      const minutes = Math.floor(seconds / 60)

      if (seconds < 60) {
        setTimeAgo('just now')
      } else if (minutes < 60) {
        setTimeAgo(`${minutes}m ago`)
      } else {
        const hours = Math.floor(minutes / 60)
        setTimeAgo(`${hours}h ago`)
      }
    }

    updateTimeAgo()
    const interval = setInterval(updateTimeAgo, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [lastSaveTime])

  if (!lastSaveTime && !hasUnsavedChanges) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {hasUnsavedChanges ? (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Save className="h-3 w-3" />
          Saving...
        </Badge>
      ) : lastSaveTime ? (
        <Badge variant="outline" className="flex items-center gap-1 text-green-600 border-green-200">
          <Check className="h-3 w-3" />
          Saved {timeAgo}
        </Badge>
      ) : (
        <Badge variant="outline" className="flex items-center gap-1 text-amber-600 border-amber-200">
          <AlertCircle className="h-3 w-3" />
          Not saved
        </Badge>
      )}
    </div>
  )
}
