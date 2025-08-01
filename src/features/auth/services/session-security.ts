// src/features/auth/services/session-security.ts

export interface SecurityFingerprint {
  browserFamily: string
  platform: string
  language: string
  timezone: string
  screenCategory: string
  deviceType: string
}

export interface SecurityEvent {
  type: 'fingerprint_mismatch' | 'session_expired' | 'session_invalid' | 'concurrent_session'
  severity: 'low' | 'medium' | 'high'
  timestamp: number
  details: Record<string, any>
  userAgent?: string
}

export interface SessionData {
  access_token: string
  expires_at: number
  user: {
    id: string
    email?: string
  }
  created_at?: number
}

export interface RiskAssessment {
  shouldAlert: boolean
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  changes: string[]
  isValid: boolean
}

class SessionSecurity {
  private readonly STORAGE_KEY = 'session_fingerprint'
  private readonly MAX_SESSION_AGE = 24 * 60 * 60 * 1000 // 24 hours
  private readonly REFRESH_THRESHOLD = 5 * 60 // 5 minutes before expiry

  /**
   * Generate a security fingerprint from browser environment
   */
  generateFingerprint(): SecurityFingerprint {
    // Handle server-side rendering
    if (typeof window === 'undefined') {
      return this.getServerFingerprint()
    }

    return {
      browserFamily: this.getBrowserFamily(navigator.userAgent),
      platform: navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      timezone: this.getTimezone(),
      screenCategory: this.getScreenCategory(),
      deviceType: this.getDeviceType()
    }
  }

  /**
   * Get browser family (not exact version to avoid false positives)
   */
  private getBrowserFamily(userAgent: string): string {
    if (userAgent.includes('Edg')) return 'Edge'
    if (userAgent.includes('Chrome')) return 'Chrome'
    if (userAgent.includes('Firefox')) return 'Firefox'
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari'
    if (userAgent.includes('Opera')) return 'Opera'
    return 'Other'
  }

  /**
   * Get timezone safely
   */
  private getTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    } catch {
      return 'UTC'
    }
  }

  /**
   * Categorize screen size instead of exact dimensions
   */
  private getScreenCategory(): string {
    try {
      const width = screen.width
      
      // Use available screen dimensions, not window size
      if (width >= 2560) return 'ultra-wide'
      if (width >= 1920) return 'large-desktop'
      if (width >= 1366) return 'desktop'
      if (width >= 768) return 'tablet'
      return 'mobile'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Determine device type
   */
  private getDeviceType(): string {
    try {
      const ua = navigator.userAgent
      if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
      if (/Android.*Mobile/.test(ua)) return 'android-mobile'
      if (/Android/.test(ua)) return 'android-tablet'
      if (/Mobi/i.test(ua)) return 'mobile'
      return 'desktop'
    } catch {
      return 'unknown'
    }
  }

  /**
   * Server-side fingerprint fallback
   */
  private getServerFingerprint(): SecurityFingerprint {
    return {
      browserFamily: 'server',
      platform: 'server',
      language: 'unknown',
      timezone: 'UTC',
      screenCategory: 'unknown',
      deviceType: 'server'
    }
  }

  /**
   * Assess risk level of fingerprint changes
   */
  assessFingerprintRisk(stored: SecurityFingerprint, current: SecurityFingerprint): RiskAssessment {
    const changes: string[] = []
    let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none'

    // Define risk levels for different changes
    const highRiskFields = ['platform', 'timezone', 'browserFamily']
    const mediumRiskFields = ['screenCategory', 'language']
    const lowRiskFields = ['deviceType']

    // Compare each field
    Object.keys(stored).forEach(key => {
      const k = key as keyof SecurityFingerprint
      if (stored[k] !== current[k]) {
        changes.push(key)

        if (highRiskFields.includes(key)) {
          riskLevel = 'high'
        } else if (mediumRiskFields.includes(key) && riskLevel !== 'high') {
          riskLevel = 'medium'
        } else if (lowRiskFields.includes(key) && riskLevel === 'none') {
          riskLevel = 'low'
        }
      }
    })

    // Multiple changes increase risk
    if (changes.length >= 3) {
      riskLevel = riskLevel === 'none' ? 'medium' : 'high'
    }

    return {
      shouldAlert: riskLevel === 'high',
      riskLevel,
      changes,
      isValid: riskLevel !== 'high'
    }
  }

  /**
   * Validate session structure and expiration
   */
  validateSession(session: any): { isValid: boolean; reason?: string } {
    // Check session structure
    if (!session) {
      return { isValid: false, reason: 'Session is null or undefined' }
    }

    if (!session.access_token) {
      return { isValid: false, reason: 'Missing access token' }
    }

    if (!session.expires_at) {
      return { isValid: false, reason: 'Missing expiration time' }
    }

    if (!session.user?.id) {
      return { isValid: false, reason: 'Missing user information' }
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (now >= session.expires_at) {
      return { isValid: false, reason: 'Session expired' }
    }

    // Check session age if created_at is available
    if (session.created_at) {
      const sessionAge = Date.now() - (session.created_at * 1000)
      if (sessionAge > this.MAX_SESSION_AGE) {
        return { isValid: false, reason: 'Session too old' }
      }
    }

    return { isValid: true }
  }

  /**
   * Check if session needs refresh
   */
  needsRefresh(session: SessionData): boolean {
    if (!session?.expires_at) return true
    
    const now = Math.floor(Date.now() / 1000)
    const timeUntilExpiry = session.expires_at - now
    
    return timeUntilExpiry <= this.REFRESH_THRESHOLD
  }

  /**
   * Store fingerprint securely
   */
  storeFingerprint(fingerprint: SecurityFingerprint): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const data = {
          fingerprint,
          timestamp: Date.now()
        }
        sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(data))
      }
    } catch (error) {
      console.warn('Failed to store fingerprint:', error)
    }
  }

  /**
   * Retrieve stored fingerprint
   */
  getStoredFingerprint(): SecurityFingerprint | null {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) {
        return null
      }

      const stored = sessionStorage.getItem(this.STORAGE_KEY)
      if (!stored) return null

      const data = JSON.parse(stored)
      
      // Check if stored fingerprint is too old (24 hours)
      const age = Date.now() - data.timestamp
      if (age > this.MAX_SESSION_AGE) {
        this.clearStoredFingerprint()
        return null
      }

      return data.fingerprint
    } catch (error) {
      console.warn('Failed to retrieve stored fingerprint:', error)
      return null
    }
  }

  /**
   * Clear stored fingerprint
   */
  clearStoredFingerprint(): void {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        sessionStorage.removeItem(this.STORAGE_KEY)
      }
    } catch (error) {
      console.warn('Failed to clear fingerprint:', error)
    }
  }

  /**
   * Validate session with fingerprint check
   */
  validateSessionSecurity(session: SessionData): RiskAssessment {
    // First validate basic session structure
    const sessionValidation = this.validateSession(session)
    if (!sessionValidation.isValid) {
      this.logSecurityEvent({
        type: 'session_invalid',
        severity: 'high',
        timestamp: Date.now(),
        details: { reason: sessionValidation.reason }
      })

      return {
        shouldAlert: true,
        riskLevel: 'high',
        changes: ['session_invalid'],
        isValid: false
      }
    }

    // Generate current fingerprint
    const currentFingerprint = this.generateFingerprint()
    const storedFingerprint = this.getStoredFingerprint()

    // If no stored fingerprint, this is a new session
    if (!storedFingerprint) {
      this.storeFingerprint(currentFingerprint)
      return {
        shouldAlert: false,
        riskLevel: 'none',
        changes: [],
        isValid: true
      }
    }

    // Compare fingerprints
    const riskAssessment = this.assessFingerprintRisk(storedFingerprint, currentFingerprint)

    // Log security event if high risk
    if (riskAssessment.shouldAlert) {
      this.logSecurityEvent({
        type: 'fingerprint_mismatch',
        severity: 'high',
        timestamp: Date.now(),
        details: {
          stored: storedFingerprint,
          current: currentFingerprint,
          issues: riskAssessment.changes
        },
        userAgent: typeof window !== 'undefined' ? navigator.userAgent : 'server'
      })
    }

    // Update stored fingerprint if changes are acceptable
    if (riskAssessment.isValid) {
      this.storeFingerprint(currentFingerprint)
    }

    return riskAssessment
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: SecurityEvent): void {
    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.warn('Security event:', event)
    }

    // In production, send to your logging service
    // Example: send to your API endpoint
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      try {
        fetch('/api/security/events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event)
        }).catch(error => {
          console.error('Failed to log security event:', error)
        })
      } catch (error) {
        console.error('Failed to log security event:', error)
      }
    }
  }

  /**
   * Clear all session data
   */
  clearSessionData(): void {
    try {
      if (typeof window === 'undefined') return

      // Clear session storage
      if (window.sessionStorage) {
        window.sessionStorage.clear()
      }

      // Clear specific localStorage items (be selective)
      if (window.localStorage) {
        const keysToRemove = [
          'supabase.auth.token',
          'auth.session',
          'session_meta'
        ]

        keysToRemove.forEach(key => {
          try {
            window.localStorage.removeItem(key)
          } catch (error) {
            console.warn(`Failed to remove ${key}:`, error)
          }
        })
      }
    } catch (error) {
      console.warn('Failed to clear session data:', error)
    }
  }

  /**
   * Initialize session security validation
   */
  async initializeSessionSecurity(getSession: () => Promise<SessionData | null>): Promise<boolean> {
    try {
      const session = await getSession()

      if (!session) {
        this.clearStoredFingerprint()
        return false
      }

      const validation = this.validateSessionSecurity(session)

      if (!validation.isValid) {
        this.clearSessionData()
        return false
      }

      return true
    } catch (error) {
      console.error('Session security initialization failed:', error)
      this.logSecurityEvent({
        type: 'session_invalid',
        severity: 'high',
        timestamp: Date.now(),
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
      return false
    }
  }
}

// Export singleton instance
export const sessionSecurity = new SessionSecurity()

// Export types and class for testing
export { SessionSecurity }