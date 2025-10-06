// src/features/auth/components/forms/forgot-password-form.tsx
"use client"

import { useState, useEffect } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AuthCard } from "@/features/auth/components/ui/auth-card"
import { FormField } from "@/features/auth/components/ui/form-field"
import { FormButton } from "@/features/auth/components/ui/form-button"
import { createClient } from '@/shared/services/client'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { Key, Mail } from 'lucide-react'

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
  const [resetType, setResetType] = useState<'reset' | 'magic_link'>('reset')
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

      if (resetType === 'magic_link') {
        // Send magic link for instant login
        const { error } = await supabase.auth.signInWithOtp({
          email: values.email,
          options: {
            emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/confirm?type=magiclink&next=/dashboard`
          }
        })

        if (error) {
          toast.error(error.message)
          return
        }

        toast.success('Magic link sent! Check your email to log in instantly.')
      } else {
        // Send password reset link
        const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/api/public/auth/confirm?type=recovery&next=/reset-password`

        const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
          redirectTo: redirectTo,
        })

        if (error) {
          toast.error(error.message)
          return
        }

        toast.success('Password reset link sent! Check your email.')
      }

      // Success - redirect to check email page
      router.push('/check-email')
    } catch (error) {
      console.error("Forgot password error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title={resetType === 'magic_link' ? 'Get a magic link' : 'Reset your password'}
      description={
        resetType === 'magic_link'
          ? 'Enter your email and we\'ll send you a magic link to log in instantly'
          : 'Enter your email and we\'ll send you a link to reset your password'
      }
      className={className}
      footer={
        <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
          Back to login
        </Link>
      }
      {...props}
    >
      <div className="space-y-6">
        {/* Reset Type Selection */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              type="button"
              variant={resetType === 'reset' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setResetType('reset')}
              className="flex-1"
              disabled={loading}
            >
              <Key className="h-4 w-4 mr-2" />
              Reset Password
            </Button>
            <Button
              type="button"
              variant={resetType === 'magic_link' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setResetType('magic_link')}
              className="flex-1"
              disabled={loading}
            >
              <Mail className="h-4 w-4 mr-2" />
              Magic Link
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {resetType === 'reset'
              ? 'Create a new password for your account'
              : 'Log in instantly without entering a password'
            }
          </p>
        </div>

        <Separator />

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

          <FormButton
            type="submit"
            fullWidth
            disabled={loading}
          >
            {loading ? (
              resetType === 'magic_link' ? 'Sending magic link...' : 'Sending reset link...'
            ) : (
              resetType === 'magic_link' ? 'Send magic link' : 'Send reset link'
            )}
          </FormButton>
        </form>
      </div>
    </AuthCard>
  )
}