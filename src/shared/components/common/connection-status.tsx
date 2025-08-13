// src/components/network/connection-status.tsx
"use client"

import { useEffect, useState } from 'react'
import { useZeroApiNetworkStatus } from '@/shared/hooks/use-zero-api-network-status'
import { cn } from '@/shared/utils'
import { Wifi, WifiOff } from 'lucide-react'

export function ConnectionStatus() {
  const { isOnline } = useZeroApiNetworkStatus()
  const [show, setShow] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  // Show offline indicator immediately, but delay hiding it
  useEffect(() => {
    if (!isOnline) {
      setShow(true)
      setWasOffline(true)
    } else if (wasOffline) {
      // If we were offline and came back online, wait a bit before hiding
      const timer = setTimeout(() => {
        setShow(false)
        // Reset after animation completes
        const resetTimer = setTimeout(() => {
          setWasOffline(false)
        }, 500) // animation duration

        return () => clearTimeout(resetTimer)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  // If we've never been offline and we're online, don't render anything
  if (!wasOffline && isOnline) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium shadow-lg transition-all duration-500",
        isOnline
          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
      )}
    >
      {isOnline ? (
        <>
          <Wifi className="h-4 w-4" />
          <span>Back online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4" />
          <span>You're offline</span>
        </>
      )}
    </div>
  )
}