// src/components/auth/forms/forgot-password-form.tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { AuthCard } from "@/components/auth/ui/auth-card"
import { FormButton } from "@/components/auth/ui/form-button"

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

// Define type for form data
type FormData = z.infer<typeof formSchema>

interface ForgotPasswordFormProps {
  className?: string
  onSubmit?: (email: string) => Promise<void>
  isLoading?: boolean
}

export function ForgotPasswordForm({
  className,
  onSubmit,
  isLoading = false,
  ...props
}: ForgotPasswordFormProps) {
  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  // Form submission handler
  async function onFormSubmit(values: FormData) {
    if (onSubmit) {
      await onSubmit(values.email)
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
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid gap-4">
          <div className="space-y-2">
            <label 
              htmlFor="email" 
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Email
            </label>
            <input
              {...register("email")}
              id="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              disabled={isLoading}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.email && (
              <p className="text-sm font-medium text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
          
          <FormButton 
            type="submit" 
            fullWidth
            isLoading={isLoading}
            loadingText="Sending..."
          >
            Send reset link
          </FormButton>
        </div>
      </form>
    </AuthCard>
  )
}