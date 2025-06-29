// src/features/auth/utils/error-handling.ts

export enum AuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  CSRF_ERROR = 'CSRF_ERROR',
  SECURITY_ERROR = 'SECURITY_ERROR'
}

export interface AuthError {
  type: AuthErrorType
  message: string
  originalError?: Error
  retryable: boolean
  severity: 'low' | 'medium' | 'high'
  userMessage: string
  technicalDetails?: Record<string, any>
}

export class AuthErrorHandler {
  private static instance: AuthErrorHandler
  private errorHistory: AuthError[] = []
  private readonly MAX_HISTORY = 50

  static getInstance(): AuthErrorHandler {
    if (!AuthErrorHandler.instance) {
      AuthErrorHandler.instance = new AuthErrorHandler()
    }
    return AuthErrorHandler.instance
  }

  // Categorize and enhance errors
  categorizeError(error: any): AuthError {
    let authError: AuthError

    // Handle HTTP status errors first (they might also have messages)
    if (error?.status) {
      if (error.status >= 500) {
        authError = {
          type: AuthErrorType.SERVER_ERROR,
          message: 'Server error',
          originalError: error,
          retryable: true,
          severity: 'high',
          userMessage: 'Server is temporarily unavailable. Please try again later.',
          technicalDetails: { httpStatus: error.status }
        }
      } else if (error.status === 429) {
        authError = {
          type: AuthErrorType.RATE_LIMITED,
          message: 'Rate limited',
          originalError: error,
          retryable: true,
          severity: 'low',
          userMessage: 'Too many requests. Please wait and try again.',
          technicalDetails: { httpStatus: error.status }
        }
      } else if (error.status === 403) {
        authError = {
          type: AuthErrorType.PERMISSION_DENIED,
          message: 'Permission denied',
          originalError: error,
          retryable: false,
          severity: 'medium',
          userMessage: 'You do not have permission to perform this action.',
          technicalDetails: { httpStatus: error.status }
        }
      } else {
        authError = {
          type: AuthErrorType.UNKNOWN_ERROR,
          message: `HTTP ${error.status}`,
          originalError: error,
          retryable: false,
          severity: 'medium',
          userMessage: 'An error occurred. Please try again.',
          technicalDetails: { httpStatus: error.status }
        }
      }
    }
    // Handle Supabase auth errors and other message-based errors
    else if (error?.message) {
      const message = error.message.toLowerCase()
      
      if (message.includes('invalid login credentials')) {
        authError = {
          type: AuthErrorType.AUTHENTICATION_FAILED,
          message: 'Invalid email or password',
          originalError: error,
          retryable: false,
          severity: 'medium',
          userMessage: 'Please check your email and password and try again.',
          technicalDetails: { supabaseError: error }
        }
      } else if (message.includes('email not confirmed')) {
        authError = {
          type: AuthErrorType.AUTHENTICATION_FAILED,
          message: 'Email not verified',
          originalError: error,
          retryable: false,
          severity: 'medium',
          userMessage: 'Please check your email and click the verification link.',
          technicalDetails: { supabaseError: error }
        }
      } else if (message.includes('session_not_found') || message.includes('jwt expired')) {
        authError = {
          type: AuthErrorType.SESSION_EXPIRED,
          message: 'Session expired',
          originalError: error,
          retryable: true,
          severity: 'medium',
          userMessage: 'Your session has expired. Please log in again.',
          technicalDetails: { supabaseError: error }
        }
      } else if (message.includes('rate limit') || message.includes('too many requests')) {
        authError = {
          type: AuthErrorType.RATE_LIMITED,
          message: 'Rate limited',
          originalError: error,
          retryable: true,
          severity: 'low',
          userMessage: 'Too many attempts. Please wait a moment and try again.',
          technicalDetails: { supabaseError: error }
        }
      } else if (message.includes('network') || message.includes('fetch')) {
        authError = {
          type: AuthErrorType.NETWORK_ERROR,
          message: 'Network error',
          originalError: error,
          retryable: true,
          severity: 'medium',
          userMessage: 'Network connection issue. Please check your internet and try again.',
          technicalDetails: { networkError: error }
        }
      } else if (message.includes('csrf') || message.includes('security validation failed')) {
        authError = {
          type: AuthErrorType.CSRF_ERROR,
          message: 'Security validation failed',
          originalError: error,
          retryable: true,
          severity: 'high',
          userMessage: 'Security validation failed. Please refresh the page and try again.',
          technicalDetails: { csrfError: error }
        }
      } else {
        authError = {
          type: AuthErrorType.UNKNOWN_ERROR,
          message: error.message,
          originalError: error,
          retryable: false,
          severity: 'medium',
          userMessage: 'An unexpected error occurred. Please try again.',
          technicalDetails: { originalError: error }
        }
      }
    } else {
      // Generic error fallback
      authError = {
        type: AuthErrorType.UNKNOWN_ERROR,
        message: 'Unknown error',
        originalError: error,
        retryable: false,
        severity: 'medium',
        userMessage: 'An unexpected error occurred. Please try again.',
        technicalDetails: { error }
      }
    }

    // Log error to history
    this.logError(authError)
    
    return authError
  }

  private logError(error: AuthError): void {
    this.errorHistory.push({
      ...error,
      technicalDetails: {
        ...error.technicalDetails,
        timestamp: Date.now()
      }
    })

    // Keep only recent errors
    if (this.errorHistory.length > this.MAX_HISTORY) {
      this.errorHistory = this.errorHistory.slice(-this.MAX_HISTORY)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Auth Error:', error)
    }
  }

  getErrorHistory(): AuthError[] {
    return [...this.errorHistory]
  }

  clearErrorHistory(): void {
    this.errorHistory = []
  }
}

// Retry mechanism with exponential backoff
export class RetryManager {
  private static instance: RetryManager
  private retryAttempts = new Map<string, number>()

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager()
    }
    return RetryManager.instance
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number
      baseDelay?: number
      maxDelay?: number
      retryCondition?: (error: any) => boolean
      operationId?: string
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      retryCondition = (error) => {
        const authError = AuthErrorHandler.getInstance().categorizeError(error)
        return authError.retryable
      },
      operationId = 'default'
    } = options

    let lastError: any
    const currentAttempts = this.retryAttempts.get(operationId) || 0

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation()
        // Reset retry count on success
        this.retryAttempts.delete(operationId)
        return result
      } catch (error) {
        lastError = error
        
        // Check if we should retry
        if (attempt === maxRetries || !retryCondition(error)) {
          this.retryAttempts.delete(operationId)
          throw error
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
        
        // Add jitter to prevent thundering herd
        const jitteredDelay = delay + Math.random() * 1000
        
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${jitteredDelay}ms`)
        
        // Update retry count
        this.retryAttempts.set(operationId, currentAttempts + attempt + 1)
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay))
      }
    }

    this.retryAttempts.delete(operationId)
    throw lastError
  }

  getRetryCount(operationId: string): number {
    return this.retryAttempts.get(operationId) || 0
  }

  clearRetryCount(operationId: string): void {
    this.retryAttempts.delete(operationId)
  }
}

// Export singleton instances
export const authErrorHandler = AuthErrorHandler.getInstance()
export const retryManager = RetryManager.getInstance()

// Utility functions
export function isRetryableError(error: any): boolean {
  const authError = authErrorHandler.categorizeError(error)
  return authError.retryable
}

export function getErrorMessage(error: any): string {
  const authError = authErrorHandler.categorizeError(error)
  return authError.userMessage
}

export function getErrorSeverity(error: any): 'low' | 'medium' | 'high' {
  const authError = authErrorHandler.categorizeError(error)
  return authError.severity
}
