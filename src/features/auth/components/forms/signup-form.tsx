// src/features/auth/components/forms/signup-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Turnstile } from '@marsidev/react-turnstile'
import { AuthCard } from "@/features/auth/components/ui/auth-card"
import { FormField } from "@/features/auth/components/ui/form-field"
import { FormButton } from "@/features/auth/components/ui/form-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"
import { createClient } from '@/shared/services/client'
import { useTurnstile } from '@/features/auth/hooks/use-turnstile'

// Enhanced form schema with proper password validation
const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  userType: z.enum(["student", "resident", "fellow", "attending", "other"], {
    invalid_type_error: "Please select your role",
  }),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>

export function SignupForm() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { captchaToken, setCaptchaToken } = useTurnstile()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
    setValue,
    watch,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      userType: "student" as const,
      password: "",
      confirmPassword: "",
    },
  })

  const userType = watch("userType")

  // Function to check if email already exists
  async function checkEmailExists(email: string): Promise<boolean> {
    try {
      const response = await fetch('/api/public/auth/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error checking email existence:', {
          status: response.status,
          error: errorData.error
        })
        // If the API fails, we should fail safely by not allowing signup
        // This prevents users from bypassing the check
        throw new Error(`Email check failed: ${errorData.error || 'Unknown error'}`)
      }

      const data = await response.json()
      return data.exists
    } catch (error) {
      console.error("Error checking email existence:", error)
      // Re-throw to let the caller handle it
      throw error
    }
  }

  async function onSubmit(values: FormData) {
    try {
      setLoading(true)

      // Check if email already exists (single source of truth via public.users)
      try {
        const emailExists = await checkEmailExists(values.email)
        if (emailExists) {
          toast.error("An account with this email already exists")
          return
        }
      } catch (emailCheckError) {
        console.error('Email check failed:', emailCheckError)
        toast.error("Unable to verify email availability. Please try again.")
        return
      }

      // Use environment variable for redirect URL with fallback
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const redirectTo = `${siteUrl}/api/public/auth/confirm`

      console.log('Signup attempt:', {
        email: values.email,
        redirectTo,
        siteUrl,
        userData: {
          first_name: values.firstName,
          last_name: values.lastName,
          user_type: values.userType,
        }
      })

      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            user_type: values.userType,
          },
          emailRedirectTo: redirectTo,
          captchaToken: captchaToken || undefined,
        },
      })

      console.log('Supabase signup response:', { data, error })

      if (error) {
        console.error("Supabase signup error details:", {
          message: error.message,
          status: error.status,
          name: error.name,
          cause: error.cause,
          stack: error.stack
        })

        if (error.message.includes('User already registered')) {
          toast.error("An account with this email already exists")
        } else {
          toast.error(`Signup failed: ${error.message}`)
        }
        return
      }

      console.log('Signup successful, redirecting to verification page')
      // Success - redirect to verification page
      router.push(`/verify-email?email=${encodeURIComponent(values.email)}`)
    } catch (error) {
      console.error("Signup error:", error)
      toast.error("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  function handleUserTypeChange(value: string) {
    if (value === "student" || value === "resident" || value === "fellow" || value === "attending" || value === "other") {
      setValue("userType", value, { shouldValidate: true })
    }
  }

  return (
    <AuthCard
      title="Create your account"
      description="Join Pathology Bites to start learning"
      showPrivacyFooter
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* First Name and Last Name */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            id="firstName"
            label="First Name"
            placeholder="John"
            error={isSubmitted ? errors.firstName?.message : undefined}
            disabled={loading}
            {...register("firstName")}
          />
          <FormField
            id="lastName"
            label="Last Name"
            placeholder="Doe"
            error={isSubmitted ? errors.lastName?.message : undefined}
            disabled={loading}
            {...register("lastName")}
          />
        </div>

        {/* Email */}
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

        {/* User Type */}
        <FormField
          id="userType"
          label="What best describes you?"
          error={isSubmitted ? errors.userType?.message : undefined}
        >
          <Select
            value={userType}
            onValueChange={handleUserTypeChange}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="resident">Resident</SelectItem>
              <SelectItem value="fellow">Fellow</SelectItem>
              <SelectItem value="attending">Attending</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {/* Password */}
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          error={isSubmitted ? errors.password?.message : undefined}
          disabled={loading}
          {...register("password")}
        />

        {/* Confirm Password */}
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

        {/* Turnstile CAPTCHA - Only show if sitekey is configured */}
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
          {loading ? "Creating Account..." : "Create Account"}
        </FormButton>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            Log in
          </Link>
        </div>
      </form>
    </AuthCard>
  )
}