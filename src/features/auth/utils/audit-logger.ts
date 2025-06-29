import { createClient } from '@/shared/services/server'

// Audit event types
export enum AuditEventType {
  // Authentication events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  SIGNUP_SUCCESS = 'signup_success',
  SIGNUP_FAILURE = 'signup_failure',
  
  // Password events
  PASSWORD_RESET_REQUEST = 'password_reset_request',
  PASSWORD_RESET_SUCCESS = 'password_reset_success',
  PASSWORD_CHANGE = 'password_change',
  
  // Email verification events
  EMAIL_VERIFICATION_SENT = 'email_verification_sent',
  EMAIL_VERIFIED = 'email_verified',
  EMAIL_VERIFICATION_FAILED = 'email_verification_failed',
  
  // OAuth events
  OAUTH_LOGIN_SUCCESS = 'oauth_login_success',
  OAUTH_LOGIN_FAILURE = 'oauth_login_failure',
  
  // Session events
  SESSION_REFRESH = 'session_refresh',
  SESSION_EXPIRED = 'session_expired',
  
  // Security events
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSRF_VIOLATION = 'csrf_violation',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  
  // Account events
  ACCOUNT_LOCKED = 'account_locked',
  ACCOUNT_UNLOCKED = 'account_unlocked',
  ACCOUNT_DELETED = 'account_deleted',
  
  // Admin events
  ADMIN_ACCESS = 'admin_access',
  ADMIN_ACTION = 'admin_action',
  ROLE_CHANGE = 'role_change'
}

// Risk levels for audit events
export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Audit log entry interface
export interface AuditLogEntry {
  id?: string
  event_type: AuditEventType
  user_id?: string
  user_email?: string
  ip_address?: string
  user_agent?: string
  risk_level: RiskLevel
  details: Record<string, any>
  metadata?: Record<string, any>
  created_at?: string
}

// Get risk level for event type
function getRiskLevel(eventType: AuditEventType): RiskLevel {
  const riskMapping: Record<AuditEventType, RiskLevel> = {
    [AuditEventType.LOGIN_SUCCESS]: RiskLevel.LOW,
    [AuditEventType.LOGIN_FAILURE]: RiskLevel.MEDIUM,
    [AuditEventType.LOGOUT]: RiskLevel.LOW,
    [AuditEventType.SIGNUP_SUCCESS]: RiskLevel.LOW,
    [AuditEventType.SIGNUP_FAILURE]: RiskLevel.MEDIUM,
    
    [AuditEventType.PASSWORD_RESET_REQUEST]: RiskLevel.MEDIUM,
    [AuditEventType.PASSWORD_RESET_SUCCESS]: RiskLevel.HIGH,
    [AuditEventType.PASSWORD_CHANGE]: RiskLevel.MEDIUM,
    
    [AuditEventType.EMAIL_VERIFICATION_SENT]: RiskLevel.LOW,
    [AuditEventType.EMAIL_VERIFIED]: RiskLevel.LOW,
    [AuditEventType.EMAIL_VERIFICATION_FAILED]: RiskLevel.MEDIUM,
    
    [AuditEventType.OAUTH_LOGIN_SUCCESS]: RiskLevel.LOW,
    [AuditEventType.OAUTH_LOGIN_FAILURE]: RiskLevel.MEDIUM,
    
    [AuditEventType.SESSION_REFRESH]: RiskLevel.LOW,
    [AuditEventType.SESSION_EXPIRED]: RiskLevel.LOW,
    
    [AuditEventType.RATE_LIMIT_EXCEEDED]: RiskLevel.HIGH,
    [AuditEventType.CSRF_VIOLATION]: RiskLevel.HIGH,
    [AuditEventType.SUSPICIOUS_ACTIVITY]: RiskLevel.CRITICAL,
    
    [AuditEventType.ACCOUNT_LOCKED]: RiskLevel.HIGH,
    [AuditEventType.ACCOUNT_UNLOCKED]: RiskLevel.MEDIUM,
    [AuditEventType.ACCOUNT_DELETED]: RiskLevel.HIGH,
    
    [AuditEventType.ADMIN_ACCESS]: RiskLevel.MEDIUM,
    [AuditEventType.ADMIN_ACTION]: RiskLevel.HIGH,
    [AuditEventType.ROLE_CHANGE]: RiskLevel.HIGH
  }
  
  return riskMapping[eventType] || RiskLevel.MEDIUM
}

// Extract request information
function extractRequestInfo(request?: Request): Partial<AuditLogEntry> {
  if (!request) {
    return {}
  }

  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             request.headers.get('cf-connecting-ip') || 
             'unknown'

  const userAgent = request.headers.get('user-agent') || 'unknown'

  return {
    ip_address: ip.split(',')[0].trim(),
    user_agent: userAgent
  }
}

// Main audit logging class
class AuditLogger {
  private async createAuditTable(): Promise<void> {
    const supabase = await createClient()
    
    // Create audit_logs table if it doesn't exist
    const { error } = await supabase.rpc('create_audit_logs_table')
    
    if (error && !error.message.includes('already exists')) {
      console.error('Failed to create audit_logs table:', error)
    }
  }

  async log(
    eventType: AuditEventType,
    details: Record<string, any>,
    options: {
      userId?: string
      userEmail?: string
      request?: Request
      metadata?: Record<string, any>
      riskLevel?: RiskLevel
    } = {}
  ): Promise<void> {
    try {
      const supabase = await createClient()
      
      const requestInfo = extractRequestInfo(options.request)
      
      const auditEntry: AuditLogEntry = {
        event_type: eventType,
        user_id: options.userId,
        user_email: options.userEmail,
        risk_level: options.riskLevel || getRiskLevel(eventType),
        details,
        metadata: options.metadata,
        ...requestInfo
      }

      const { error } = await supabase
        .from('audit_logs')
        .insert(auditEntry)

      if (error) {
        console.error('Failed to log audit event:', error)
        // Don't throw error to avoid breaking the main flow
      }
    } catch (error) {
      console.error('Audit logging error:', error)
      // Don't throw error to avoid breaking the main flow
    }
  }

  async logAuthEvent(
    eventType: AuditEventType,
    userId: string | null,
    email: string | null,
    success: boolean,
    details: Record<string, any> = {},
    request?: Request
  ): Promise<void> {
    await this.log(eventType, {
      success,
      ...details
    }, {
      userId: userId || undefined,
      userEmail: email || undefined,
      request
    })
  }

  async logSecurityEvent(
    eventType: AuditEventType,
    details: Record<string, any>,
    request?: Request,
    riskLevel: RiskLevel = RiskLevel.HIGH
  ): Promise<void> {
    await this.log(eventType, details, {
      request,
      riskLevel
    })
  }

  async getAuditLogs(
    filters: {
      userId?: string
      eventType?: AuditEventType
      riskLevel?: RiskLevel
      startDate?: Date
      endDate?: Date
      limit?: number
    } = {}
  ): Promise<AuditLogEntry[]> {
    try {
      const supabase = await createClient()
      
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters.userId) {
        query = query.eq('user_id', filters.userId)
      }

      if (filters.eventType) {
        query = query.eq('event_type', filters.eventType)
      }

      if (filters.riskLevel) {
        query = query.eq('risk_level', filters.riskLevel)
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate.toISOString())
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate.toISOString())
      }

      if (filters.limit) {
        query = query.limit(filters.limit)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch audit logs:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching audit logs:', error)
      return []
    }
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger()

// Convenience functions
export const logAuthSuccess = (userId: string, email: string, request?: Request) =>
  auditLogger.logAuthEvent(AuditEventType.LOGIN_SUCCESS, userId, email, true, {}, request)

export const logAuthFailure = (email: string | null, reason: string, request?: Request) =>
  auditLogger.logAuthEvent(AuditEventType.LOGIN_FAILURE, null, email, false, { reason }, request)

export const logSignupSuccess = (userId: string, email: string, request?: Request) =>
  auditLogger.logAuthEvent(AuditEventType.SIGNUP_SUCCESS, userId, email, true, {}, request)

export const logSignupFailure = (email: string | null, reason: string, request?: Request) =>
  auditLogger.logAuthEvent(AuditEventType.SIGNUP_FAILURE, null, email, false, { reason }, request)

export const logRateLimitExceeded = (identifier: string, action: string, request?: Request) =>
  auditLogger.logSecurityEvent(AuditEventType.RATE_LIMIT_EXCEEDED, { identifier, action }, request)

export const logCSRFViolation = (request?: Request) =>
  auditLogger.logSecurityEvent(AuditEventType.CSRF_VIOLATION, {}, request, RiskLevel.CRITICAL)
