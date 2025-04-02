// src/app/(auth)/login/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { retrySupabaseAuth } from '@/lib/utils/supabase-retry'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const isOnline = useNetworkStatus()
  
  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          router.push('/dashboard')
        }
      } catch (error) {
        console.error("Session check error:", error)
      }
    }
    
    if (isOnline) {
      checkSession()
    }
  }, [router, supabase.auth, isOnline])

  const handleEmailSignIn = async (email: string, password: string) => {
    // Check if online first
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "You appear to be offline. Please check your internet connection and try again."
      })
      return
    }

    try {
      setIsLoading(true)
      
      // Use the retry utility for better reliability
      await retrySupabaseAuth(async (supabase) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              variant: "destructive",
              title: "Login Failed",
              description: "Invalid email or password. Please try again."
            })
          } else {
            throw error
          }
          return
        }
  
        // Only show success message and redirect if no error
        if (data.user) {
          toast({
            title: "Success",
            description: "Successfully logged in"
          })
          
          // Redirect to appropriate page
          router.push('/dashboard')
        }
      }, {
        maxRetries: 3,
        onRetry: (error, attempt) => {
          console.log(`Login attempt ${attempt} failed, retrying...`, error)
        }
      })
      
    } catch (error) {
      console.error("Login error:", error)
      
      // Provide a network-specific error message if it's a fetch error
      const errorMessage = error instanceof Error && 
        (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('abort'))
        ? "Network connection issue. Please check your internet connection and try again."
        : "An unexpected error occurred. Please try again."
      
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: errorMessage
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    // Check if online first
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "You appear to be offline. Please check your internet connection and try again."
      })
      return
    }
    
    try {
      setIsLoading(true)
      
      await retrySupabaseAuth(async (supabase) => {
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
    
        if (error) {
          toast({
            variant: "destructive",
            title: "Login Failed",
            description: "Could not connect to Google. Please try again."
          })
          console.error("Google auth error:", error.message)
        }
      })
      
    } catch (error) {
      console.error("Google sign-in error:", error)
      
      // Provide a network-specific error message if it's a fetch error
      const isNetworkError = error instanceof Error && 
        (error.message.includes('fetch') || error.message.includes('network'))
      
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: isNetworkError 
          ? "Network connection issue. Please check your internet connection and try again."
          : "An unexpected error occurred with Google sign-in. Please try again."
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <LoginForm 
            onSubmit={handleEmailSignIn}
            onGoogleSignIn={handleGoogleSignIn}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}