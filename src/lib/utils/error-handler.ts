// src/lib/utils/error-handler.ts
export type AuthErrorType = 
  | 'invalid_credentials'
  | 'rate_limited'
  | 'email_exists'
  | 'invalid_email'
  | 'weak_password'
  | 'expired_token'
  | 'same_password'
  | 'network_error'
  | 'unknown';

export function handleAuthError(error: unknown): { type: AuthErrorType, message: string } {
  if (!error) {
    return {
      type: 'unknown',
      message: 'An unknown error occurred'
    };
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Invalid credentials
  if (errorMessage.includes('Invalid login credentials') || 
      errorMessage.includes('Invalid email or password')) {
    return {
      type: 'invalid_credentials',
      message: 'Invalid email or password. Please check your credentials.'
    };
  }
  
  // Rate limiting
  if (errorMessage.includes('Too many requests') || 
      errorMessage.includes('rate limit')) {
    return {
      type: 'rate_limited',
      message: 'Too many login attempts. Please try again in a few minutes.'
    };
  }
  
  // Email exists
  if (errorMessage.includes('already exists') || 
      errorMessage.includes('already registered') ||
      errorMessage.includes('already in use')) {
    return {
      type: 'email_exists',
      message: 'This email address is already registered. Please sign in instead.'
    };
  }
  
  // Invalid email format
  if (errorMessage.includes('valid email') || 
      errorMessage.includes('invalid email')) {
    return {
      type: 'invalid_email',
      message: 'Please enter a valid email address.'
    };
  }
  
  // Weak password
  if (errorMessage.includes('password strength') || 
      errorMessage.includes('weak password')) {
    return {
      type: 'weak_password',
      message: 'Your password is too weak. Please choose a stronger password.'
    };
  }
  
  // Expired token
  if (errorMessage.includes('expired') || 
      errorMessage.includes('invalid link')) {
    return {
      type: 'expired_token',
      message: 'This link has expired or is invalid. Please request a new link.'
    };
  }
  
  // Same password
  if (errorMessage.includes('different from the old password')) {
    return {
      type: 'same_password',
      message: 'New password must be different from your current password.'
    };
  }
  
  // Network error
  if (errorMessage.includes('network') || 
      errorMessage.includes('connection') ||
      errorMessage.includes('offline')) {
    return {
      type: 'network_error',
      message: 'Network error. Please check your internet connection and try again.'
    };
  }
  
  // Default unknown error
  return {
    type: 'unknown',
    message: 'An unexpected error occurred. Please try again.'
  };
}