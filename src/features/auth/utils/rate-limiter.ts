// Rate limiting utility for authentication endpoints
interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxAttempts: number // Maximum attempts per window
  blockDurationMs: number // How long to block after exceeding limit
}

interface RateLimitEntry {
  attempts: number
  windowStart: number
  blockedUntil?: number
}

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config
  }

  private getKey(identifier: string, action: string): string {
    return `${identifier}:${action}`
  }

  private isWithinWindow(entry: RateLimitEntry): boolean {
    return Date.now() - entry.windowStart < this.config.windowMs
  }

  private isBlocked(entry: RateLimitEntry): boolean {
    return entry.blockedUntil ? Date.now() < entry.blockedUntil : false
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, entry] of this.attempts.entries()) {
      if (!this.isWithinWindow(entry) && !this.isBlocked(entry)) {
        this.attempts.delete(key)
      }
    }
  }

  checkLimit(identifier: string, action: string): { allowed: boolean; retryAfter?: number } {
    this.cleanupExpiredEntries()
    
    const key = this.getKey(identifier, action)
    const entry = this.attempts.get(key)
    const now = Date.now()

    if (!entry) {
      // First attempt
      this.attempts.set(key, {
        attempts: 1,
        windowStart: now
      })
      return { allowed: true }
    }

    // Check if currently blocked
    if (this.isBlocked(entry)) {
      return { 
        allowed: false, 
        retryAfter: entry.blockedUntil! - now 
      }
    }

    // Check if we need to reset the window
    if (!this.isWithinWindow(entry)) {
      entry.attempts = 1
      entry.windowStart = now
      entry.blockedUntil = undefined
      return { allowed: true }
    }

    // Increment attempts
    entry.attempts++

    // Check if limit exceeded
    if (entry.attempts > this.config.maxAttempts) {
      entry.blockedUntil = now + this.config.blockDurationMs
      return { 
        allowed: false, 
        retryAfter: this.config.blockDurationMs 
      }
    }

    return { allowed: true }
  }

  reset(identifier: string, action: string): void {
    const key = this.getKey(identifier, action)
    this.attempts.delete(key)
  }

  getAttempts(identifier: string, action: string): number {
    const key = this.getKey(identifier, action)
    const entry = this.attempts.get(key)
    return entry?.attempts || 0
  }
}

// Rate limiting configuration constants
const RATE_LIMIT_CONFIG = {
  LOGIN: {
    WINDOW_MINUTES: 15,
    MAX_ATTEMPTS: 5,
    BLOCK_MINUTES_DEV: 2,
    BLOCK_MINUTES_PROD: 10,
  }
} as const

// Pre-configured rate limiters for different auth actions
export const loginRateLimiter = new RateLimiter({
  windowMs: RATE_LIMIT_CONFIG.LOGIN.WINDOW_MINUTES * 60 * 1000,
  maxAttempts: RATE_LIMIT_CONFIG.LOGIN.MAX_ATTEMPTS,
  blockDurationMs: process.env.NODE_ENV === 'development'
    ? (RATE_LIMIT_CONFIG.LOGIN.BLOCK_MINUTES_DEV * 60 * 1000)
    : (RATE_LIMIT_CONFIG.LOGIN.BLOCK_MINUTES_PROD * 60 * 1000)
})

export const signupRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 3, // 3 signups per hour
  blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
})

export const passwordResetRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 3, // 3 password reset attempts per hour
  blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
})

export const emailVerificationRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxAttempts: 5, // 5 verification emails per hour
  blockDurationMs: 60 * 60 * 1000 // Block for 1 hour
})

// Helper function to get client IP address
export function getClientIP(request: Request): string {
  // Check various headers for the real IP
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  
  // Fallback to a default if no IP can be determined
  return 'unknown'
}

// Helper function to create rate limit response
export function createRateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil(retryAfter / 1000) // Convert to seconds
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil(retryAfter / 1000).toString()
      }
    }
  )
}
