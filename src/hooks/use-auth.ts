// src/hooks/use-auth.ts
import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  
  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) {
        toast({
          variant: "destructive",
          description: error.message === 'Invalid login credentials'
            ? "Invalid email or password"
            : error.message
        })
        return false
      }
      
      // Check if there's a user and session
      if (data?.user) {
        try {
          // Fetch user role from the database
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single()
          
          toast({
            description: "Successfully logged in",
          })
          
          router.refresh()
          
          // Redirect based on role
          if (userData?.role === 'admin') {
            router.push('/admin/dashboard')
          } else {
            router.push('/dashboard')
          }
          return true
        } catch (error) {
          console.error('Error fetching user role:', error)
          
          // Default redirect if role check fails
          toast({
            description: "Successfully logged in",
          })
          router.refresh()
          router.push('/dashboard')
          return true
        }
      }
      
      toast({
        description: "Successfully logged in",
      })
      
      router.refresh()
      router.push('/dashboard')
      return true
    } catch (error) {
      console.error('Login error:', error)
      
      // Handle error message
      const message = error instanceof Error 
        ? error.message
        : 'An unexpected error occurred'
      
      // Check for network-related errors
      const isNetworkError = error instanceof Error && 
        (error.message.includes('fetch') || 
         error.message.includes('network') || 
         error.message.includes('abort'))
      
      toast({
        variant: "destructive",
        description: isNetworkError
          ? "Network connection issue. Please check your internet connection and try again."
          : message,
      })
      
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast, router])
  
  /**
   * Login with Google OAuth
   */
  const loginWithGoogle = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      
      // Let Supabase handle the redirect automatically, without specifying redirectTo
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Skip the redirectTo entirely for simplest solution
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      
      if (error) {
        toast({
          variant: "destructive",
          description: error.message
        })
        return false
      }
      
      return true
    } catch (error) {
      console.error('Google login error:', error)
      toast({
        variant: "destructive",
        description: "Could not connect to Google. Please try again."
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  /**
   * Sign up with email and password
   */
  const signup = useCallback(async (values: {
    email: string
    password: string
    firstName: string
    lastName: string
    userType: string
  }) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
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
      
      if (error) {
        toast({
          variant: "destructive",
          description: error.message
        })
        return false
      }
      
      // Store email for resend functionality
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingVerificationEmail', values.email)
      }
      
      router.push('/verify-email')
      return true
    } catch (error) {
      console.error('Signup error:', error)
      
      // Extract error message
      const message = error instanceof Error
        ? error.message
        : 'Failed to sign up. Please try again.'
      
      toast({
        variant: "destructive",
        description: message,
      })
      
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast, router])
  
  /**
   * Send a password reset email
   */
  const resetPassword = useCallback(async (email: string) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?type=recovery`,
      })
      
      if (error) {
        toast({
          variant: "destructive",
          description: error.message
        })
        return false
      }
      
      router.push('/check-email')
      return true
    } catch (error) {
      console.error('Reset password error:', error)
      
      const message = error instanceof Error
        ? error.message
        : 'Failed to send reset link. Please try again.'
      
      toast({
        variant: "destructive",
        description: message,
      })
      
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast, router])

  /**
   * Update user password
   */
  const updatePassword = useCallback(async (password: string) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password
      })
      
      if (error) {
        toast({
          variant: "destructive",
          description: error.message
        })
        return false
      }
      
      toast({
        description: "Password updated successfully! Please log in with your new password.",
      })
      
      // Sign out after password update
      await supabase.auth.signOut()
      
      // Add slight delay to ensure state is updated
      setTimeout(() => {
        window.location.href = '/login'
      }, 500)
      
      return true
    } catch (error) {
      console.error('Update password error:', error)
      
      const message = error instanceof Error
        ? error.message
        : 'Failed to update password. Please try again.'
      
      toast({
        variant: "destructive",
        description: message,
      })
      
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast])
  
  /**
   * Sign out the current user
   */
  const logout = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast({
          variant: "destructive",
          description: error.message
        })
        return false
      }
      
      toast({
        description: "Successfully logged out",
      })
      
      // Force a full page reload rather than just using router
      // This ensures all state is cleared properly
      setTimeout(() => {
        window.location.href = '/'
      }, 300)
      
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
  }, [toast])
  
  /**
   * Resend verification email
   */
  const resendVerification = useCallback(async (email: string) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?type=signup_confirmation&next=/email-verified`
        }
      })
      
      if (error) {
        toast({
          variant: "destructive",
          description: error.message
        })
        return false
      }
      
      toast({
        description: "Verification email has been resent. Please check your inbox.",
      })
      
      return true
    } catch (error) {
      console.error('Resend verification error:', error)
      
      const message = error instanceof Error
        ? error.message
        : 'Failed to resend verification email. Please try again.'
      
      toast({
        variant: "destructive",
        description: message,
      })
      
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast])
  
  /**
   * Check if user is authenticated
   */
/**
 * Check if user is authenticated
 */
  const checkAuth = useCallback(async () => {
    try {
      const supabase = createClient()
      
      // Get user directly from getUser() as recommended by Supabase
      const { data: { user } } = await supabase.auth.getUser()
      
      // Only check session for session properties if needed
      const { data: { session } } = await supabase.auth.getSession()
      
      return {
        isAuthenticated: !!user, // Use presence of user to determine authentication
        user: user || null
      }
    } catch (error) {
      // Silently ignore Auth Session Missing errors
      console.error('Check auth error:', error)
      return {
        isAuthenticated: false,
        user: null
      }
    }
  }, [])
  
  return {
    isLoading,
    login,
    loginWithGoogle,
    signup,
    resetPassword,
    updatePassword,
    logout,
    resendVerification,
    checkAuth
  }
}