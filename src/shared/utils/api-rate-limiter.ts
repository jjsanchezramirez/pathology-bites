// API Rate Limiting Utility for Server-Side Routes
import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

interface RateLimitEntry {
  requests: number
  windowStart: number
  successfulRequests: number
  failedRequests: number
}

class APIRateLimiter {
  private attempts = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    }
  }

  private getKey(identifier: string, endpoint: string): string {
    return `${identifier}:${endpoint}`
  }

  private isWithinWindow(entry: RateLimitEntry): boolean {
    return Date.now() - entry.windowStart < this.config.windowMs
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, entry] of this.attempts.entries()) {
      if (now - entry.windowStart >= this.config.windowMs) {
        this.attempts.delete(key)
      }
    }
  }

  checkLimit(identifier: string, endpoint: string): { 
    allowed: boolean
    remaining: number
    resetTime: number
    total: number
  } {
    this.cleanupExpiredEntries()
    
    const key = this.getKey(identifier, endpoint)
    const entry = this.attempts.get(key)
    const now = Date.now()

    if (!entry) {
      // First request
      this.attempts.set(key, {
        requests: 1,
        windowStart: now,
        successfulRequests: 0,
        failedRequests: 0
      })
      return { 
        allowed: true, 
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
        total: this.config.maxRequests
      }
    }

    // Check if we need to reset the window
    if (!this.isWithinWindow(entry)) {
      entry.requests = 1
      entry.windowStart = now
      entry.successfulRequests = 0
      entry.failedRequests = 0
      return { 
        allowed: true, 
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs,
        total: this.config.maxRequests
      }
    }

    // Increment requests
    entry.requests++

    // Check if limit exceeded
    if (entry.requests > this.config.maxRequests) {
      return { 
        allowed: false, 
        remaining: 0,
        resetTime: entry.windowStart + this.config.windowMs,
        total: this.config.maxRequests
      }
    }

    return { 
      allowed: true, 
      remaining: this.config.maxRequests - entry.requests,
      resetTime: entry.windowStart + this.config.windowMs,
      total: this.config.maxRequests
    }
  }

  recordResult(identifier: string, endpoint: string, success: boolean): void {
    const key = this.getKey(identifier, endpoint)
    const entry = this.attempts.get(key)
    
    if (entry) {
      if (success) {
        entry.successfulRequests++
      } else {
        entry.failedRequests++
      }
    }
  }

  reset(identifier: string, endpoint: string): void {
    const key = this.getKey(identifier, endpoint)
    this.attempts.delete(key)
  }
}

// Helper function to get client IP address
export function getClientIP(request: NextRequest): string {
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

// Pre-configured rate limiters for different API endpoints
export const authRateLimiter = new APIRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 auth requests per 15 minutes
  message: 'Too many authentication attempts, please try again later.'
})

export const generalAPIRateLimiter = new APIRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many API requests, please slow down.'
})

export const adminAPIRateLimiter = new APIRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 200, // 200 admin requests per minute (higher limit)
  message: 'Too many admin API requests, please slow down.'
})

export const quizAPIRateLimiter = new APIRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 50, // 50 quiz requests per minute
  message: 'Too many quiz requests, please slow down.'
})

// Middleware function to apply rate limiting
export function withRateLimit(
  rateLimiter: APIRateLimiter,
  options: { 
    keyGenerator?: (request: NextRequest) => string
    onLimitReached?: (request: NextRequest) => NextResponse
  } = {}
) {
  return function(handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function(request: NextRequest, ...args: any[]): Promise<NextResponse> {
      const identifier = options.keyGenerator ? 
        options.keyGenerator(request) : 
        getClientIP(request)
      
      const endpoint = request.nextUrl.pathname
      const result = rateLimiter.checkLimit(identifier, endpoint)
      
      if (!result.allowed) {
        if (options.onLimitReached) {
          return options.onLimitReached(request)
        }
        
        return NextResponse.json(
          {
            error: 'Too many requests, please try again later.',
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'X-RateLimit-Limit': result.total.toString(),
              'X-RateLimit-Remaining': result.remaining.toString(),
              'X-RateLimit-Reset': result.resetTime.toString(),
              'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString()
            }
          }
        )
      }

      // Add rate limit headers to successful responses
      const response = await handler(request, ...args)
      
      // Record the result
      const success = response.status < 400
      rateLimiter.recordResult(identifier, endpoint, success)
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', result.total.toString())
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      response.headers.set('X-RateLimit-Reset', result.resetTime.toString())
      
      return response
    }
  }
}

// Helper to create user-based rate limiting (for authenticated routes)
export function createUserRateLimiter(config: RateLimitConfig) {
  return withRateLimit(new APIRateLimiter(config), {
    keyGenerator: (request: NextRequest) => {
      // Try to get user ID from headers or use IP as fallback
      const userId = request.headers.get('x-user-id')
      return userId || getClientIP(request)
    }
  })
}
