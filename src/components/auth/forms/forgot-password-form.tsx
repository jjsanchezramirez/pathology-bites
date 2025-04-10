// src/components/auth/forgot-password-form.tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { AuthCard } from "@/components/auth/ui/auth-card"
import { FormField } from "@/components/auth/ui/form-field"
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
          <FormField
            id="email"
            label="Email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            error={errors.email?.message}
            register={register}
            required
            disabled={isLoading}
          />
          
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