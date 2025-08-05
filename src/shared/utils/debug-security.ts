// src/shared/utils/debug-security.ts
/**
 * Environment-aware security utilities for debug panel access control
 * Ensures debug functionality is completely inaccessible in production
 */

import React from 'react'

// User role type definition
type UserRole = 'admin' | 'creator' | 'reviewer' | 'user'

// Build-time compilation flags
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production'

const STAGING_DEBUG_ENABLED = process.env.NODE_ENV === 'development' || 
                             process.env.VERCEL_ENV === 'preview' ||
                             process.env.NEXT_PUBLIC_ENABLE_STAGING_DEBUG === 'true'

/**
 * Runtime environment checks for debug panel access
 */
export class DebugSecurity {
  /**
   * Check if debug panel should be available at all
   * Returns false in production to ensure complete isolation
   */
  static isDebugEnvironment(): boolean {
    // Compile-time check - this will be optimized out in production builds
    if (!DEBUG_ENABLED) {
      return false
    }

    // Runtime environment check
    const nodeEnv = process.env.NODE_ENV
    const vercelEnv = process.env.VERCEL_ENV
    
    // Never allow in production
    if (nodeEnv === 'production' && vercelEnv === 'production') {
      return false
    }

    // Allow in development
    if (nodeEnv === 'development') {
      return true
    }

    // Allow in staging/preview if explicitly enabled
    if (STAGING_DEBUG_ENABLED && (vercelEnv === 'preview' || vercelEnv === 'development')) {
      return true
    }

    return false
  }

  /**
   * Check if user has permission to access debug panel
   */
  static hasDebugAccess(userRole?: UserRole | null): boolean {
    if (!this.isDebugEnvironment()) {
      return false
    }

    // In development, allow admin access only
    if (process.env.NODE_ENV === 'development') {
      return userRole === 'admin'
    }

    // In staging, allow admin and creator access
    return userRole === 'admin' || userRole === 'creator'
  }

  /**
   * Get debug access level based on user role
   */
  static getDebugAccessLevel(userRole?: UserRole | null): 'none' | 'read' | 'write' | 'admin' {
    if (!this.hasDebugAccess(userRole)) {
      return 'none'
    }

    switch (userRole) {
      case 'admin':
        return 'admin' // Full access to all debug features
      case 'creator':
        return 'write' // Can modify some settings, impersonate users
      case 'reviewer':
        return 'read'  // Read-only access to debug info
      default:
        return 'none'
    }
  }

  /**
   * Validate debug API access
   */
  static validateDebugApiAccess(userRole?: UserRole | null): {
    allowed: boolean
    reason?: string
  } {
    if (!this.isDebugEnvironment()) {
      return {
        allowed: false,
        reason: 'Debug functionality is not available in this environment'
      }
    }

    if (!this.hasDebugAccess(userRole)) {
      return {
        allowed: false,
        reason: 'Insufficient permissions for debug access'
      }
    }

    return { allowed: true }
  }

  /**
   * Get redacted environment info for debug display
   */
  static getRedactedEnvInfo(): Record<string, string> {
    if (!this.isDebugEnvironment()) {
      return {}
    }

    const envInfo: Record<string, string> = {
      NODE_ENV: process.env.NODE_ENV || 'unknown',
      VERCEL_ENV: process.env.VERCEL_ENV || 'unknown',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'unknown',
      NEXT_PUBLIC_COMING_SOON_MODE: process.env.NEXT_PUBLIC_COMING_SOON_MODE || 'false',
      NEXT_PUBLIC_MAINTENANCE_MODE: process.env.NEXT_PUBLIC_MAINTENANCE_MODE || 'false',
    }

    // Add redacted sensitive info
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      envInfo.SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) + '...'
    }

    if (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      envInfo.GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID.substring(0, 10) + '...'
    }

    return envInfo
  }

  /**
   * Generate debug session token for API access
   */
  static generateDebugToken(userRole: UserRole): string {
    if (!this.hasDebugAccess(userRole)) {
      throw new Error('Unauthorized debug access')
    }

    const payload = {
      role: userRole,
      accessLevel: this.getDebugAccessLevel(userRole),
      timestamp: Date.now(),
      env: process.env.NODE_ENV
    }

    // Simple token for debug purposes (not for production security)
    return Buffer.from(JSON.stringify(payload)).toString('base64')
  }

  /**
   * Validate debug session token
   */
  static validateDebugToken(token: string): {
    valid: boolean
    payload?: any
    reason?: string
  } {
    try {
      const payload = JSON.parse(Buffer.from(token, 'base64').toString())
      
      // Check if token is too old (1 hour expiry)
      if (Date.now() - payload.timestamp > 3600000) {
        return {
          valid: false,
          reason: 'Debug token expired'
        }
      }

      // Validate environment matches
      if (payload.env !== process.env.NODE_ENV) {
        return {
          valid: false,
          reason: 'Debug token environment mismatch'
        }
      }

      return {
        valid: true,
        payload
      }
    } catch (error) {
      return {
        valid: false,
        reason: 'Invalid debug token format'
      }
    }
  }
}

/**
 * Debug panel route guard for Next.js pages
 */
export function withDebugSecurity(
  Component: React.ComponentType
): React.ComponentType {
  const DebugSecuredComponent: React.ComponentType = (props) => {
    // This check will be optimized out in production builds
    if (!DebugSecurity.isDebugEnvironment()) {
      // Return null or 404 component in production
      return null
    }

    return React.createElement(Component, props)
  }

  DebugSecuredComponent.displayName = `withDebugSecurity(${Component.displayName || Component.name})`

  return DebugSecuredComponent
}

/**
 * Debug API route guard for Next.js API routes
 */
export function withDebugApiSecurity(
  handler: (req: Request) => Promise<Response>
) {
  return async function debugSecuredApiHandler(req: Request) {
    const validation = DebugSecurity.validateDebugApiAccess()
    
    if (!validation.allowed) {
      return new Response(
        JSON.stringify({ error: validation.reason }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return handler(req)
  }
}

// Export constants for use in other modules
export const DEBUG_CONSTANTS = {
  DEBUG_ENABLED,
  STAGING_DEBUG_ENABLED,
  MAX_TOKEN_AGE: 3600000, // 1 hour
  ALLOWED_ENVIRONMENTS: ['development', 'preview'],
  REQUIRED_ROLES: ['admin', 'creator'] as UserRole[]
} as const
