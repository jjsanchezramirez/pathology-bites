// src/components/auth/forms/reset-password-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AuthCard } from "@/components/auth/ui/auth-card"
import { FormButton } from "@/components/auth/ui/form-button"

// Form schema definition
const formSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// Define type for form data
type FormData = z.infer<typeof formSchema>

interface ResetPasswordFormProps {
  className?: string
  onSubmit?: (password: string) => Promise<void>
  isLoading?: boolean
}

export function ResetPasswordForm({
  className,
  onSubmit,
  isLoading: parentLoading = false,
  ...props
}: ResetPasswordFormProps) {
  const [formLoading, setFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Compute the overall loading state
  const loading = parentLoading || formLoading

  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  // Form submission handler
  async function onFormSubmit(values: FormData) {
    if (!onSubmit) return
    
    try {
      setError(null)
      setFormLoading(true)
      await onSubmit(values.password)
    } catch (error) {
      console.error("Form submission error:", error)
      setError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setFormLoading(false)
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
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid gap-4">
          {/* Password Field */}
          <div className="space-y-2">
            <label 
              htmlFor="password" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              New Password
            </label>
            <input
              {...register("password")}
              id="password"
              type="password"
              autoComplete="new-password"
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.password && (
              <p className="text-sm font-medium text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <label 
              htmlFor="confirmPassword" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Confirm Password
            </label>
            <input
              {...register("confirmPassword")}
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              disabled={loading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.confirmPassword && (
              <p className="text-sm font-medium text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

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
            isLoading={formLoading}
            loadingText="Updating password..."
            disabled={loading}
          >
            Update Password
          </FormButton>
        </div>
      </form>
    </AuthCard>
  )
}