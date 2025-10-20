// src/features/auth/components/forms/login-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { toast } from "sonner"
import { Turnstile } from '@marsidev/react-turnstile'
import { FormField } from "@/features/auth/components/ui/form-field"
import { FormButton } from "@/features/auth/components/ui/form-button"
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button"
import { AuthDivider } from "@/features/auth/components/ui/auth-divider"
import { useCSRFToken } from '@/features/auth/hooks/use-csrf-token'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

// Define type for form data
type LoginFormData = z.infer<typeof formSchema>

interface LoginFormProps {
  action: (formData: FormData) => Promise<void>
  redirect?: string
  isAdminOnlyMode?: boolean
}

export function LoginForm({
  action,
  redirect,
  isAdminOnlyMode = false
}: LoginFormProps) {
  const [loading, setLoading] = useState(false)
  const { getToken, addTokenToFormData } = useCSRFToken()
  const { captchaToken, setCaptchaToken } = useTurnstile()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY

  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
  } = useForm<LoginFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // Form submission handler
  async function onSubmit(values: LoginFormData) {
    try {
      setLoading(true)

      // Create FormData object for server action
      const formData = new FormData()
      formData.append('email', values.email)
      formData.append('password', values.password)
      if (redirect) {
        formData.append('redirect', redirect)
      }

      // Add CAPTCHA token if available
      if (captchaToken) {
        formData.append('captchaToken', captchaToken)
      }

      // Add CSRF token
      const csrfToken = await getToken()
      addTokenToFormData(formData, csrfToken)

      // Call the server action
      await action(formData)
    } catch (error) {
      console.error("Login error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <GoogleSignInButton />
      
      <AuthDivider text="Or continue with" />
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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

        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={isSubmitted ? errors.password?.message : undefined}
          disabled={loading}
          rightElement={
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              Forgot?
            </Link>
          }
          {...register("password")}
        />

        {siteKey && (
          <div className="flex justify-center">
            <Turnstile
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

        <FormButton type="submit" fullWidth disabled={loading || (siteKey && !captchaToken)}>
          {loading ? "Signing in..." : "Login"}
        </FormButton>
      </form>

      {!isAdminOnlyMode && (
        <div className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link
            href="/signup"
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            Sign up
          </Link>
        </div>
      )}
    </div>
  )
}
