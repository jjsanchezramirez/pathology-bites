// src/components/network/connection-status.tsx
"use client"

import React, { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { cn } from '@/lib/utils'

export function ConnectionStatus() {
  const isOnline = useNetworkStatus({
    pingUrl: 'https://1.1.1.1',
    pingInterval: 30000 // 30 seconds
  })
  
  const [showReconnectedMessage, setShowReconnectedMessage] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)
  
  // Handle status change
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline) {
      // We were offline but now we're online again
      setShowReconnectedMessage(true)
      
      // Auto-hide the reconnected message after 3 seconds
      const timerId = setTimeout(() => {
        setShowReconnectedMessage(false)
        setWasOffline(false)
      }, 3000)
      
      return () => clearTimeout(timerId)
    }
  }, [isOnline, wasOffline])
  
  if (isOnline && !showReconnectedMessage) {
    return null
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {!isOnline && (
        <div className={cn(
          "bg-red-100 border border-red-200 text-red-800 px-4 py-2 rounded-md shadow-md",
          "flex items-center gap-2 transition-opacity duration-300 animate-in fade-in-0 slide-in-from-right-10"
        )}>
          <WifiOff className="h-4 w-4" />
          <span className="text-sm font-medium">
            You are offline. Some features may be unavailable.
          </span>
        </div>
      )}
      
      {showReconnectedMessage && (
        <div className={cn(
          "bg-green-100 border border-green-200 text-green-800 px-4 py-2 rounded-md shadow-md",
          "flex items-center gap-2 transition-opacity duration-300 animate-in fade-in-0 slide-in-from-right-10"
        )}>
          <Wifi className="h-4 w-4" />
          <span className="text-sm font-medium">
            You are back online.
          </span>
        </div>
      )}
    </div>
  )
}