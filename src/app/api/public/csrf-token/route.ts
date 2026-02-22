// src/app/api/public/csrf-token/route.ts
import { NextResponse } from 'next/server'
import { getCSRFToken } from '@/features/auth/utils/csrf-protection'
import { withRateLimit, generalAPIRateLimiter } from '@/shared/utils/api/api-rate-limiter'

/**
 * @swagger
 * /api/public/csrf-token:
 *   get:
 *     summary: Get CSRF token
 *     description: Generate and retrieve a CSRF token for protecting against cross-site request forgery attacks. Token is not cached and should be refreshed for each sensitive operation.
 *     tags:
 *       - Public - Security
 *     responses:
 *       200:
 *         description: Successfully generated CSRF token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   description: CSRF token to include in subsequent requests
 *                   example: "abc123def456..."
 *                 success:
 *                   type: boolean
 *                   example: true
 *         headers:
 *           Cache-Control:
 *             schema:
 *               type: string
 *               example: no-store, no-cache, must-revalidate, proxy-revalidate
 *           Pragma:
 *             schema:
 *               type: string
 *               example: no-cache
 *           Expires:
 *             schema:
 *               type: string
 *               example: "0"
 *       429:
 *         description: Too many requests - rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Rate limit exceeded
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to generate CSRF token
 *                 success:
 *                   type: boolean
 *                   example: false
 */

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
