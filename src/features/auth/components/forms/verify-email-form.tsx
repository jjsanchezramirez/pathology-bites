// src/features/auth/components/forms/verify-email-form.tsx
"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { StatusCard } from '@/features/auth/components/ui/status-card'
import { FormButton } from '@/features/auth/components/ui/form-button'
import { Button } from '@/shared/components/ui/button'
import { createClient } from '@/shared/services/client'

interface VerifyEmailFormProps {
  email?: string
  initialError?: string
  initialMessage?: string
}

export function VerifyEmailForm({ email, initialError, initialMessage }: VerifyEmailFormProps) {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Show initial messages as toasts
  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
    if (initialMessage) {
      toast.success(initialMessage)
    }
  }, [initialError, initialMessage])

  async function handleResendVerification() {
    if (!email) {
      toast.error("Email address is required to resend verification")
      return
    }

    try {
      setLoading(true)

      // Use environment variable for redirect URL
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/confirm`

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectTo
        }
      })

      if (error) {
        if (error.message.includes('already confirmed')) {
          toast.error("Email already verified. Please log in.")
        } else {
          toast.error(error.message)
        }
        return
      }

      toast.success("Verification email sent successfully")
    } catch (error) {
      console.error("Resend verification error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
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
      content="Please check your email and click the verification link to activate your account. If you don't see the email, check your spam folder."
      footer={
        <div className="flex flex-col gap-4 w-full">
          {email && (
            <FormButton 
              type="button" 
              fullWidth 
              disabled={loading}
              onClick={handleResendVerification}
            >
              {loading ? "Sending..." : "Resend verification email"}
            </FormButton>
          )}
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Back to login</Link>
          </Button>
        </div>
      }
    />
  )
}
