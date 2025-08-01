// src/features/auth/components/security-monitor.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/features/auth/hooks'
import { useSessionSecurity } from '@/features/auth/utils/session-security'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Shield, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react'

interface SecurityMonitorProps {
  showLowRisk?: boolean
  className?: string
}

export function SecurityMonitor({ showLowRisk = false, className }: SecurityMonitorProps) {
  const { securityRisk, isAuthenticated, refreshAuth } = useAuth()
  const { validateSession, clearSession, generateFingerprint } = useSessionSecurity()
  const [suspicious, setSuspicious] = useState(false)
  const [suspiciousReasons, setSuspiciousReasons] = useState<string[]>([])

  useEffect(() => {
    if (isAuthenticated) {
      // Use security risk from auth hook instead of deprecated function
      setSuspicious(securityRisk === 'high')
      setSuspiciousReasons(securityRisk === 'high' ? ['High security risk detected'] : [])
    }
  }, [isAuthenticated, securityRisk])

  // Don't show anything if user is not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Don't show low risk unless explicitly requested
  if (securityRisk === 'low' && !showLowRisk && !suspicious) {
    return null
  }

  const getIcon = () => {
    if (suspicious || securityRisk === 'high') {
      return <ShieldAlert className="h-4 w-4" />
    }
    if (securityRisk === 'medium') {
      return <Shield className="h-4 w-4" />
    }
    return <ShieldCheck className="h-4 w-4" />
  }

  const getVariant = () => {
    if (suspicious || securityRisk === 'high') {
      return 'destructive' as const
    }
    if (securityRisk === 'medium') {
      return 'default' as const
    }
    return 'default' as const
  }

  const getMessage = () => {
    if (suspicious) {
      return `Suspicious activity detected: ${suspiciousReasons.join(', ')}`
    }
    
    switch (securityRisk) {
      case 'high':
        return 'High security risk detected. Please verify your session.'
      case 'medium':
        return 'Medium security risk detected. Session validation recommended.'
      case 'low':
        return 'Session security is normal.'
      default:
        return 'Security status unknown.'
    }
  }

  const handleRefreshSession = async () => {
    try {
      await refreshAuth()
    } catch (error) {
      console.error('Failed to refresh session:', error)
    }
  }

  return (
    <Alert variant={getVariant()} className={className}>
      {getIcon()}
      <AlertDescription className="flex items-center justify-between">
        <span>{getMessage()}</span>
        {(securityRisk === 'medium' || securityRisk === 'high' || suspicious) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshSession}
            className="ml-2"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh Session
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

// Debug component for development
export function SecurityDebugPanel() {
  const { securityRisk, isAuthenticated } = useAuth()
  const { validateSession, clearSession, generateFingerprint } = useSessionSecurity()
  const [events, setEvents] = useState<any[]>([])
  const [suspicious, setSuspicious] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      // Use simplified security monitoring
      setEvents([{ type: 'security_check', risk: securityRisk, timestamp: new Date() }])
      setSuspicious(securityRisk === 'high')
    }
  }, [isAuthenticated, securityRisk])

  if (!isAuthenticated || process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 shadow-lg max-w-md">
      <h3 className="font-semibold mb-2">Security Debug Panel</h3>
      <div className="space-y-2 text-sm">
        <div>Risk Level: <span className={`font-medium ${
          securityRisk === 'high' ? 'text-red-500' : 
          securityRisk === 'medium' ? 'text-yellow-500' : 
          'text-green-500'
        }`}>{securityRisk}</span></div>
        <div>Suspicious Activity: <span className={suspicious ? 'text-red-500' : 'text-green-500'}>
          {suspicious ? 'Yes' : 'No'}
        </span></div>
        <div>Security Events: {events.length}</div>
        {events.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer">Recent Events</summary>
            <div className="mt-1 max-h-32 overflow-y-auto">
              {events.slice(-5).map((event, index) => (
                <div key={index} className="text-xs p-1 border-l-2 border-gray-300 pl-2 mt-1">
                  <div>{event.type} - {event.severity}</div>
                  <div className="text-gray-500">{new Date(event.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
