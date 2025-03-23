// src/app/(auth)/login/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  
  // Add this effect to check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.push('/dashboard')
      }
    }
    
    checkSession()
  }, [router, supabase.auth])

  const handleEmailSignIn = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      
      // Use custom API endpoint for login without captcha
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        toast({
          variant: "destructive",
          description: result.error || "Invalid email or password",
        })
        throw new Error(result.error || "Login failed")
      }

      toast({
        title: "Success",
        description: "Successfully logged in",
      })
      
      // After successful login, manually redirect
      router.push('/dashboard')
    } catch (error) {
      console.error("Login error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    console.log("Redirect URL:", `${window.location.origin}/api/auth/callback`)

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
        description: "Could not connect to Google",
      })
      throw error
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