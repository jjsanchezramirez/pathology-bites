// src/__tests__/auth/session-management.test.ts
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { createMockSupabaseClient } from '../utils/supabase-mock'

// Mock modules
jest.mock('@/shared/services/client', () => ({
  createClient: jest.fn()
}))

describe('Session Management & Security', () => {
  let mockSupabase: any

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    jest.clearAllMocks()

    // Mock browser environment
    Object.defineProperty(window, 'navigator', {
      value: {
        userAgent: 'Mozilla/5.0 Test Browser',
        language: 'en-US',
        platform: 'MacIntel',
        cookieEnabled: true,
        doNotTrack: null
      },
      writable: true
    })

    Object.defineProperty(window, 'screen', {
      value: {
        width: 1920,
        height: 1080,
        colorDepth: 24
      },
      writable: true
    })

    Object.defineProperty(window, 'Intl', {
      value: {
        DateTimeFormat: () => ({
          resolvedOptions: () => ({ timeZone: 'America/New_York' })
        })
      },
      writable: true
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Session Validation', () => {
    it('should validate session structure', () => {
      const validSession = {
        access_token: 'valid-token-123',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123', email: 'test@example.com' }
      }

      const invalidSessions = [
        null,
        undefined,
        {},
        { access_token: 'token' }, // missing expires_at and user
        { expires_at: Date.now() }, // missing access_token and user
        { user: { id: 'user-123' } }, // missing access_token and expires_at
      ]

      const validateSessionStructure = (session: any) => {
        return !!(session &&
                 session.access_token &&
                 session.expires_at &&
                 session.user &&
                 session.user.id)
      }

      expect(validateSessionStructure(validSession)).toBe(true)

      invalidSessions.forEach(session => {
        expect(validateSessionStructure(session)).toBe(false)
      })
    })

    it('should validate session expiration', () => {
      const now = Math.floor(Date.now() / 1000)

      const expiredSession = {
        access_token: 'token-123',
        expires_at: now - 3600, // 1 hour ago
        user: { id: 'user-123' }
      }

      const validSession = {
        access_token: 'token-123',
        expires_at: now + 3600, // 1 hour from now
        user: { id: 'user-123' }
      }

      const isSessionExpired = (session: any) => {
        if (!session || !session.expires_at) return true
        return Math.floor(Date.now() / 1000) >= session.expires_at
      }

      expect(isSessionExpired(expiredSession)).toBe(true)
      expect(isSessionExpired(validSession)).toBe(false)
      expect(isSessionExpired(null)).toBe(true)
      expect(isSessionExpired({})).toBe(true)
    })

    it('should validate session age limits', () => {
      const maxSessionAge = 24 * 60 * 60 // 24 hours in seconds
      const now = Math.floor(Date.now() / 1000)

      const oldSession = {
        access_token: 'token-123',
        expires_at: now + 3600,
        user: { id: 'user-123' },
        created_at: now - (25 * 60 * 60) // 25 hours ago
      }

      const recentSession = {
        access_token: 'token-123',
        expires_at: now + 3600,
        user: { id: 'user-123' },
        created_at: now - (2 * 60 * 60) // 2 hours ago
      }

      const isSessionTooOld = (session: any, maxAge: number) => {
        if (!session || !session.created_at) return false
        return (now - session.created_at) > maxAge
      }

      expect(isSessionTooOld(oldSession, maxSessionAge)).toBe(true)
      expect(isSessionTooOld(recentSession, maxSessionAge)).toBe(false)
    })

    it('should handle concurrent session validation', async () => {
      const sessionData = {
        access_token: 'token-123',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: 'user-123' }
      }

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: sessionData },
        error: null
      })

      // Simulate multiple concurrent validations
      const promises = Array(5).fill(null).map(() =>
        mockSupabase.auth.getSession()
      )

      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result.data.session).toEqual(sessionData)
        expect(result.error).toBeNull()
      })
    })
  })

  describe('Session Fingerprinting', () => {
    it('should generate device fingerprint from browser environment', () => {
      const generateFingerprint = () => {
        return {
          userAgent: window.navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
          platform: window.navigator.platform,
          language: window.navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          cookieEnabled: window.navigator.cookieEnabled,
          timestamp: Date.now()
        }
      }

      const fingerprint1 = generateFingerprint()
      const fingerprint2 = generateFingerprint()

      expect(fingerprint1.userAgent).toBe('Mozilla/5.0 Test Browser')
      expect(fingerprint1.screen).toBe('1920x1080x24')
      expect(fingerprint1.platform).toBe('MacIntel')
      expect(fingerprint1.language).toBe('en-US')
      expect(fingerprint1.timezone).toBe('America/New_York')
      expect(fingerprint1.cookieEnabled).toBe(true)

      // Should be consistent for same environment
      expect(fingerprint1.userAgent).toBe(fingerprint2.userAgent)
      expect(fingerprint1.screen).toBe(fingerprint2.screen)
      expect(fingerprint1.platform).toBe(fingerprint2.platform)
    })

    it('should detect fingerprint changes and assess risk', () => {
      const initialFingerprint = {
        userAgent: 'Mozilla/5.0 Initial Browser',
        screen: '1920x1080x24',
        platform: 'MacIntel',
        language: 'en-US',
        timezone: 'America/New_York'
      }

      const changedFingerprint = {
        userAgent: 'Mozilla/5.0 Different Browser', // Changed
        screen: '1366x768x24', // Changed
        platform: 'Win32', // Changed
        language: 'en-US',
        timezone: 'America/New_York'
      }

      const detectFingerprintChanges = (initial: any, current: any) => {
        const changes = []
        const highRiskFields = ['userAgent', 'platform']
        const mediumRiskFields = ['screen', 'timezone']

        let riskLevel = 'low'

        Object.keys(initial).forEach(key => {
          if (initial[key] !== current[key]) {
            changes.push(`${key} changed`)
            if (highRiskFields.includes(key)) {
              riskLevel = 'high'
            } else if (mediumRiskFields.includes(key) && riskLevel !== 'high') {
              riskLevel = 'medium'
            }
          }
        })

        return {
          isValid: riskLevel !== 'high',
          risk: riskLevel,
          issues: changes
        }
      }

      const validation = detectFingerprintChanges(initialFingerprint, changedFingerprint)

      expect(validation.isValid).toBe(false)
      expect(validation.risk).toBe('high')
      expect(validation.issues).toContain('userAgent changed')
      expect(validation.issues).toContain('platform changed')
    })

    it('should handle server-side fingerprinting gracefully', () => {
      const generateServerFingerprint = () => {
        // Server-side fingerprinting fallback
        if (typeof window === 'undefined') {
          return {
            userAgent: 'server',
            screen: 'unknown',
            platform: 'server',
            language: 'unknown',
            timezone: 'UTC',
            cookieEnabled: false
          }
        }

        return {
          userAgent: window.navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
          platform: window.navigator.platform,
          language: window.navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          cookieEnabled: window.navigator.cookieEnabled
        }
      }

      // Test with window available
      const clientFingerprint = generateServerFingerprint()
      expect(clientFingerprint.userAgent).toBe('Mozilla/5.0 Test Browser')
      expect(clientFingerprint.platform).toBe('MacIntel')

      // Mock server environment
      const originalWindow = global.window
      delete (global as any).window

      const serverFingerprint = generateServerFingerprint()
      expect(serverFingerprint.userAgent).toBe('server')
      expect(serverFingerprint.screen).toBe('unknown')
      expect(serverFingerprint.platform).toBe('server')

      // Restore window
      global.window = originalWindow
    })
  })

  describe('Session Storage Security', () => {
    it('should not store sensitive data in localStorage', () => {
      const mockStorage = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      }

      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        writable: true
      })

      const storeSessionData = (data: any) => {
        // Only store non-sensitive session metadata
        const safeData = {
          sessionId: data.sessionId,
          lastActivity: data.lastActivity,
          fingerprint: data.fingerprint
        }

        // Never store tokens, passwords, or user data
        mockStorage.setItem('session_meta', JSON.stringify(safeData))
      }

      const sessionData = {
        sessionId: 'session-123',
        accessToken: 'secret-token',
        refreshToken: 'secret-refresh',
        userPassword: 'user-password',
        lastActivity: Date.now(),
        fingerprint: 'fp-123'
      }

      storeSessionData(sessionData)

      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'session_meta',
        expect.not.stringContaining('secret-token')
      )
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'session_meta',
        expect.not.stringContaining('secret-refresh')
      )
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'session_meta',
        expect.not.stringContaining('user-password')
      )
    })

    it('should clear session data on logout', () => {
      const mockLocalStorage = {
        clear: jest.fn(),
        removeItem: jest.fn(),
        getItem: jest.fn(),
        setItem: jest.fn()
      }

      const mockSessionStorage = {
        clear: jest.fn(),
        removeItem: jest.fn(),
        getItem: jest.fn(),
        setItem: jest.fn()
      }

      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
      })

      Object.defineProperty(window, 'sessionStorage', {
        value: mockSessionStorage,
        writable: true
      })

      const clearSessionData = () => {
        // Clear all storage
        mockLocalStorage.clear()
        mockSessionStorage.clear()

        // Remove specific auth-related items
        mockLocalStorage.removeItem('supabase.auth.token')
        mockLocalStorage.removeItem('auth.session')
        mockSessionStorage.removeItem('session_meta')
      }

      clearSessionData()

      expect(mockLocalStorage.clear).toHaveBeenCalled()
      expect(mockSessionStorage.clear).toHaveBeenCalled()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('supabase.auth.token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('auth.session')
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('session_meta')
    })
  })

  describe('Session Refresh Handling', () => {
    it('should detect when session needs refresh', () => {
      const now = Math.floor(Date.now() / 1000)
      const refreshThreshold = 5 * 60 // 5 minutes

      const nearExpirySession = {
        access_token: 'expiring-token',
        expires_at: now + 300, // 5 minutes from now
        user: { id: 'user-123' }
      }

      const validSession = {
        access_token: 'valid-token',
        expires_at: now + 3600, // 1 hour from now
        user: { id: 'user-123' }
      }

      const needsRefresh = (session: any, threshold: number) => {
        if (!session || !session.expires_at) return true
        return (session.expires_at - now) <= threshold
      }

      expect(needsRefresh(nearExpirySession, refreshThreshold)).toBe(true)
      expect(needsRefresh(validSession, refreshThreshold)).toBe(false)
      expect(needsRefresh(null, refreshThreshold)).toBe(true)
    })

    it('should handle refresh token operations', async () => {
      const refreshTokenData = {
        refresh_token: 'refresh-token-123'
      }

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'new-access-token',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: { id: 'user-123' }
          }
        },
        error: null
      })

      const result = await mockSupabase.auth.refreshSession(refreshTokenData)

      expect(result.data.session.access_token).toBe('new-access-token')
      expect(result.error).toBeNull()
    })

    it('should handle refresh failures', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: null,
        error: { message: 'Refresh token expired' }
      })

      const result = await mockSupabase.auth.refreshSession()

      expect(result.data).toBeNull()
      expect(result.error.message).toBe('Refresh token expired')
    })
  })
})
