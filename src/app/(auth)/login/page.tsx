// src/app/(auth)/login/page.tsx
"use client"

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoginForm } from '@/components/auth/forms/login-form'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { createClient } from '@/lib/supabase/client'
import { AuthDebug } from '@/components/auth/auth-debug'

// Create a client component that uses searchParams
function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const isOnline = useNetworkStatus()
  const [isLoading, setIsLoading] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Get redirect parameter from URL
  const redirectPath = searchParams.get('redirect')
  const message = searchParams.get('message')
  const cleanRedirectPath = redirectPath ? redirectPath.replace(/\?$/, '') : undefined

  // Show helpful messages
  useEffect(() => {
    if (message === 'cross_device_detected') {
      toast({
        description: "Verification link was from different device. Please try logging in or sign up again."
      })
    } else if (message === 'cross_device_verified') {
      toast({
        description: "Your email was verified! Please log in to access your account."
      })
    }
  }, [message, toast])

  // Use the auth hook for authentication logic
  const { login, loginWithGoogle } = useAuth()
  
  // Check if user is already authenticated and redirect if so
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        if (!isOnline) {
          setIsLoading(false)
          return
        }
        
        const supabase = createClient()
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.log('Session check error:', error)
          setIsLoading(false)
          return
        }
        
        // If user is authenticated, redirect them
        if (session?.user) {
          console.log("User already authenticated, redirecting...")
          setIsRedirecting(true)
          
          try {
            // Check user role for proper redirect
            const { data: userData } = await supabase
              .from('users')
              .select('role')
              .eq('id', session.user.id)
              .single()
            
            const isAdmin = userData?.role === 'admin'
            
            // Determine redirect destination
            let destination = '/dashboard'
            if (cleanRedirectPath) {
              destination = cleanRedirectPath
            } else if (isAdmin) {
              destination = '/admin/dashboard'
            }
            
            console.log(`Redirecting authenticated user to: ${destination}`)
            router.push(destination)
            return // Don't set loading to false, we're redirecting
          } catch (roleError) {
            console.error('Error checking user role:', roleError)
            // Default redirect on role check failure
            router.push(cleanRedirectPath || '/dashboard')
            return
          }
        }
        
        // No session, show login form
        setIsLoading(false)
        
      } catch (error) {
        console.error('Auth check error:', error)
        setIsLoading(false)
      }
    }
    
    checkAuthAndRedirect()
  }, [router, isOnline, cleanRedirectPath])

  const handleEmailSignIn = async (email: string, password: string) => {
    if (!isOnline) {
      toast({
        variant: "destructive",
        description: "You appear to be offline. Please check your internet connection."
      })
      return
    }

    // The useAuth hook will handle redirection based on role and redirect param
    await login(email, password)
  }

  const handleGoogleSignIn = async () => {
    if (!isOnline) {
      toast({
        variant: "destructive",
        description: "You appear to be offline. Please check your internet connection."
      })
      return
    }
    
    // Store redirect path for after OAuth callback
    if (cleanRedirectPath && typeof window !== 'undefined') {
      sessionStorage.setItem('authRedirectPath', cleanRedirectPath)
    }
    
    await loginWithGoogle()
  }

  // Show loading while checking auth or redirecting
  if (isLoading || isRedirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner 
          size="md" 
          text={isRedirecting ? "Redirecting..." : "Loading..."} 
        />
      </div>
    )
  }

  return (
    <AuthPageLayout maxWidth="sm">
      <LoginForm 
        onSubmit={handleEmailSignIn}
        onGoogleSignIn={handleGoogleSignIn}
      />
      {process.env.NODE_ENV !== 'production' && <AuthDebug />}
    </AuthPageLayout>
  )
}

// Main component with Suspense wrapper
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="md" text="Loading..." />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}