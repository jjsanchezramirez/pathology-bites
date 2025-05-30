// src/hooks/use-email-subscription.ts
import { useState } from 'react'

interface EmailSubscriptionOptions {
  onSuccess?: () => void
  onError?: (error: unknown) => void
}

export function useEmailSubscription(options: EmailSubscriptionOptions = {}) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const validateEmail = (email: string): boolean => {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !validateEmail(email)) {
      options.onError?.(new Error("Please enter a valid email address."))
      return
    }
    
    try {
      setIsSubmitting(true)
      
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
      
      // Parse response JSON
      let data
      try {
        data = await response.json()
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError)
        throw new Error('Server response was not valid JSON.')
      }
      
      // Handle specific error responses
      if (!response.ok) {
        // Check for Row-Level Security error
        if (data?.code === '42501' && data?.message?.includes('row-level security policy')) {
          throw new Error("You don't have permission to add emails to the waitlist. Please contact the administrator.")
        }
        
        // Check for duplicate email
        if (data?.code === '23505' && data?.message?.includes('duplicate key')) {
          // This is actually a "success" case - email is already on the waitlist
          options.onSuccess?.()
          return
        }
        
        // Generic error with message from server if available
        throw new Error(data?.message || data?.error || 'Failed to subscribe. Please try again later.')
      }
      
      options.onSuccess?.()
    } catch (error) {
      options.onError?.(error)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return {
    email,
    setEmail,
    isSubmitting,
    handleSubmit
  }
}