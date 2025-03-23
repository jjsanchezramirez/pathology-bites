// src/components/auth/signup-form.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icons } from "@/components/theme/icons"
import { PasswordRequirements } from "@/components/auth/password-requirements"
import { PasswordStrength } from "@/components/auth/password-strength"
import { supabase } from '@/lib/supabase/client'
import Script from 'next/script'

// Define type for reCAPTCHA Enterprise global
declare global {
  interface Window {
    grecaptcha: {
      enterprise: {
        ready: (callback: () => void) => void
        execute: (siteKey: string, options: { action: string }) => Promise<string>
      }
    }
  }
}

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  userType: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type FormData = z.infer<typeof formSchema>

interface SignupFormProps {
  className?: string
  onSubmit: (values: Omit<FormData, "confirmPassword">, captchaToken?: string) => Promise<void>
  onGoogleSignUp?: () => Promise<void>
}

export function SignupForm({ className, onSubmit, onGoogleSignUp }: SignupFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [password, setPassword] = useState("")
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false)
  const recaptchaSiteKey = '6Lc0j_0qAAAAAPYTZIIVdNvJXX4hmZ6brnhk60ga' // Your site key
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    setError
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userType: 'resident'
    }
  })

  // Handle reCAPTCHA script loading
  const handleRecaptchaLoad = () => {
    window.grecaptcha?.enterprise.ready(() => {
      setRecaptchaLoaded(true)
    })
  }

  // Function to execute reCAPTCHA
  const executeRecaptcha = async (action: string): Promise<string | null> => {
    if (!recaptchaLoaded || !window.grecaptcha?.enterprise) {
      console.error('reCAPTCHA Enterprise not loaded')
      return null
    }
    
    try {
      const token = await window.grecaptcha.enterprise.execute(
        recaptchaSiteKey,
        { action }
      )
      return token
    } catch (error) {
      console.error('reCAPTCHA execution error:', error)
      return null
    }
  }

  const onFormSubmit = async (values: FormData) => {
    try {
      setIsLoading(true)
      
      // Get reCAPTCHA token
      const recaptchaToken = await executeRecaptcha('SIGNUP')
      
      if (!recaptchaToken) {
        setError("root", {
          type: "manual",
          message: "Verification failed. Please try again."
        })
        return
      }
      
      // First check if the email exists in the users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', values.email)
        .single()

      if (existingUser) {
        setError("email", { 
          type: "manual", 
          message: "This email address is already registered." 
        })
        return
      }
      
      // Create a new object with all properties except confirmPassword
      const submitData = Object.fromEntries(
        Object.entries(values).filter(([key]) => key !== 'confirmPassword')
      ) as Omit<FormData, "confirmPassword">
      
      // Pass the reCAPTCHA token along with the form data
      await onSubmit(submitData, recaptchaToken)
    } catch (error) {
      console.error('Form submission error:', error)
      setError("root", {
        type: "manual",
        message: "An error occurred. Please try again."
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    if (!onGoogleSignUp) return
    try {
      setGoogleLoading(true)
      await onGoogleSignUp()
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Load reCAPTCHA Enterprise script */}
      <Script
        src={`https://www.google.com/recaptcha/enterprise.js?render=${recaptchaSiteKey}`}
        onLoad={handleRecaptchaLoad}
        strategy="afterInteractive"
      />
      
      <Card className={className}>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>
            Sign up to start learning pathology
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-0">
            {onGoogleSignUp && (
              <div className="space-y-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignUp}
                  disabled={isLoading || googleLoading}
                >
                  {googleLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.google className="mr-2 h-4 w-4" />
                  )}
                  Sign up with Google
                </Button>

              <div className="relative text-sm">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative text-center">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
            </div>
            )}

            {/* Form fields remain the same */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  aria-invalid={!!errors.firstName}
                  disabled={isLoading}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive" role="alert">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  aria-invalid={!!errors.lastName}
                  disabled={isLoading}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive" role="alert">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                {...register("email")}
                aria-invalid={!!errors.email}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive" role="alert">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                onChange={(e) => {
                  setPassword(e.target.value);
                  register("password").onChange(e);
                }}
                onFocus={() => setPasswordFocused(true)}
                onBlur={(e) => {
                  register("password").onBlur(e);
                  // Keep requirements visible if there's text but not if empty
                  if (!e.target.value) {
                    setPasswordFocused(false);
                  }
                }}
                aria-invalid={!!errors.password}
                disabled={isLoading}
              />
              <PasswordRequirements password={password} visible={passwordFocused || !!errors.password} />
              <PasswordStrength password={password} />
              {errors.password && (
                <p className="text-sm text-destructive" role="alert">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword" 
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
                aria-invalid={!!errors.confirmPassword}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive" role="alert">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="userType">User Type</Label>
              <Select
                value={watch("userType")}
                onValueChange={val => setValue("userType", val)}
                disabled={isLoading}
              >
                <SelectTrigger id="userType">
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="fellow">Fellow</SelectItem>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* General error display */}
            {errors.root && (
              <div className="text-sm text-destructive text-center mt-4" role="alert">
                {errors.root.message}
              </div>
            )}

            <div>
              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading && (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Account
              </Button>
            </div>
            <div>
              <div className="text-center text-sm text-muted-foreground mt-4">
                Already have an account?{" "}
                <Link 
                  href="/login" 
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Login
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary space-y-1">
        <div>By signing up, you agree to our</div>
        <div>
          <Link href="/terms" tabIndex={0}>Terms of Service</Link>{" "}
          and{" "}
          <Link href="/privacy" tabIndex={0}>Privacy Policy</Link>.
        </div>
        {/* reCAPTCHA disclaimer */}
        <div className="mt-2">
          This site is protected by reCAPTCHA and the Google
          {" "}<Link href="https://policies.google.com/privacy">Privacy Policy</Link>{" "}
          and{" "}<Link href="https://policies.google.com/terms">Terms of Service</Link>{" "}
          apply.
        </div>
      </div>
    </div>
  )
}