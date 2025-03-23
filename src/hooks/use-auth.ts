// src/hooks/use-auth.ts
import { useState, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { retryOperation } from '@/lib/utils/retry-operation'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const router = useRouter()
  
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Use retry operation for network-related errors
      const { error } = await retryOperation(
        () => supabase.auth.signInWithPassword({
          email,
          password,
        }),
        {
          maxRetries: 3,
          delayMs: 1000,
          backoffFactor: 2,
          retryableErrors: [
            'network', 
            'connection', 
            'timeout',
            'fetch failed',
            'Request failed'
          ]
        }
      )
      
      if (error) throw error
      
      toast({
        description: "Successfully logged in",
      })
      
      router.refresh()
      router.push('/dashboard')
      return true
    } catch (error) {
      console.error('Login error:', error)
      
      // Check for specific error types
      if (error instanceof Error) {
        // Handle rate limiting
        if (error.message.includes('Too many requests')) {
          toast({
            variant: "destructive",
            description: "Too many login attempts. Please try again later.",
          })
        } 
        // Handle invalid credentials
        else if (error.message.includes('Invalid login credentials')) {
          toast({
            variant: "destructive",
            description: "Invalid email or password. Please check your credentials.",
          })
        }
        // Generic error
        else {
          toast({
            variant: "destructive",
            description: "Failed to sign in. Please try again.",
          })
        }
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast, router])
  
  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Google login error:', error)
      toast({
        variant: "destructive",
        description: "Could not connect to Google. Please try again.",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast])
  
  const signup = useCallback(async (values: {
    email: string
    password: string
    firstName: string
    lastName: string
    userType: string
  }) => {
    setIsLoading(true)
    try {
      // Check if email exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', values.email)
        .single()
        
      if (existingUser) {
        toast({
          description: "This email address is already registered. Please sign in instead.",
        })
        return false
      }
      
      // Proceed with signup
      const { error, data } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            user_type: values.userType,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?type=signup_confirmation&next=/email-verified`
        },
      })
      
      if (error) throw error
      
      // Store email for resend functionality
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingVerificationEmail', values.email)
      }
      
      router.push('/verify-email')
      return true
    } catch (error) {
      console.error('Signup error:', error)
      toast({
        variant: "destructive",
        description: "Failed to create account. Please try again.",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast, router])
  
  const resetPassword = useCallback(async (email: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
      })
      
      if (error) throw error
      
      router.push('/check-email')
      return true
    } catch (error) {
      console.error('Reset password error:', error)
      toast({
        variant: "destructive",
        description: "Failed to send reset email. Please try again.",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast, router])

  const updatePassword = useCallback(async (password: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password
      })
      
      if (error) throw error
      
      // Sign out after password update
      await supabase.auth.signOut()
      
      toast({
        description: "Password updated successfully! Please log in with your new password.",
      })
      
      setTimeout(() => {
        router.push('/login')
      }, 2000)
      return true
    } catch (error) {
      console.error('Update password error:', error)
      // Specific error handling
      if (error instanceof Error) {
        if (error.message.includes('should be different from the old password')) {
          toast({
            variant: "destructive",
            description: "New password must be different from your current password.",
          })
        } else {
          toast({
            variant: "destructive",
            description: "Failed to update password. Please try again.",
          })
        }
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast, router])
  
  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      router.refresh()
      router.push('/')
      return true
    } catch (error) {
      console.error('Logout error:', error)
      toast({
        variant: "destructive",
        description: "Failed to sign out. Please try again.",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast, router])
  
  const resendVerification = useCallback(async (email: string) => {
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?type=signup_confirmation&next=/email-verified`
        }
      })
      
      if (error) throw error
      
      toast({
        description: "Verification email has been resent. Please check your inbox.",
      })
      return true
    } catch (error) {
      console.error('Resend verification error:', error)
      toast({
        variant: "destructive",
        description: "Failed to resend verification email. Please try again.",
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast])
  
  return {
    isLoading,
    login,
    loginWithGoogle,
    signup,
    resetPassword,
    updatePassword,
    logout,
    resendVerification
  }
}