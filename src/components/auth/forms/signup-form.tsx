// src/components/auth/signup-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { AuthCard } from "@/components/auth/ui/auth-card"
import { FormField } from "@/components/auth/ui/form-field"
import { FormButton } from "@/components/auth/ui/form-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { SignupFormData } from '@/types/auth'

// Form schema definition
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  userType: z.enum(["student", "resident", "fellow", "attending", "other"], {
    invalid_type_error: "Please select your role",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

interface SignupFormProps {
  className?: string
  onSubmit?: (values: SignupFormData) => Promise<void>
  isLoading?: boolean
}

export function SignupForm({
  className,
  onSubmit,
  isLoading = false,
  ...props
}: SignupFormProps) {
  const [loading, setLoading] = useState(false)
  
  // Compute the overall loading state
  const isSubmitting = isLoading || loading

  // Initialize form with useForm hook
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      userType: "student" as const,
    },
  })

  // Watch userType to update it when select changes
  const userType = watch("userType")

  // Form submission handler
  async function handleFormSubmit(values: z.infer<typeof formSchema>) {
    if (!onSubmit) return
    
    try {
      setLoading(true)
      
      // Create the signup data object
      const signupData: SignupFormData = {
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        userType: values.userType,
      }
      
      await onSubmit(signupData)
    } catch (error) {
      console.error("Form submission error:", error)
    } finally {
      setLoading(false)
    }
  }

  // Handle user type selection
  function handleUserTypeChange(value: string) {
    if (value === "student" || value === "resident" || value === "fellow" || value === "attending" || value === "other") {
      setValue("userType", value, { shouldValidate: true })
    }
  }

  return (
    <AuthCard
      title="Create your account"
      description="Join Pathology Bites to start learning"
      className={className}
      showPrivacyFooter
      {...props}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        <div className="grid gap-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="firstName"
              label="First Name"
              placeholder="John"
              error={errors.firstName?.message}
              register={register}
              required
              disabled={isSubmitting}
            />
            <FormField
              id="lastName"
              label="Last Name"
              placeholder="Doe"
              error={errors.lastName?.message}
              register={register}
              required
              disabled={isSubmitting}
            />
          </div>
          
          <FormField
            id="email"
            label="Email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            error={errors.email?.message}
            register={register}
            required
            disabled={isSubmitting}
          />
          
          <FormField
            id="userType"
            label="What best describes you?"
            error={errors.userType?.message}
            required
            disabled={isSubmitting}
          >
            <Select 
              value={userType} 
              onValueChange={handleUserTypeChange}
              disabled={isSubmitting}
            >
              <SelectTrigger 
                id="userType"
                aria-invalid={!!errors.userType}
                aria-describedby={errors.userType ? "userType-error" : undefined}
              >
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
          
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            register={register}
            required
            disabled={isSubmitting}
          />
          
          <FormField
            id="confirmPassword"
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            register={register}
            required
            disabled={isSubmitting}
          />
          
          <FormButton 
            type="submit" 
            fullWidth
            isLoading={loading}
            loadingText="Creating account..."
            disabled={isSubmitting}
          >
            Create Account
          </FormButton>
          
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link 
              href="/login" 
              className="text-foreground underline underline-offset-4 hover:text-primary"
              tabIndex={0}
            >
              Log in
            </Link>
          </div>
        </div>
      </form>
    </AuthCard>
  )
}