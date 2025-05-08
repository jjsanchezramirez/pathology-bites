// src/components/auth/forms/reset-password-form.tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { AuthCard } from "@/components/auth/ui/auth-card"
import { FormField } from "@/components/auth/ui/form-field"
import { FormButton } from "@/components/auth/ui/form-button"

// Form schema definition
const formSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

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
  isLoading = false,
  ...props
}: ResetPasswordFormProps) {
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
    if (onSubmit) {
      await onSubmit(values.password)
    }
  }

  return (
    <AuthCard
      title="Create new password"
      description="Enter a new strong password for your account"
      className={className}
      {...props}
    >
      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        <div className="grid gap-4">
          <FormField
            id="password"
            name="password" // Add name property
            label="New Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            register={register}
            required
            disabled={isLoading}
          />
          
          <FormField
            id="confirmPassword"
            name="confirmPassword" // Add name property
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            register={register}
            required
            disabled={isLoading}
          />
          
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
            isLoading={isLoading}
            loadingText="Updating..."
          >
            Update Password
          </FormButton>
        </div>
      </form>
    </AuthCard>
  )
}