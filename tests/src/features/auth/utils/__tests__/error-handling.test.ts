// src/features/auth/utils/__tests__/error-handling.test.ts
import { 
  AuthErrorHandler, 
  RetryManager, 
  AuthErrorType,
  authErrorHandler,
  retryManager 
} from '../error-handling'

describe('AuthErrorHandler', () => {
  let errorHandler: AuthErrorHandler

  beforeEach(() => {
    errorHandler = AuthErrorHandler.getInstance()
    errorHandler.clearErrorHistory()
  })

  describe('categorizeError', () => {
    it('should categorize invalid login credentials correctly', () => {
      const error = new Error('Invalid login credentials')
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.AUTHENTICATION_FAILED)
      expect(authError.retryable).toBe(false)
      expect(authError.severity).toBe('medium')
      expect(authError.userMessage).toBe('Please check your email and password and try again.')
    })

    it('should categorize email not confirmed correctly', () => {
      const error = new Error('Email not confirmed')
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.AUTHENTICATION_FAILED)
      expect(authError.retryable).toBe(false)
      expect(authError.severity).toBe('medium')
      expect(authError.userMessage).toBe('Please check your email and click the verification link.')
    })

    it('should categorize session expired correctly', () => {
      const error = new Error('jwt expired')
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.SESSION_EXPIRED)
      expect(authError.retryable).toBe(true)
      expect(authError.severity).toBe('medium')
      expect(authError.userMessage).toBe('Your session has expired. Please log in again.')
    })

    it('should categorize rate limit errors correctly', () => {
      const error = new Error('too many requests')
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.RATE_LIMITED)
      expect(authError.retryable).toBe(true)
      expect(authError.severity).toBe('low')
      expect(authError.userMessage).toBe('Too many attempts. Please wait a moment and try again.')
    })

    it('should categorize network errors correctly', () => {
      const error = new Error('network error')
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.NETWORK_ERROR)
      expect(authError.retryable).toBe(true)
      expect(authError.severity).toBe('medium')
      expect(authError.userMessage).toBe('Unable to connect to the server. Please check your internet connection and try again.')
    })

    it('should categorize CSRF errors correctly', () => {
      const error = new Error('security validation failed')
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.CSRF_ERROR)
      expect(authError.retryable).toBe(true)
      expect(authError.severity).toBe('high')
      expect(authError.userMessage).toBe('Security validation failed. Please refresh the page and try again.')
    })

    it('should handle HTTP status errors', () => {
      const error = { status: 500, message: 'Internal Server Error' }
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.SERVER_ERROR)
      expect(authError.retryable).toBe(true)
      expect(authError.severity).toBe('high')
    })

    it('should handle unknown errors', () => {
      const error = { someProperty: 'unknown error' }
      const authError = errorHandler.categorizeError(error)

      expect(authError.type).toBe(AuthErrorType.UNKNOWN_ERROR)
      expect(authError.retryable).toBe(false)
      expect(authError.severity).toBe('medium')
    })
  })

  describe('error history', () => {
    it('should log errors to history', () => {
      const error = new Error('test error')
      errorHandler.categorizeError(error)

      const history = errorHandler.getErrorHistory()
      expect(history).toHaveLength(1)
      expect(history[0].message).toBe('test error')
    })

    it('should limit error history size', () => {
      // Add more than MAX_HISTORY errors
      for (let i = 0; i < 60; i++) {
        errorHandler.categorizeError(new Error(`error ${i}`))
      }

      const history = errorHandler.getErrorHistory()
      expect(history.length).toBeLessThanOrEqual(50)
    })

    it('should clear error history', () => {
      errorHandler.categorizeError(new Error('test error'))
      expect(errorHandler.getErrorHistory()).toHaveLength(1)

      errorHandler.clearErrorHistory()
      expect(errorHandler.getErrorHistory()).toHaveLength(0)
    })
  })
})

describe('RetryManager', () => {
  let retryManager: RetryManager

  beforeEach(() => {
    retryManager = RetryManager.getInstance()
    jest.clearAllMocks()
  })

  describe('executeWithRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await retryManager.executeWithRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success')

      const result = await retryManager.executeWithRetry(operation, {
        maxRetries: 2,
        baseDelay: 10 // Short delay for testing
      })

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Invalid login credentials'))

      await expect(
        retryManager.executeWithRetry(operation, { maxRetries: 2 })
      ).rejects.toThrow('Invalid login credentials')

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should respect maxRetries limit', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('network error'))

      await expect(
        retryManager.executeWithRetry(operation, { 
          maxRetries: 2,
          baseDelay: 10
        })
      ).rejects.toThrow('network error')

      expect(operation).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should use custom retry condition', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('custom error'))
      const retryCondition = jest.fn().mockReturnValue(false)

      await expect(
        retryManager.executeWithRetry(operation, { 
          retryCondition,
          maxRetries: 2
        })
      ).rejects.toThrow('custom error')

      expect(operation).toHaveBeenCalledTimes(1)
      expect(retryCondition).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should track retry counts', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce('success')

      await retryManager.executeWithRetry(operation, {
        operationId: 'test-op',
        maxRetries: 3,
        baseDelay: 10
      })

      // After success, retry count should be cleared
      expect(retryManager.getRetryCount('test-op')).toBe(0)
    })
  })
})

describe('Utility functions', () => {
  it('should identify retryable errors', () => {
    const { isRetryableError } = require('../error-handling')
    
    expect(isRetryableError(new Error('network error'))).toBe(true)
    expect(isRetryableError(new Error('Invalid login credentials'))).toBe(false)
  })

  it('should get user-friendly error messages', () => {
    const { getErrorMessage } = require('../error-handling')
    
    const message = getErrorMessage(new Error('Invalid login credentials'))
    expect(message).toBe('Please check your email and password and try again.')
  })

  it('should get error severity', () => {
    const { getErrorSeverity } = require('../error-handling')
    
    expect(getErrorSeverity(new Error('Invalid login credentials'))).toBe('medium')
    expect(getErrorSeverity(new Error('network error'))).toBe('medium')
    expect(getErrorSeverity(new Error('too many requests'))).toBe('low')
  })
})
