// src/hooks/use-network-status.ts

import { useState, useEffect } from 'react'
import { networkService } from '@/shared/services/network-service'

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
 * Uses the centralized network service for consistent status across the app
 * 
 * @param options Configuration options
 * @returns Boolean indicating if the network appears to be online
 */
export function useNetworkStatus(options: NetworkStatusOptions = {}) {
  const { pingUrl } = options
  
  const [isOnline, setIsOnline] = useState<boolean>(networkService.isConnected())
  
  useEffect(() => {
    // If a custom ping URL is provided, set it on the service
    if (pingUrl) {
      networkService.setPingUrl(pingUrl)
    }
    
    // Register for status updates
    const removeListener = networkService.addNetworkListener((status) => {
      setIsOnline(status)
    })
    
    // Force an immediate connectivity check
    networkService.checkConnection()
    
    return () => {
      removeListener()
    }
  }, [pingUrl])
  
  return isOnline
}