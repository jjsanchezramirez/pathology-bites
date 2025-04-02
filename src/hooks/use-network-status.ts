// src/hooks/use-network-status.ts
import { useState, useEffect } from 'react'
import { networkMonitor } from '@/lib/utils/network-monitor'

interface NetworkStatusOptions {
  /**
   * URL to ping to check for actual connectivity
   * Default is '1.1.1.1' (Cloudflare DNS)
   */
  pingUrl?: string;
  
  /**
   * How often to ping in milliseconds (only used with pingUrl)
   * Default is 30000 (30 seconds)
   */
  pingInterval?: number;
}

/**
 * Hook that tracks network connectivity status
 * Uses the centralized network monitor for consistent status across the app
 * 
 * @param options Configuration options
 * @returns Boolean indicating if the network appears to be online
 */
export function useNetworkStatus(options: NetworkStatusOptions = {}) {
  const { pingUrl } = options
  
  const [isOnline, setIsOnline] = useState<boolean>(networkMonitor.isConnected())
  
  useEffect(() => {
    // If a custom ping URL is provided, set it on the monitor
    if (pingUrl) {
      networkMonitor.setPingUrl(pingUrl)
    }
    
    // Register for status updates
    const removeListener = networkMonitor.addListener((status) => {
      setIsOnline(status)
    })
    
    // Force an immediate connectivity check
    networkMonitor.checkConnection()
    
    return () => {
      removeListener()
    }
  }, [pingUrl])
  
  return isOnline
}