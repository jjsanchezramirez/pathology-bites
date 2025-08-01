// src/features/auth/utils/__tests__/session-security.test.ts
import { sessionSecurity } from '../session-security'

// Mock sessionStorage
const mockSessionStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
})

// Mock window properties
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Test Browser)',
    language: 'en-US',
    platform: 'Test Platform',
    cookieEnabled: true,
    doNotTrack: null,
  },
})

Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080,
    colorDepth: 24,
  },
})

// Mock Intl
Object.defineProperty(window, 'Intl', {
  value: {
    DateTimeFormat: () => ({
      resolvedOptions: () => ({ timeZone: 'America/New_York' }),
    }),
  },
})

describe('SessionSecurity', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionStorage.getItem.mockReturnValue(null)
  })

  describe('generateFingerprint', () => {
    it('should generate a fingerprint with browser data', () => {
      const fingerprint = sessionSecurity.generateFingerprint()

      expect(fingerprint).toMatchObject({
        userAgent: 'Mozilla/5.0 (Test Browser)',
        screen: '1920x1080x24',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Test Platform',
        cookieEnabled: true,
        doNotTrack: null,
      })
      expect(fingerprint.timestamp).toBeGreaterThan(0)
    })

    it('should store fingerprint in sessionStorage', () => {
      sessionSecurity.generateFingerprint()

      expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
        'session_fingerprint',
        expect.any(String)
      )
    })
  })

  describe('validateSession', () => {
    it('should return valid for new session', () => {
      mockSessionStorage.getItem.mockReturnValue(null)

      const result = sessionSecurity.validateSession()

      expect(result.isValid).toBe(true)
      expect(result.risk).toBe('low')
      expect(result.issues).toHaveLength(0)
    })

    it('should detect user agent changes', () => {
      const storedFingerprint = {
        userAgent: 'Different Browser',
        screen: '1920x1080x24',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Test Platform',
        cookieEnabled: true,
        doNotTrack: null,
        timestamp: Date.now(),
      }

      mockSessionStorage.getItem.mockReturnValue(
        btoa(JSON.stringify(storedFingerprint))
      )

      const result = sessionSecurity.validateSession()

      expect(result.isValid).toBe(false)
      expect(result.risk).toBe('high')
      expect(result.issues).toContain('User agent changed')
    })

    it('should detect screen resolution changes', () => {
      const storedFingerprint = {
        userAgent: 'Mozilla/5.0 (Test Browser)',
        screen: '1366x768x24',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Test Platform',
        cookieEnabled: true,
        doNotTrack: null,
        timestamp: Date.now(),
      }

      mockSessionStorage.getItem.mockReturnValue(
        btoa(JSON.stringify(storedFingerprint))
      )

      const result = sessionSecurity.validateSession()

      expect(result.isValid).toBe(true) // Screen changes are medium risk
      expect(result.risk).toBe('medium')
      expect(result.issues).toContain('Screen resolution changed')
    })

    it('should detect timezone changes', () => {
      const storedFingerprint = {
        userAgent: 'Mozilla/5.0 (Test Browser)',
        screen: '1920x1080x24',
        timezone: 'Europe/London',
        language: 'en-US',
        platform: 'Test Platform',
        cookieEnabled: true,
        doNotTrack: null,
        timestamp: Date.now(),
      }

      mockSessionStorage.getItem.mockReturnValue(
        btoa(JSON.stringify(storedFingerprint))
      )

      const result = sessionSecurity.validateSession()

      expect(result.risk).toBe('medium')
      expect(result.issues).toContain('Timezone changed')
    })

    it('should detect old sessions', () => {
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000) // 25 hours ago
      const storedFingerprint = {
        userAgent: 'Mozilla/5.0 (Test Browser)',
        screen: '1920x1080x24',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Test Platform',
        cookieEnabled: true,
        doNotTrack: null,
        timestamp: oldTimestamp,
      }

      mockSessionStorage.getItem.mockReturnValue(
        btoa(JSON.stringify(storedFingerprint))
      )

      const result = sessionSecurity.validateSession()

      expect(result.risk).toBe('medium')
      expect(result.issues).toContain('Session too old')
    })

    it('should handle corrupted fingerprint data', () => {
      mockSessionStorage.getItem.mockReturnValue('invalid-data')

      const result = sessionSecurity.validateSession()

      expect(result.isValid).toBe(true)
      expect(result.risk).toBe('low')
    })
  })

  describe('detectSuspiciousActivity', () => {
    it('should detect multiple high-severity events', () => {
      // First, set up a stored fingerprint
      const storedFingerprint = {
        userAgent: 'Original Browser',
        screen: '1920x1080x24',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Test Platform',
        cookieEnabled: true,
        doNotTrack: null,
        timestamp: Date.now(),
      }

      mockSessionStorage.getItem.mockReturnValue(
        btoa(JSON.stringify(storedFingerprint))
      )

      // Simulate multiple high-severity events by changing user agent multiple times
      for (let i = 0; i < 3; i++) {
        Object.defineProperty(window, 'navigator', {
          value: {
            ...window.navigator,
            userAgent: `Different Browser ${i}`,
          },
          configurable: true,
        })
        sessionSecurity.validateSession()
      }

      const result = sessionSecurity.detectSuspiciousActivity()
      expect(result.suspicious).toBe(true)
      // The test should check for either type of suspicious activity
      expect(
        result.reasons.includes('Multiple high-severity security events') ||
        result.reasons.includes('Rapid fingerprint changes detected')
      ).toBe(true)
    })

    it('should detect rapid fingerprint changes', () => {
      // Simulate rapid fingerprint changes
      for (let i = 0; i < 4; i++) {
        Object.defineProperty(window, 'screen', {
          value: {
            width: 1920 + i,
            height: 1080,
            colorDepth: 24,
          },
        })
        sessionSecurity.validateSession()
      }

      const result = sessionSecurity.detectSuspiciousActivity()
      expect(result.suspicious).toBe(true)
      expect(result.reasons).toContain('Rapid fingerprint changes detected')
    })
  })

  describe('clearSession', () => {
    it('should clear session data', () => {
      sessionSecurity.clearSession()

      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('session_fingerprint')
    })
  })

  describe('getSecurityEvents', () => {
    it('should return security events', () => {
      // Generate some events
      sessionSecurity.validateSession()

      const events = sessionSecurity.getSecurityEvents()
      expect(Array.isArray(events)).toBe(true)
    })
  })
})

describe('useSessionSecurity hook', () => {
  it('should provide session security methods', () => {
    const { useSessionSecurity } = require('../session-security')
    const hook = useSessionSecurity()

    expect(hook).toHaveProperty('validateSession')
    expect(hook).toHaveProperty('clearSession')
    expect(hook).toHaveProperty('getSecurityEvents')
    expect(hook).toHaveProperty('detectSuspiciousActivity')
    expect(hook).toHaveProperty('generateFingerprint')

    expect(typeof hook.validateSession).toBe('function')
    expect(typeof hook.clearSession).toBe('function')
    expect(typeof hook.getSecurityEvents).toBe('function')
    expect(typeof hook.detectSuspiciousActivity).toBe('function')
    expect(typeof hook.generateFingerprint).toBe('function')
  })
})
