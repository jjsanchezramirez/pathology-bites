// src/features/auth/components/forms/reset-password-form.tsx
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

// Enhanced form schema with proper password validation
const formSchema = z.object({
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// Define type for form data
type FormData = z.infer<typeof formSchema>

interface ResetPasswordFormProps {
  className?: string
  initialError?: string
}

export function ResetPasswordForm({
  className,
  initialError,
  ...props
}: ResetPasswordFormProps) {
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
      password: "",
      confirmPassword: "",
    },
  })

  // Form submission handler
  async function onSubmit(values: FormData) {
    try {
      setLoading(true)

      const { error } = await supabase.auth.updateUser({
        password: values.password
      })

      if (error) {
        // Handle specific password reuse error
        if (error.message.includes('same as the old password') ||
            error.message.includes('password is the same') ||
            error.message.includes('new password should be different')) {
          toast.error('New password must be different from your current password. Please choose a different password.')
        } else if (error.message.includes('expired') || error.message.includes('invalid')) {
          // Handle expired reset token
          toast.error('Your password reset link has expired. Please request a new one.')
          setTimeout(() => {
            router.push('/forgot-password')
          }, 2000)
        } else {
          toast.error(error.message)
        }
        return
      }

      // Success - show success message and redirect
      toast.success('Password updated successfully!')
      setTimeout(() => {
        router.push('/password-reset-success')
      }, 1000)
    } catch (error) {
      console.error("Reset password error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Create new password"
      description="Enter a new strong password for your account"
      className={className}
      footer={
        <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
          Back to login
        </Link>
      }
      {...props}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Password Field */}
        <FormField
          id="password"
          label="New Password"
          type="password"
          autoComplete="new-password"
          error={isSubmitted ? errors.password?.message : undefined}
          disabled={loading}
          {...register("password")}
        />

        {/* Confirm Password Field */}
        <FormField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          autoComplete="new-password"
          error={isSubmitted ? errors.confirmPassword?.message : undefined}
          disabled={loading}
          {...register("confirmPassword")}
        />

        {/* Password Requirements */}
        <div className="text-sm text-muted-foreground">
          <p>Password must:</p>
          <ul className="list-disc list-inside space-y-1 pl-4 mt-1">
            <li>Be at least 8 characters long</li>
            <li>Include at least one uppercase letter</li>
            <li>Include at least one lowercase letter</li>
            <li>Include at least one number</li>
          </ul>
        </div>

        <FormButton
          type="submit"
          fullWidth
          disabled={loading}
        >
          {loading ? "Updating password..." : "Update Password"}
        </FormButton>
      </form>
    </AuthCard>
  )
}