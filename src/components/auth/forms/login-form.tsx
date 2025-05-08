// src/components/auth/login-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthCard } from "@/components/auth/ui/auth-card"
import { FormField } from "@/components/auth/ui/form-field"
import { FormButton } from "@/components/auth/ui/form-button"
import { SocialButton } from "@/components/auth/ui/social-button"
import { AuthDivider } from "@/components/auth/ui/auth-divider"

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

// Define type for form data
type FormData = z.infer<typeof formSchema>

interface LoginFormProps {
  className?: string
  onSubmit?: (email: string, password: string) => Promise<void>
  onGoogleSignIn?: () => Promise<void>
  isLoading?: boolean
}

export function LoginForm({
  className,
  onSubmit,
  onGoogleSignIn,
  isLoading: parentLoading = false,
  ...props
}: LoginFormProps) {
  const [formLoading, setFormLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Compute the overall loading state
  const loading = parentLoading || formLoading || googleLoading

  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  // Form submission handler
  async function onFormSubmit(values: FormData) {
    if (!onSubmit) return
    
    try {
      setError(null)
      setFormLoading(true)
      await onSubmit(values.email, values.password)
    } catch (error) {
      console.error("Form submission error:", error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    if (!onGoogleSignIn) return
    
    try {
      setError(null)
      setGoogleLoading(true)
      await onGoogleSignIn()
    } catch (error) {
      console.error("Google sign-in error:", error)
      setError(error instanceof Error ? error.message : 'Failed to sign in with Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Login with Google or your email account"
      className={className}
      showPrivacyFooter
      {...props}
    >
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid gap-6">
          <SocialButton
            provider="google"
            onClick={handleGoogleSignIn}
            isLoading={googleLoading}
            disabled={loading}
          />
          
          <AuthDivider text="Or continue with" />
          
          <div className="grid gap-6">
            <FormField
              id="email"
              name="email" // Add name property
              label="Email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              error={errors.email?.message}
              register={register}
              required
              disabled={loading}
            />
            
            <FormField
              id="password"
              name="password" // Add name property
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              register={register}
              required
              disabled={loading}
              rightElement={
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  tabIndex={0}
                >
                  Forgot?
                </Link>
              }
            />
            
            <FormButton 
              type="submit" 
              fullWidth
              isLoading={formLoading}
              loadingText="Logging in..."
              disabled={loading}
            >
              Login
            </FormButton>
            
            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link 
                href="/signup" 
                className="text-foreground underline underline-offset-4 hover:text-primary"
                tabIndex={0}
              >
                Sign up
              </Link>
            </div>
          </div>
        </div>
      </form>
    </AuthCard>
  )
}