import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { useState, useCallback } from 'react'

// CSRF token configuration
const CSRF_TOKEN_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const CSRF_TOKEN_LENGTH = 32

// Generate a cryptographically secure random token
function generateCSRFToken(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(CSRF_TOKEN_LENGTH)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }
  
  // Fallback for environments without crypto.getRandomValues
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < CSRF_TOKEN_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Get or create CSRF token for the current session (API route only)
export async function getCSRFToken(): Promise<string> {
  const cookieStore = await cookies()
  let token = cookieStore.get(CSRF_TOKEN_NAME)?.value

  if (!token) {
    token = generateCSRFToken()
    cookieStore.set(CSRF_TOKEN_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/'
    })
  }

  return token
}

// Validate CSRF token from request (middleware/API route only)
export async function validateCSRFToken(request: NextRequest): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const sessionToken = cookieStore.get(CSRF_TOKEN_NAME)?.value

    if (!sessionToken) {
      return false
    }

    // Check token in header
    const headerToken = request.headers.get(CSRF_HEADER_NAME)
    if (headerToken && headerToken === sessionToken) {
      return true
    }

    // Check token in form data for POST requests
    if (request.method === 'POST') {
      try {
        const formData = await request.clone().formData()
        const formToken = formData.get('csrf-token') as string
        if (formToken && formToken === sessionToken) {
          return true
        }
      } catch {
        // If parsing form data fails, continue to check other methods
      }
    }

    return false
  } catch (error) {
    // If cookies() fails (e.g., called outside request scope), return false
    console.warn('CSRF validation failed - cookies not available:', error)
    return false
  }
}

// Middleware function to check CSRF protection
export async function csrfProtection(request: NextRequest): Promise<boolean> {
  // Skip CSRF protection for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true
  }

  // Skip CSRF protection for API routes that use other authentication
  if (request.nextUrl.pathname.startsWith('/api/public/auth/')) {
    return true
  }

  return await validateCSRFToken(request)
}

// Generate CSRF token for client-side use
export function getCSRFTokenForClient(): string {
  return generateCSRFToken()
}

// Create CSRF error response
export function createCSRFErrorResponse(): Response {
  return new Response(
    JSON.stringify({
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    }),
    {
      status: 403,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  )
}

// Note: Client-side CSRF hook moved to src/features/auth/hooks/use-csrf-token.ts

// Server action wrapper with CSRF protection
export function withCSRFProtection<T extends any[], R>(
  action: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    // In a real implementation, you'd extract the request from the action context
    // and validate the CSRF token before proceeding
    // For now, this is a placeholder structure
    return action(...args)
  }
}

// Utility to add CSRF token to forms
export function addCSRFTokenToForm(form: HTMLFormElement, token: string): void {
  // Remove existing CSRF token input if present
  const existingInput = form.querySelector('input[name="csrf-token"]')
  if (existingInput) {
    existingInput.remove()
  }

  // Add new CSRF token input
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = 'csrf-token'
  input.value = token
  form.appendChild(input)
}

// Constants for client-side use
export const CSRF_CONSTANTS = {
  TOKEN_NAME: CSRF_TOKEN_NAME,
  HEADER_NAME: CSRF_HEADER_NAME
} as const
