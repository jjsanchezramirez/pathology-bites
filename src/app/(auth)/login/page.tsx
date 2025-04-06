// Simplified login page
"use client"

import { useEffect, useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/utils/supabase/client'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { Icons } from "@/components/theme/icons"

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
          const { data } = await supabase.auth.getSession()
          if (data.session) {
            router.push('/dashboard')
          }
        } catch (error) {
          // Ignore Auth Session Missing errors
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
        <Icons.spinner className="h-5 w-5 animate-spin" />
      </div>
    )
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