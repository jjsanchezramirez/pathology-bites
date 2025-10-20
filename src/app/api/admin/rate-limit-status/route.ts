// src/app/api/admin/rate-limit-status/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { loginRateLimiter, getClientIP } from '@/features/auth/utils/rate-limiter'

export async function GET(request: NextRequest) {
  try {
    // Auth is now handled by middleware

    // Get current client IP
    const clientIP = getClientIP(request)
    const currentAttempts = loginRateLimiter.getAttempts(clientIP, 'login')
    
    // Check if currently rate limited
    const rateLimitResult = loginRateLimiter.checkLimit(clientIP, 'login')
    
    // Get current configuration
    const maxAttempts = parseInt(process.env.AUTH_RATE_LIMIT_ATTEMPTS || '5')
    const windowMinutes = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MINUTES || '15')
    const blockMinutesDev = parseInt(process.env.AUTH_RATE_LIMIT_BLOCK_MINUTES_DEV || '2')
    const blockMinutesProd = parseInt(process.env.AUTH_RATE_LIMIT_BLOCK_MINUTES_PROD || '10')
    const blockMinutes = process.env.NODE_ENV === 'development' ? blockMinutesDev : blockMinutesProd

    return NextResponse.json({
      clientIP,
      currentAttempts,
      maxAttempts,
      isRateLimited: !rateLimitResult.allowed,
      retryAfterMs: rateLimitResult.retryAfter || 0,
      retryAfterMinutes: rateLimitResult.retryAfter ? Math.ceil(rateLimitResult.retryAfter / (1000 * 60)) : 0,
      windowMs: windowMinutes * 60 * 1000,
      windowMinutes,
      blockDurationMs: blockMinutes * 60 * 1000,
      blockMinutes,
      environment: process.env.NODE_ENV,
      config: {
        maxAttempts,
        windowMinutes,
        blockMinutesDev,
        blockMinutesProd,
        currentBlockMinutes: blockMinutes
      }
    })
  } catch (error) {
    console.error('Rate limit status error:', error)
    return NextResponse.json(
      { error: 'Failed to get rate limit status' },
      { status: 500 }
    )
  }
}
