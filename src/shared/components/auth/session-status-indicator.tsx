'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'
import { Shield, ShieldCheck, ShieldAlert } from 'lucide-react'

interface SessionStatusIndicatorProps {
  showNotifications?: boolean
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left'
}

/**
 * Component that monitors session status and shows notifications
 * when session refresh occurs without disrupting user experience
 */
export function SessionStatusIndicator({ 
  showNotifications = true,
  position = 'top-right' 
}: SessionStatusIndicatorProps) {
  const { session, isAuthenticated, securityRisk } = useAuthStatus()
  const [lastSessionRefresh, setLastSessionRefresh] = useState<number>(0)
  const [sessionRefreshCount, setSessionRefreshCount] = useState(0)

  // Monitor session changes for refresh detection
  useEffect(() => {
    if (!session?.access_token || !isAuthenticated) return

    const currentTime = Date.now()
    
    // Detect session refresh by checking if access_token changed
    // and it's been more than 30 seconds since last refresh
    if (session.access_token && 
        currentTime - lastSessionRefresh > 30000 && 
        lastSessionRefresh > 0) {
      
      setSessionRefreshCount(prev => prev + 1)
      setLastSessionRefresh(currentTime)

      if (showNotifications) {
        // Show subtle notification that doesn't interrupt workflow
        toast.success('Session refreshed', {
          description: 'Your login session has been automatically renewed.',
          duration: 3000,
          position: position,
          className: 'session-refresh-toast'
        })
      }

      console.log('Session automatically refreshed to maintain security')
    } else if (lastSessionRefresh === 0) {
      // First time setting up session tracking
      setLastSessionRefresh(currentTime)
    }
  }, [session?.access_token, isAuthenticated, lastSessionRefresh, showNotifications, position])

  // Monitor security risk changes
  useEffect(() => {
    if (!isAuthenticated) return

    if (securityRisk === 'high' && showNotifications) {
      toast.warning('Security Alert', {
        description: 'Unusual activity detected. Please verify your identity.',
        duration: 8000,
        position: position,
        action: {
          label: 'Review',
          onClick: () => {
            // Could open security settings or re-authentication
            console.log('User requested security review')
          }
        }
      })
    } else if (securityRisk === 'medium' && showNotifications) {
      toast.info('Security Notice', {
        description: 'Your session security has been updated.',
        duration: 5000,
        position: position
      })
    }
  }, [securityRisk, isAuthenticated, showNotifications, position])

  // Don't render anything visible - this is a background service component
  return null
}

/**
 * Hook for session status monitoring without UI
 */
export function useSessionStatus() {
  const { session, isAuthenticated, securityRisk } = useAuthStatus()
  const [sessionHealth, setSessionHealth] = useState<'healthy' | 'warning' | 'critical'>('healthy')
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      setSessionHealth('critical')
      return
    }

    if (securityRisk === 'high') {
      setSessionHealth('critical')
    } else if (securityRisk === 'medium') {
      setSessionHealth('warning')
    } else {
      setSessionHealth('healthy')
    }
  }, [isAuthenticated, securityRisk])

  useEffect(() => {
    if (session?.access_token) {
      setLastRefresh(new Date())
    }
  }, [session?.access_token])

  const getStatusIcon = () => {
    switch (sessionHealth) {
      case 'healthy':
        return <ShieldCheck className="h-4 w-4 text-green-500" />
      case 'warning':
        return <ShieldAlert className="h-4 w-4 text-yellow-500" />
      case 'critical':
        return <Shield className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusText = () => {
    switch (sessionHealth) {
      case 'healthy':
        return 'Session secure'
      case 'warning':
        return 'Session warning'
      case 'critical':
        return 'Session issue'
    }
  }

  return {
    sessionHealth,
    lastRefresh,
    isAuthenticated,
    securityRisk,
    getStatusIcon,
    getStatusText
  }
}

/**
 * Minimal session status indicator for admin interfaces
 */
export function SessionStatusBadge() {
  const { sessionHealth, getStatusIcon, getStatusText } = useSessionStatus()

  if (sessionHealth === 'healthy') return null

  return (
    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted text-xs">
      {getStatusIcon()}
      <span>{getStatusText()}</span>
    </div>
  )
}
