// src/components/auth/login-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/theme/icons"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Login with Google or your email account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div className="grid gap-6">
              <div className="flex flex-col gap-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  {googleLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.google className="mr-2 h-4 w-4" />
                  )}
                  Login with Google
                </Button>
              </div>
              <div className="relative text-center text-sm">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative z-10">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email" id="email-label">Email</Label>
                  <Input
                    id="email"
                    {...register("email")}
                    type="email"
                    autoComplete="email"
                    placeholder="name@example.com"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    aria-labelledby="email-label"
                    disabled={loading}
                  />
                  {errors.email && (
                    <p 
                      className="text-sm text-destructive" 
                      role="alert"
                      id="email-error"
                    >
                      {errors.email.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" id="password-label">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                      tabIndex={0}
                      aria-label="Forgot password? Click to reset"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    {...register("password")}
                    type="password"
                    autoComplete="current-password"
                    aria-invalid={!!errors.password}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    aria-labelledby="password-label"
                    disabled={loading}
                  />
                  {errors.password && (
                    <p 
                      className="text-sm text-destructive" 
                      role="alert"
                      id="password-error"
                    >
                      {errors.password.message}
                    </p>
                  )}
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={loading}
                >
                  {formLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Login
                </Button>
              </div>
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
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking continue, you agree to our{" "}
        <Link href="/terms" tabIndex={0}>Terms of Service</Link>{" "}
        and{" "}
        <Link href="/privacy" tabIndex={0}>Privacy Policy</Link>.
      </div>
    </div>
  )
}