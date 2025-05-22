// src/components/auth/forms/signup-form.tsx
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

// Enhanced form schema with proper password validation
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
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
  
  const isSubmitting = isLoading || loading

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

  const userType = watch("userType")

  async function handleFormSubmit(values: z.infer<typeof formSchema>) {
    if (!onSubmit) return
    
    try {
      setLoading(true)
      
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
              name="firstName"
              label="First Name"
              placeholder="John"
              error={errors.firstName?.message}
              register={register}
              required
              disabled={isSubmitting}
            />
            <FormField
              id="lastName"
              name="lastName"
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
            name="email"
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
            name="userType"
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
            name="password"
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
            name="confirmPassword"
            label="Confirm Password"
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            register={register}
            required
            disabled={isSubmitting}
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