// src/app/(auth)/reset-password/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { Icons } from "@/components/theme/icons"

export default function ResetPasswordPage() {
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { updatePassword, isLoading } = useAuth()
  const { toast } = useToast()
  const isOnline = useNetworkStatus()

  // Check if reset token is valid
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        
        if (error) {
          throw error
        }
        
        // If no session or not in recovery mode, redirect to login
        if (!data.session || !data.session.user?.email_confirmed_at) {
          setIsValid(false)
          
          // Give time for state to update
          setTimeout(() => {
            toast({
              variant: "destructive",
              title: "Invalid or expired link",
              description: "Please request a new password reset link."
            })
            router.push('/forgot-password')
          }, 300)
          return
        }
        
        setIsValid(true)
      } catch (error) {
        console.error("Session check error:", error)
        setIsValid(false)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to validate reset link. Please try again."
        })
      }
    }
    
    checkSession()
  }, [router, supabase, toast])

  const handleUpdatePassword = async (password: string) => {
    // Check if online first
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "You appear to be offline. Please check your internet connection and try again."
      })
      return
    }

    // Use the updatePassword function from the hook
    await updatePassword(password)
  }

  if (isValid === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted-foreground">Verifying your reset link...</p>
      </div>
    )
  }

  if (isValid === false) {
    // Will be redirected via the useEffect
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Icons.error className="h-8 w-8 text-destructive" />
        <p className="mt-2 text-muted-foreground">Invalid or expired reset link.</p>
        <p className="text-muted-foreground">Redirecting...</p>
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

          <ResetPasswordForm 
            onSubmit={handleUpdatePassword}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}