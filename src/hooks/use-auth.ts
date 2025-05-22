// src/hooks/use-auth.ts - Complete enhanced authentication hook
import { useState, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  
  /**
   * Login with enhanced unverified email detection
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
        // Handle specific error cases
        if (error.message === 'Invalid login credentials') {
          toast({
            variant: "destructive",
            description: "Invalid email or password"
          })
        } else if (error.message === 'Email not confirmed') {
          localStorage.setItem('pendingVerificationEmail', email)
          toast({
            variant: "destructive",
            title: "Email not verified",
            description: "Please check your email and click the verification link before logging in."
          })
          router.push('/verify-email')
        } else {
          toast({
            variant: "destructive",
            description: error.message
          })
        }
        return false
      }
      
      // Check if user email is confirmed
      if (data?.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        localStorage.setItem('pendingVerificationEmail', email)
        toast({
          variant: "destructive",
          title: "Email not verified",
          description: "Please check your email and click the verification link before logging in."
        })
        router.push('/verify-email')
        return false
      }
      
      if (data?.user) {
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single()
          
          toast({
            description: "Successfully logged in",
          })
          
          router.refresh()
          
          let redirectPath
          if (typeof window !== 'undefined') {
            redirectPath = sessionStorage.getItem('authRedirectPath')
            sessionStorage.removeItem('authRedirectPath')
          }
          
          if (redirectPath) {
            router.push(redirectPath)
          } else {
            if (userData?.role === 'admin') {
              router.push('/admin/dashboard')
            } else {
              router.push('/dashboard')
            }
          }
          return true
        } catch (error) {
          console.error('Error fetching user role:', error)
          toast({
            description: "Successfully logged in",
          })
          router.refresh()
          router.push('/dashboard')
          return true
        }
      }
      
      return true
    } catch (error) {
      console.error('Login error:', error)
      
      const message = error instanceof Error 
        ? error.message
        : 'An unexpected error occurred'
      
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
      const redirectTo = `${window.location.origin}/api/auth/callback`
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
      
      if (error) throw error
      return true
    } catch (error) {
      console.error('Google sign-in error:', error)
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Failed to sign in with Google"
      })
      return false
    } finally {
      setIsLoading(false)
    }
  }, [toast])
  
  /**
   * Enhanced signup with better error handling
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
          emailRedirectTo: `${window.location.origin}/api/auth/callback`
        },
      })
      
      if (error) {
        if (error.message.includes('User already registered')) {
          toast({
            variant: "destructive",
            description: "An account with this email already exists. Please use a different email or try logging in."
          })
        } else {
          toast({
            variant: "destructive",
            description: error.message
          })
        }
        return false
      }
      
      if (typeof window !== 'undefined') {
        localStorage.setItem('pendingVerificationEmail', values.email)
      }
      
      toast({
        description: "Account created! Please check your email to verify your account.",
      })
      
      router.push('/verify-email')
      return true
    } catch (error) {
      console.error('Signup error:', error)
      
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
   * Send password reset email
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
   * Update password after reset
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
        description: "Password updated successfully!",
      })
      
      await supabase.auth.signOut()
      router.push('/password-reset-success')
      
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
  }, [toast, router])

  /**
   * Enhanced resend verification with better error handling
   */
  const resendVerification = useCallback(async (email: string) => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      
      // Try the resend method first
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`
        }
      })
      
      if (error) {
        // If resend fails, try signing up again with existing password
        console.log('Resend failed, trying alternative approach:', error)
        
        if (error.message.includes('already confirmed')) {
          toast({
            description: "Your email is already verified. You can now log in.",
          })
          router.push('/login')
          return true
        }
        
        throw error
      }
      
      toast({
        description: "Verification email has been sent. Please check your inbox.",
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
  }, [toast, router])


  /**
   * Sign out user
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
   * Check authentication status
   */
  const checkAuth = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: { session } } = await supabase.auth.getSession()
      
      return {
        isAuthenticated: !!user,
        user: user || null,
        session: session || null
      }
    } catch (error) {
      console.error('Check auth error:', error)
      return {
        isAuthenticated: false,
        user: null,
        session: null
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
    resendVerification,
    logout,
    checkAuth
  }
}