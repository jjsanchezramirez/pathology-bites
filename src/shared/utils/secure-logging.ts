// Secure Logging Utilities
// Prevents sensitive data exposure in logs

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'key',
  'authorization',
  'cookie',
  'session',
  'jwt',
  'api_key',
  'access_token',
  'refresh_token'
]

export function sanitizeForLogging(obj: any): any {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'string') {
    // Check if string contains sensitive patterns
    const lowerStr = obj.toLowerCase()
    if (SENSITIVE_FIELDS.some(field => lowerStr.includes(field))) {
      return '[REDACTED]'
    }
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item))
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase()
      if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field))) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = sanitizeForLogging(value)
      }
    }
    return sanitized
  }
  
  return obj
}

// Secure console methods
export const secureLog = {
  info: (message: string, data?: any) => {
    console.info(message, data ? sanitizeForLogging(data) : '')
  },
  
  warn: (message: string, data?: any) => {
    console.warn(message, data ? sanitizeForLogging(data) : '')
  },
  
  error: (message: string, error?: any) => {
    // For errors, log the message and stack trace but sanitize any data
    if (error instanceof Error) {
      console.error(message, {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
    } else {
      console.error(message, sanitizeForLogging(error))
    }
  }
}

// Usage example:
// Instead of: console.log('User data:', userData)
// Use: secureLog.info('User data:', userData)