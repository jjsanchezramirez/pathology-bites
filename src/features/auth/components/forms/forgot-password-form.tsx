// src/features/auth/components/forms/forgot-password-form.tsx
"use client"

import { useState, useEffect, useRef } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { AuthCard } from "@/features/auth/components/ui/auth-card"
import { FormField } from "@/features/auth/components/ui/form-field"
import { FormButton } from "@/features/auth/components/ui/form-button"
import { createClient } from '@/shared/services/client'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

// Define type for form data
type FormData = z.infer<typeof formSchema>

interface ForgotPasswordFormProps {
  className?: string
  initialError?: string
}

export function ForgotPasswordForm({
  className,
  initialError,
  ...props
}: ForgotPasswordFormProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Show initial error as toast
  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  // Form submission handler
  async function onSubmit(values: FormData) {
    try {
      setLoading(true)

      // Send password reset link
      const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/confirm?type=recovery&next=/reset-password`

      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: redirectTo,
        captchaToken: captchaToken || undefined,
      })

      if (error) {
        toast.error(error.message)
        // Reset CAPTCHA on error
        turnstileRef.current?.reset()
        setCaptchaToken(null)
        return
      }

      toast.success('Password reset link sent! Check your email.')

      // Success - redirect to check email page
      router.push('/check-email')
    } catch (error) {
      console.error("Forgot password error:", error)
      toast.error("An unexpected error occurred. Please try again.")
      // Reset CAPTCHA on error
      turnstileRef.current?.reset()
      setCaptchaToken(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your email and we'll send you a link to reset your password"
      className={className}
      footer={
        <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
          Back to login
        </Link>
      }
      {...props}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          id="email"
          label="Email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={isSubmitted ? errors.email?.message : undefined}
          disabled={loading}
          {...register("email")}
        />

        {siteKey && (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={siteKey}
              onSuccess={(token) => setCaptchaToken(token)}
              onError={() => {
                setCaptchaToken(null)
                toast.error("CAPTCHA verification failed. Please try again.")
              }}
              onExpire={() => {
                setCaptchaToken(null)
                toast.error("CAPTCHA expired. Please verify again.")
              }}
            />
          </div>
        )}

        <FormButton
          type="submit"
          fullWidth
          disabled={loading || (siteKey && !captchaToken)}
        >
          {loading ? 'Sending reset link...' : 'Send reset link'}
        </FormButton>
      </form>
    </AuthCard>
  )
}