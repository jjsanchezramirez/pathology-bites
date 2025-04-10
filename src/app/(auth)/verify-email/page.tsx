// src/app/(auth)/verify-email/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/theme/icons"
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useToast } from '@/hooks/use-toast'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { StatusCard } from '@/components/auth/ui/status-card'
import { FormButton } from '@/components/auth/ui/form-button'

export default function VerifyEmailPage() {
  const [email, setEmail] = useState<string>('')
  const { resendVerification, isLoading } = useAuth()
  const [resending, setResending] = useState(false)
  const isOnline = useNetworkStatus()
  const { toast } = useToast()

  // Get email from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('pendingVerificationEmail')
      if (storedEmail) {
        setEmail(storedEmail)
      }
    }
  }, [])

  const handleResendVerification = async () => {
    // Check if online first
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "You appear to be offline. Please check your internet connection and try again."
      })
      return
    }

    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email address not found. Please try signing up again."
      })
      return
    }

    try {
      setResending(true)
      await resendVerification(email)
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthPageLayout>
      <StatusCard
        title="Check your email"
        description={
          <>
            We've sent a verification link to{" "}
            <span className="font-medium text-foreground">
              {email || "your email address"}
            </span>
          </>
        }
        icon={<Icons.mail className="h-6 w-6" />}
        content="Please check your email and click the verification link to activate your account. If you don't see the email, check your spam folder."
        footer={
          <div className="flex flex-col gap-4 w-full">
            <FormButton 
              fullWidth
              onClick={handleResendVerification}
              isLoading={isLoading || resending}
              loadingText="Sending..."
            >
              Resend verification email
            </FormButton>
            <Button 
              variant="outline"
              className="w-full"
              asChild
            >
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        }
      />
    </AuthPageLayout>
  )
}