// src/hooks/use-auth-status.ts

import { useState, useEffect, useCallback } from 'react'
import { networkService } from '@/lib/network/network-service'

/**
 * Hook to track the authentication status of the current user
 * Uses a more robust and resilient approach to session checking
 */
export function useAuthStatus() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastError, setLastError] = useState<Error | null>(null)
  
  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // First use the network service's cached value for quick responses
      const isUserAuthenticated = networkService.isUserAuthenticated()
      setIsAuthenticated(isUserAuthenticated)
      
      // Then do a fresh check against Supabase
      const freshAuthState = await networkService.checkAuthentication()
      setIsAuthenticated(freshAuthState)
      setLastError(null)
    } catch (error) {
      console.error('Error checking auth status:', error)
      setIsAuthenticated(false)
      setLastError(error instanceof Error ? error : new Error(String(error)))
    } finally {
      setIsLoading(false)
    }
  }, [])
  
  // Check auth status on mount and when window gets focus
  useEffect(() => {
    // Initial check
    checkAuth()
    
    // Set up a listener with the network service for auth status changes
    const removeListener = networkService.addAuthListener((status) => {
      setIsAuthenticated(status)
      setIsLoading(false)
    })
    
    // Clean up listener
    return () => {
      removeListener()
    }
  }, [checkAuth])
  
  return {
    isAuthenticated: isAuthenticated === null ? false : isAuthenticated,
    isLoading,
    checkAuth,
    error: lastError
  }
}