// src/features/auth/utils/session-security.ts
'use client'

import { createClient } from '@/shared/services/client'

interface SessionFingerprint {
  userAgent: string
  screen: string
  timezone: string
  language: string
  platform: string
  cookieEnabled: boolean
  doNotTrack: string | null
  timestamp: number
}

interface SecurityEvent {
  type: 'fingerprint_mismatch' | 'suspicious_activity' | 'session_hijack_attempt'
  details: Record<string, any>
  timestamp: number
  severity: 'low' | 'medium' | 'high'
}

class SessionSecurity {
  private static instance: SessionSecurity
  private fingerprint: SessionFingerprint | null = null
  private securityEvents: SecurityEvent[] = []
  private readonly FINGERPRINT_KEY = 'session_fingerprint'
  private readonly MAX_EVENTS = 100

  static getInstance(): SessionSecurity {
    if (!SessionSecurity.instance) {
      SessionSecurity.instance = new SessionSecurity()
    }
    return SessionSecurity.instance
  }

  // Generate a device fingerprint
  generateFingerprint(): SessionFingerprint {
    if (typeof window === 'undefined') {
      // Server-side fallback
      return {
        userAgent: 'server',
        screen: 'unknown',
        timezone: 'unknown',
        language: 'unknown',
        platform: 'server',
        cookieEnabled: false,
        doNotTrack: null,
        timestamp: Date.now()
      }
    }

    const fingerprint: SessionFingerprint = {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
      timestamp: Date.now()
    }

    this.fingerprint = fingerprint
    this.storeFingerprint(fingerprint)
    return fingerprint
  }

  // Store fingerprint securely
  private storeFingerprint(fingerprint: SessionFingerprint): void {
    try {
      const encrypted = btoa(JSON.stringify(fingerprint))
      sessionStorage.setItem(this.FINGERPRINT_KEY, encrypted)
    } catch (error) {
      console.warn('Failed to store session fingerprint:', error)
    }
  }

  // Retrieve stored fingerprint
  private getStoredFingerprint(): SessionFingerprint | null {
    try {
      const stored = sessionStorage.getItem(this.FINGERPRINT_KEY)
      if (!stored) return null
      
      const decrypted = atob(stored)
      return JSON.parse(decrypted)
    } catch (error) {
      console.warn('Failed to retrieve session fingerprint:', error)
      return null
    }
  }

  // Validate current session against fingerprint
  validateSession(): { isValid: boolean; risk: 'low' | 'medium' | 'high'; issues: string[] } {
    const stored = this.getStoredFingerprint()
    const current = this.generateFingerprint()
    
    if (!stored) {
      return { isValid: true, risk: 'low', issues: [] }
    }

    const issues: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    // Check for significant changes
    if (stored.userAgent !== current.userAgent) {
      issues.push('User agent changed')
      riskLevel = 'high'
    }

    if (stored.screen !== current.screen) {
      issues.push('Screen resolution changed')
      riskLevel = riskLevel === 'high' ? 'high' : 'medium'
    }

    if (stored.timezone !== current.timezone) {
      issues.push('Timezone changed')
      riskLevel = riskLevel === 'high' ? 'high' : 'medium'
    }

    if (stored.platform !== current.platform) {
      issues.push('Platform changed')
      riskLevel = 'high'
    }

    // Check session age
    const sessionAge = Date.now() - stored.timestamp
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours
    
    if (sessionAge > maxAge) {
      issues.push('Session too old')
      riskLevel = 'medium'
    }

    // Log security event if issues found
    if (issues.length > 0) {
      this.logSecurityEvent({
        type: 'fingerprint_mismatch',
        details: { stored, current, issues },
        timestamp: Date.now(),
        severity: riskLevel
      })
    }

    return {
      isValid: riskLevel !== 'high',
      risk: riskLevel,
      issues
    }
  }

  // Log security events
  private logSecurityEvent(event: SecurityEvent): void {
    this.securityEvents.push(event)
    
    // Keep only recent events
    if (this.securityEvents.length > this.MAX_EVENTS) {
      this.securityEvents = this.securityEvents.slice(-this.MAX_EVENTS)
    }

    // Log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Security event:', event)
    }

    // In production, you might want to send this to a monitoring service
    if (process.env.NODE_ENV === 'production' && event.severity === 'high') {
      this.reportSecurityEvent(event)
    }
  }

  // Report high-severity events (implement based on your monitoring setup)
  private async reportSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      // Example: Send to your monitoring service
      // await fetch('/api/security/report', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(event)
      // })
      console.error('High-severity security event:', event)
    } catch (error) {
      console.error('Failed to report security event:', error)
    }
  }

  // Clear session data on logout
  clearSession(): void {
    try {
      sessionStorage.removeItem(this.FINGERPRINT_KEY)
      this.fingerprint = null
      this.securityEvents = []
    } catch (error) {
      console.warn('Failed to clear session data:', error)
    }
  }

  // Get security events for debugging
  getSecurityEvents(): SecurityEvent[] {
    return [...this.securityEvents]
  }

  // Check for suspicious patterns
  detectSuspiciousActivity(): { suspicious: boolean; reasons: string[] } {
    const recentEvents = this.securityEvents.filter(
      event => Date.now() - event.timestamp < 60 * 60 * 1000 // Last hour
    )

    const reasons: string[] = []
    let suspicious = false

    // Multiple high-severity events
    const highSeverityEvents = recentEvents.filter(e => e.severity === 'high')
    if (highSeverityEvents.length > 2) {
      reasons.push('Multiple high-severity security events')
      suspicious = true
    }

    // Rapid fingerprint changes
    const fingerprintEvents = recentEvents.filter(e => e.type === 'fingerprint_mismatch')
    if (fingerprintEvents.length > 3) {
      reasons.push('Rapid fingerprint changes detected')
      suspicious = true
    }

    return { suspicious, reasons }
  }
}

// Export singleton instance
export const sessionSecurity = SessionSecurity.getInstance()

// Hook for React components
export function useSessionSecurity() {
  const validateCurrentSession = () => sessionSecurity.validateSession()
  const clearSessionData = () => sessionSecurity.clearSession()
  const getEvents = () => sessionSecurity.getSecurityEvents()
  const checkSuspicious = () => sessionSecurity.detectSuspiciousActivity()

  return {
    validateSession: validateCurrentSession,
    clearSession: clearSessionData,
    getSecurityEvents: getEvents,
    detectSuspiciousActivity: checkSuspicious,
    generateFingerprint: () => sessionSecurity.generateFingerprint()
  }
}
