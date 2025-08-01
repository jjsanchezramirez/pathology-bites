// src/app/api/csrf-token/route.ts
import { NextResponse } from 'next/server'
import { getCSRFToken } from '@/features/auth/utils/csrf-protection'
import { withRateLimit, generalAPIRateLimiter } from '@/shared/utils/api-rate-limiter'

const rateLimitedHandler = withRateLimit(generalAPIRateLimiter)

export const GET = rateLimitedHandler(async function() {
  try {
    const token = await getCSRFToken()
    
    return NextResponse.json({ 
      token,
      success: true 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('CSRF token generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate CSRF token',
        success: false 
      },
      { status: 500 }
    )
  }
})
