// src/features/dashboard/components/sidebar-connection-status.tsx
"use client"

import { useEffect, useState } from 'react'
import { useNetworkStatus } from '@/shared/hooks/use-network-status'
import { cn } from '@/shared/utils'
import { Wifi, WifiOff } from 'lucide-react'

interface SidebarConnectionStatusProps {
  isCollapsed?: boolean
}

export function SidebarConnectionStatus({ isCollapsed = false }: SidebarConnectionStatusProps) {
  const isOnline = useNetworkStatus()
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

  if (isCollapsed) {
    // Collapsed sidebar - show just the icon
    return (
      <div
        className={cn(
          "flex items-center justify-center h-10 rounded-lg transition-all duration-500 mx-3 mb-2",
          isOnline
            ? "bg-green-800/20 text-green-300"
            : "bg-red-800/20 text-red-300",
          show ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        title={isOnline ? "Back online" : "You're offline"}
      >
        {isOnline ? (
          <Wifi className="h-4 w-4" />
        ) : (
          <WifiOff className="h-4 w-4" />
        )}
      </div>
    )
  }

  // Expanded sidebar - show full status
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-500 mx-3 mb-2",
        isOnline
          ? "bg-green-800/20 text-green-300"
          : "bg-red-800/20 text-red-300",
        show ? "opacity-100" : "opacity-0 pointer-events-none"
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
