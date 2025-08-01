// src/features/auth/utils/session-security.ts
'use client'

// Re-export from the auth services
export {
  sessionSecurity,
  SessionSecurity,
  type SecurityFingerprint,
  type SecurityEvent,
  type SessionData,
  type RiskAssessment
} from '@/features/auth/services/session-security'

// Backward compatibility hook for existing code
export function useSessionSecurity() {
  const { sessionSecurity } = require('@/features/auth/services/session-security')

  const validateCurrentSession = (session?: any) => {
    if (session) {
      return sessionSecurity.validateSessionSecurity(session)
    }
    // Legacy behavior - return safe defaults
    return { isValid: true, risk: 'low', issues: [] }
  }

  const clearSessionData = () => sessionSecurity.clearSessionData()
  const generateFingerprint = () => sessionSecurity.generateFingerprint()

  return {
    validateSession: validateCurrentSession,
    clearSession: clearSessionData,
    generateFingerprint
  }
}




