// src/hooks/use-auth-status.ts
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

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
      const supabase = createClient()
      
      // First try getSession
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw sessionError
        }
        
        setIsAuthenticated(!!session)
        setLastError(null)
        return
      } catch (sessionError) {
        // If getSession fails, fall back to getUser
        try {
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            throw userError
          }
          
          setIsAuthenticated(!!user)
          setLastError(null)
          return
        } catch (userError) {
          // If both methods fail, assume not authenticated
          console.warn('Authentication check failed:', userError)
          setIsAuthenticated(false)
          setLastError(userError instanceof Error ? userError : new Error(String(userError)))
        }
      }
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
    
    // Set up focus listener
    const handleFocus = () => {
      checkAuth()
    }
    
    // Set up storage listener for auth changes
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key?.includes('supabase.auth') || event.key === null) {
        checkAuth()
      }
    }
    
    // Add event listeners
    window.addEventListener('focus', handleFocus)
    window.addEventListener('storage', handleStorageChange)
    
    // Clean up event listeners
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [checkAuth])
  
  return {
    isAuthenticated: isAuthenticated === null ? false : isAuthenticated,
    isLoading,
    checkAuth,
    error: lastError
  }
}