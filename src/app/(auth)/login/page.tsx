// src/app/(auth)/login/page.tsx
"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoginForm } from '@/components/auth/forms/login-form'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { LoadingSpinner } from '@/components/common/loading-spinner'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const isOnline = useNetworkStatus()
  const [isLoading, setIsLoading] = useState(true)
  
  // Use the auth hook for authentication logic
  const { login, loginWithGoogle } = useAuth()
  
  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        if (!isOnline) {
          setIsLoading(false)
          return
        }
        
        const supabase = createClient()
        try {
          const { data, error } = await supabase.auth.getSession()
          
          if (data.session) {
            console.log("User is logged in, redirecting to dashboard")
            router.push('/dashboard')
          }
        } catch (error) {
          console.log('Auth error:', error)
        }
      } finally {
        setIsLoading(false)
      }
    }
    
    checkSession()
  }, [router, isOnline])

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