import { createClient } from '@/shared/services/server'
import { User, Session } from '@supabase/supabase-js'

// Session validation result
export interface SessionValidationResult {
  isValid: boolean
  user: User | null
  session: Session | null
  error?: string
  requiresRefresh?: boolean
}

// Session security checks
interface SecurityCheck {
  name: string
  check: (session: Session, user: User, request?: Request) => Promise<boolean>
  severity: 'low' | 'medium' | 'high'
}

// IP address validation
async function validateIPAddress(session: Session, user: User, request?: Request): Promise<boolean> {
  if (!request) return true
  
  const currentIP = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
  
  // In a production environment, you might want to store and validate
  // the IP address from the session creation
  // For now, we'll just log suspicious IP changes
  
  const sessionIP = session.user?.user_metadata?.last_ip
  if (sessionIP && sessionIP !== currentIP.split(',')[0].trim()) {
    console.log('Security: IP address change detected', {
      reason: 'IP address change',
      previous_ip: sessionIP,
      current_ip: currentIP,
      user_id: user.id
    })
  }
  
  return true
}

// User agent validation
async function validateUserAgent(session: Session, user: User, request?: Request): Promise<boolean> {
  if (!request) return true
  
  const currentUA = request.headers.get('user-agent') || 'unknown'
  const sessionUA = session.user?.user_metadata?.last_user_agent
  
  if (sessionUA && sessionUA !== currentUA) {
    console.log('Security: User agent change detected', {
      reason: 'User agent change',
      previous_ua: sessionUA,
      current_ua: currentUA,
      user_id: user.id
    })
  }
  
  return true
}

// Session age validation
async function validateSessionAge(session: Session, user: User): Promise<boolean> {
  const maxSessionAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
  const sessionCreated = new Date(session.user?.created_at || 0).getTime()
  const now = Date.now()
  
  if (now - sessionCreated > maxSessionAge) {
    console.log('Security: Session expired due to age', {
      reason: 'Session too old',
      session_age: now - sessionCreated,
      max_age: maxSessionAge,
      user_id: user.id
    })
    return false
  }
  
  return true
}

// Account status validation
async function validateAccountStatus(session: Session, user: User): Promise<boolean> {
  try {
    const supabase = await createClient()
    
    const { data: userData, error } = await supabase
      .from('users')
      .select('status, role')
      .eq('id', user.id)
      .single()
    
    if (error) {
      console.error('Error checking user status:', error)
      return false
    }
    
    if (userData?.status !== 'active') {
      console.log('Security: Inactive account access attempt', {
        reason: 'Inactive account access attempt',
        account_status: userData?.status,
        user_id: user.id
      })
      return false
    }
    
    return true
  } catch (error) {
    console.error('Error validating account status:', error)
    return false
  }
}

// Security checks configuration
const securityChecks: SecurityCheck[] = [
  {
    name: 'ip_validation',
    check: validateIPAddress,
    severity: 'medium'
  },
  {
    name: 'user_agent_validation',
    check: validateUserAgent,
    severity: 'low'
  },
  {
    name: 'session_age_validation',
    check: validateSessionAge,
    severity: 'high'
  },
  {
    name: 'account_status_validation',
    check: validateAccountStatus,
    severity: 'high'
  }
]

// Main session validator class
export class SessionValidator {
  private enabledChecks: Set<string>
  
  constructor(enabledChecks?: string[]) {
    this.enabledChecks = new Set(enabledChecks || securityChecks.map(check => check.name))
  }

  async validateSession(request?: Request): Promise<SessionValidationResult> {
    try {
      const supabase = await createClient()
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        console.log('Security: Session error', {
          reason: 'Session error',
          error: sessionError.message
        })

        return {
          isValid: false,
          user: null,
          session: null,
          error: sessionError.message
        }
      }
      
      if (!session) {
        return {
          isValid: false,
          user: null,
          session: null,
          error: 'No session found'
        }
      }
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.log('Security: User not found', {
          reason: 'User not found',
          error: userError?.message
        })

        return {
          isValid: false,
          user: null,
          session: null,
          error: userError?.message || 'User not found'
        }
      }
      
      // Run security checks
      const failedChecks: string[] = []
      
      for (const check of securityChecks) {
        if (!this.enabledChecks.has(check.name)) {
          continue
        }
        
        try {
          const passed = await check.check(session, user, request)
          if (!passed) {
            failedChecks.push(check.name)
            
            if (check.severity === 'high') {
              // High severity failures invalidate the session immediately
              return {
                isValid: false,
                user: null,
                session: null,
                error: `Security check failed: ${check.name}`
              }
            }
          }
        } catch (error) {
          console.error(`Security check ${check.name} failed:`, error)
          failedChecks.push(check.name)
        }
      }
      
      // Log failed checks
      if (failedChecks.length > 0) {
        console.log('Security: Security checks failed', {
          reason: 'Security checks failed',
          failed_checks: failedChecks,
          user_id: user.id
        })
      }
      
      // Check if session needs refresh
      const expiresAt = session.expires_at
      const now = Math.floor(Date.now() / 1000)
      const refreshThreshold = 5 * 60 // 5 minutes before expiry
      
      const requiresRefresh = expiresAt ? (expiresAt - now) < refreshThreshold : false
      
      return {
        isValid: true,
        user,
        session,
        requiresRefresh
      }
      
    } catch (error) {
      console.error('Session validation error:', error)

      console.log('Security: Session validation error', {
        reason: 'Validation error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return {
        isValid: false,
        user: null,
        session: null,
        error: 'Session validation failed'
      }
    }
  }

  async refreshSession(): Promise<SessionValidationResult> {
    try {
      const supabase = await createClient()
      
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error || !data.session) {
        console.log('Security: Session refresh failed', {
          reason: 'Session refresh failed',
          error: error?.message
        })

        return {
          isValid: false,
          user: null,
          session: null,
          error: error?.message || 'Session refresh failed'
        }
      }

      console.log('Security: Session refreshed', {
        user_id: data.user?.id
      })
      
      return {
        isValid: true,
        user: data.user,
        session: data.session
      }
      
    } catch (error) {
      console.error('Session refresh error:', error)
      return {
        isValid: false,
        user: null,
        session: null,
        error: 'Session refresh failed'
      }
    }
  }
}

// Export default validator instance
export const sessionValidator = new SessionValidator()

// Convenience functions
export const validateCurrentSession = (request?: Request) => 
  sessionValidator.validateSession(request)

export const refreshCurrentSession = () => 
  sessionValidator.refreshSession()
