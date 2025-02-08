// src/app/(auth)/reset-password/page.tsx
"use client"

import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { AuthError } from '@supabase/supabase-js'

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          throw new Error('No active session')
        }
        
        setIsLoading(false)
      } catch (error) {
        console.error('Session check error:', error)
        toast({
          variant: "destructive",
          description: "Please use the reset link from your email to access this page.",
        })
        router.push('/login')
      }
    }

    checkSession()
  }, [router, toast, supabase.auth])

  const handlePasswordReset = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })
      
      if (error) {
        throw error
      }

      // Sign out after password update
      await supabase.auth.signOut()

      toast({
        description: "Password updated successfully! Please log in with your new password.",
      })
      
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (error) {
      console.error('Reset password error:', error)
      
      // Type guard to check if error is AuthError
      const isAuthError = (error: unknown): error is AuthError => {
        return (error as AuthError)?.message !== undefined
      }
      
      if (isAuthError(error)) {
        // Check specifically for same password error
        if (error.message.includes('should be different from the old password')) {
          toast({
            variant: "destructive",
            description: "New password must be different from your current password.",
          })
        } else {
          toast({
            variant: "destructive",
            description: "Error resetting password. Please try again.",
          })
        }
      } else {
        toast({
          variant: "destructive",
          description: "An unexpected error occurred. Please try again.",
        })
      }
    }
  }

  if (isLoading) {
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

            <div className="text-center text-muted-foreground">
              Verifying your session...
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col flex-1">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        {/* Match the login page's max-w-sm */}
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>
          <ResetPasswordForm onSubmit={handlePasswordReset}/>
        </div>
      </div>
    </div>
)
}