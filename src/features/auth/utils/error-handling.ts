// Simplified auth error handling - keeps functionality, reduces complexity

export type AuthErrorType =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'RATE_LIMITED'
  | 'CAPTCHA_FAILED'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'CSRF_ERROR'
  | 'PERMISSION_DENIED'
  | 'SESSION_EXPIRED'
  | 'UNKNOWN_ERROR'

export interface AuthError {
  type: AuthErrorType
  message: string
  userMessage: string
  retryable: boolean
  severity?: 'low' | 'medium' | 'high' // Optional for backward compatibility
}

/**
 * Categorize Supabase auth errors into user-friendly messages
 */
export function categorizeAuthError(error: any): AuthError {
  // Handle null/undefined
  if (!error) {
    return {
      type: 'UNKNOWN_ERROR',
      message: 'Unknown error',
      userMessage: 'An unexpected error occurred. Please try again.',
      retryable: true
    }
  }

  const errorMessage = error?.message?.toLowerCase() || ''
  const errorCode = error?.code?.toLowerCase() || ''

  // Invalid credentials
  if (errorMessage.includes('invalid login credentials') || 
      errorMessage.includes('invalid email or password')) {
    return {
      type: 'INVALID_CREDENTIALS',
      message: error.message,
      userMessage: 'Invalid email or password. Please try again.',
      retryable: false
    }
  }

  // Email not confirmed
  if (errorMessage.includes('email not confirmed')) {
    return {
      type: 'EMAIL_NOT_CONFIRMED',
      message: error.message,
      userMessage: 'Please check your email and click the verification link.',
      retryable: false
    }
  }

  // Rate limiting
  if (errorMessage.includes('rate limit') || 
      errorMessage.includes('too many requests') ||
      errorCode.includes('rate_limit')) {
    return {
      type: 'RATE_LIMITED',
      message: error.message,
      userMessage: 'Too many attempts. Please wait a few minutes and try again.',
      retryable: true
    }
  }

  // CAPTCHA errors
  if (errorMessage.includes('captcha') || errorCode === 'captcha_failed') {
    let userMessage = 'Security verification failed. Please try again.'
    
    if (errorMessage.includes('timeout-or-duplicate')) {
      userMessage = 'Security verification expired. Please wait a few seconds and try again.'
    } else if (errorMessage.includes('invalid-input-response')) {
      userMessage = 'Security verification failed. Please refresh the page and try again.'
    } else if (errorMessage.includes('missing-input-response')) {
      userMessage = 'Please complete the security verification before continuing.'
    }

    return {
      type: 'CAPTCHA_FAILED',
      message: error.message,
      userMessage,
      retryable: true
    }
  }

  // Network errors
  if (errorMessage.includes('network') || 
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection')) {
    return {
      type: 'NETWORK_ERROR',
      message: error.message,
      userMessage: 'Network error. Please check your connection and try again.',
      retryable: true
    }
  }

  // Server errors (5xx)
  if (error?.status >= 500 || errorCode.startsWith('5') || errorMessage.includes('server error')) {
    return {
      type: 'SERVER_ERROR',
      message: error.message,
      userMessage: 'Server error. Please try again in a few moments.',
      retryable: true,
      severity: 'high'
    }
  }

  // CSRF / Security errors
  if (errorMessage.includes('csrf') ||
      errorMessage.includes('security validation failed') ||
      error?.status === 403) {
    return {
      type: 'CSRF_ERROR',
      message: error.message || 'Security validation failed',
      userMessage: 'Please log in again to continue.',
      retryable: true,
      severity: 'low'
    }
  }

  // Permission denied
  if (errorMessage.includes('permission denied') ||
      errorMessage.includes('forbidden')) {
    return {
      type: 'PERMISSION_DENIED',
      message: error.message,
      userMessage: 'You do not have permission to perform this action.',
      retryable: false,
      severity: 'medium'
    }
  }

  // Session expired
  if (errorMessage.includes('session expired') ||
      errorMessage.includes('token expired') ||
      errorMessage.includes('jwt expired')) {
    return {
      type: 'SESSION_EXPIRED',
      message: error.message,
      userMessage: 'Your session has expired. Please log in again.',
      retryable: false,
      severity: 'medium'
    }
  }

  // Default unknown error
  return {
    type: 'UNKNOWN_ERROR',
    message: error.message || 'Unknown error',
    userMessage: 'An unexpected error occurred. Please try again.',
    retryable: true,
    severity: 'medium'
  }
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: any): string {
  return categorizeAuthError(error).userMessage
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  return categorizeAuthError(error).retryable
}

/**
 * Get error severity
 */
export function getErrorSeverity(error: any): 'low' | 'medium' | 'high' {
  return categorizeAuthError(error).severity || 'medium'
}

/**
 * Handle auth conflicts gracefully by clearing state and redirecting to login
 */
export function handleAuthConflict(message?: string): void {
  if (typeof window !== 'undefined') {
    // Clear any existing auth state
    localStorage.removeItem('supabase.auth.token')
    sessionStorage.clear()

    // Clear any auth cookies by setting them to expire
    document.cookie.split(";").forEach(function(c) {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // Redirect to login with a friendly message
    const redirectMessage = message || 'Please log in again to continue'
    window.location.href = `/login?message=${encodeURIComponent(redirectMessage)}`
  }
}

/**
 * Check if an error is an auth conflict that should trigger a redirect
 */
export function isAuthConflictError(error: any): boolean {
  if (!error) return false

  const authError = categorizeAuthError(error)
  return authError.type === 'CSRF_ERROR' ||
         authError.message.includes('csrf') ||
         authError.message.includes('security validation failed') ||
         authError.message.includes('session conflict') ||
         authError.message.includes('authentication conflict')
}

