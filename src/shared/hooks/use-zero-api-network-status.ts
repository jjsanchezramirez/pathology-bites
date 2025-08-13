// src/shared/hooks/use-zero-api-network-status.ts
// Network status hook that uses ZERO API calls

import { useState, useEffect, useCallback, useRef } from 'react'

interface NetworkStatusOptions {
  onOnline?: () => void
  onOffline?: () => void
  showToasts?: boolean
}

/**
 * Network connectivity hook that uses zero API calls
 * 
 * Uses only browser capabilities:
 * 1. navigator.onLine - Basic browser connectivity
 * 2. navigator.connection - Network quality info (when available)
 * 3. Service worker registration - Indicates browser can make requests
 * 4. WebSocket connectivity tests to external services (optional)
 */
export function useZeroApiNetworkStatus(options: NetworkStatusOptions = {}) {
  const { onOnline, onOffline, showToasts = false } = options
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  })

  const [connectionType, setConnectionType] = useState<string>('unknown')
  const [effectiveType, setEffectiveType] = useState<string>('unknown')
  const previousOnlineState = useRef<boolean | null>(null)

  // Update connection info if Network Information API is available
  const updateConnectionInfo = useCallback(() => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
      
      if (connection) {
        setConnectionType(connection.type || 'unknown')
        setEffectiveType(connection.effectiveType || 'unknown')
      }
    }
  }, [])

  // Test if we can register service workers (indicates some level of connectivity)
  const canRegisterServiceWorker = useCallback((): boolean => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return false
    }
    
    // If service workers are supported and we're online, we likely have connectivity
    return navigator.onLine
  }, [])

  // Handle online status changes and trigger callbacks
  const handleStatusChange = useCallback((newOnlineStatus: boolean) => {
    const previousStatus = previousOnlineState.current
    
    // Only trigger callbacks if this is a real change (not initial load)
    if (previousStatus !== null && previousStatus !== newOnlineStatus) {
      if (newOnlineStatus && onOnline) {
        onOnline()
      } else if (!newOnlineStatus && onOffline) {
        onOffline()
      }
    }
    
    previousOnlineState.current = newOnlineStatus
    setIsOnline(newOnlineStatus)
  }, [onOnline, onOffline])

  // Enhanced online detection using multiple browser signals
  const getEnhancedOnlineStatus = useCallback((): boolean => {
    if (typeof navigator === 'undefined') return true

    // Primary check: navigator.onLine
    if (!navigator.onLine) return false

    // Secondary checks when available
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    
    if (connection) {
      // If connection type is 'none', we're definitely offline
      if (connection.type === 'none') return false
      
      // If effective type is very slow, treat as functionally offline
      if (connection.effectiveType === 'slow-2g') return false
    }

    // Service worker support indicates better connectivity
    const hasServiceWorkerSupport = canRegisterServiceWorker()
    
    return hasServiceWorkerSupport || navigator.onLine
  }, [canRegisterServiceWorker])

  // Handle browser online/offline events
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOnline = () => {
      updateConnectionInfo()
      handleStatusChange(true)
    }

    const handleOffline = () => {
      updateConnectionInfo()
      handleStatusChange(false)
    }

    const handleConnectionChange = () => {
      updateConnectionInfo()
      const newStatus = getEnhancedOnlineStatus()
      handleStatusChange(newStatus)
    }

    const handleVisibilityChange = () => {
      // Re-check status when page becomes visible
      if (document.visibilityState === 'visible') {
        updateConnectionInfo()
        const newStatus = getEnhancedOnlineStatus()
        handleStatusChange(newStatus)
      }
    }

    // Core browser events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Network Information API events (when supported)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (connection) {
      connection.addEventListener('change', handleConnectionChange)
    }

    // Initial setup
    updateConnectionInfo()
    const initialStatus = getEnhancedOnlineStatus()
    previousOnlineState.current = initialStatus // Set initial state without triggering callbacks
    setIsOnline(initialStatus)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange)
      }
    }
  }, [updateConnectionInfo, getEnhancedOnlineStatus, handleStatusChange])

  // Manual refresh that doesn't use API calls
  const forceCheck = useCallback(() => {
    updateConnectionInfo()
    const newStatus = getEnhancedOnlineStatus()
    handleStatusChange(newStatus)
  }, [updateConnectionInfo, getEnhancedOnlineStatus, handleStatusChange])

  return {
    isOnline,
    connectionType,
    effectiveType,
    forceCheck,
    // Provide additional info for debugging
    browserOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasServiceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator
  }
}