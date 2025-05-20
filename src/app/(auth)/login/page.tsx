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

// Create a client component that uses searchParams
function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const isOnline = useNetworkStatus()
  const [isLoading, setIsLoading] = useState(true)

  // Use the auth hook for authentication logic
  const { login, loginWithGoogle } = useAuth()
  
  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Always set loading to false if offline
        if (!isOnline) {
          setIsLoading(false)
          return
        }
        
        const supabase = createClient()
        try {
          const { data, error } = await supabase.auth.getSession()
          
          if (error) {
            console.log('Session error:', error)
            setIsLoading(false)
            return
          }
          
          // IMPORTANT: Check for coming soon mode from environment
          const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
          
          if (data.session) {
            // Check if we should redirect or not
            const bypassParam = searchParams.get('bypass')
            const hasAdminAccess = bypassParam === 'true'
            
            // Check user role to determine redirect
            try {
              const { data: userData } = await supabase
                .from('users')
                .select('role')
                .eq('id', data.session.user.id)
                .single()
              
              const isAdmin = userData?.role === 'admin'
              
              // Only redirect if not in coming soon mode or has bypass/admin access
              if (!isComingSoonMode || hasAdminAccess || isAdmin) {
                console.log("User is logged in, redirecting to dashboard")
                
                // If admin, redirect to admin dashboard
                if (isAdmin) {
                  router.push('/admin/dashboard')
                } else {
                  router.push('/dashboard')
                }
              } else {
                // In coming soon mode and not admin/bypass, stay on login page
                console.log("Coming soon mode active, not redirecting")
                setIsLoading(false)
              }
            } catch (error) {
              console.error('Error checking user role:', error)
              setIsLoading(false)
            }
          } else {
            // No session, just show the login form
            setIsLoading(false)
          }
        } catch (error) {
          console.log('Auth error:', error)
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Unexpected error:', error)
        setIsLoading(false)
      }
    }
    
    checkSession()
  }, [router, isOnline, searchParams])

  const handleEmailSignIn = async (email: string, password: string) => {
    if (!isOnline) {
      toast({
        variant: "destructive",
        description: "You appear to be offline. Please check your internet connection."
      })
      return
    }

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
    
    await loginWithGoogle()
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner size="md" text="Loading..." />
      </div>
    )
  }

  return (
    <AuthPageLayout maxWidth="sm">
      <LoginForm 
        onSubmit={handleEmailSignIn}
        onGoogleSignIn={handleGoogleSignIn}
        isLoading={isLoading}
      />
    </AuthPageLayout>
  )
}

// This is the main component that will be exported
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