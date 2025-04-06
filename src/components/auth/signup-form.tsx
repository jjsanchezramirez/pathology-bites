// src/components/auth/signup-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/theme/icons"
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
    trigger,
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
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>
            Join Pathology Bites to start learning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="firstName" id="firstName-label">First Name</Label>
                  <Input
                    id="firstName"
                    {...register("firstName")}
                    placeholder="John"
                    aria-invalid={!!errors.firstName}
                    aria-describedby={errors.firstName ? "firstName-error" : undefined}
                    aria-labelledby="firstName-label"
                    disabled={isSubmitting}
                  />
                  {errors.firstName && (
                    <p 
                      className="text-sm text-destructive" 
                      role="alert"
                      id="firstName-error"
                    >
                      {errors.firstName.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName" id="lastName-label">Last Name</Label>
                  <Input
                    id="lastName"
                    {...register("lastName")}
                    placeholder="Doe"
                    aria-invalid={!!errors.lastName}
                    aria-describedby={errors.lastName ? "lastName-error" : undefined}
                    aria-labelledby="lastName-label"
                    disabled={isSubmitting}
                  />
                  {errors.lastName && (
                    <p 
                      className="text-sm text-destructive" 
                      role="alert"
                      id="lastName-error"
                    >
                      {errors.lastName.message}
                    </p>
                  )}
                </div>
              </div>
              
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
                  disabled={isSubmitting}
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
                <Label htmlFor="userType" id="userType-label">What best describes you?</Label>
                <Select 
                  value={userType} 
                  onValueChange={handleUserTypeChange}
                  disabled={isSubmitting}
                >
                  <SelectTrigger 
                    id="userType"
                    aria-invalid={!!errors.userType}
                    aria-describedby={errors.userType ? "userType-error" : undefined}
                    aria-labelledby="userType-label"
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
                {errors.userType && (
                  <p 
                    className="text-sm text-destructive" 
                    role="alert"
                    id="userType-error"
                  >
                    {errors.userType.message}
                  </p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="password" id="password-label">Password</Label>
                <Input
                  id="password"
                  {...register("password")}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  aria-labelledby="password-label"
                  disabled={isSubmitting}
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
              
              <div className="grid gap-2">
                <Label htmlFor="confirmPassword" id="confirmPassword-label">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  {...register("confirmPassword")}
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                  aria-labelledby="confirmPassword-label"
                  disabled={isSubmitting}
                />
                {errors.confirmPassword && (
                  <p 
                    className="text-sm text-destructive" 
                    role="alert"
                    id="confirmPassword-error"
                  >
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting}
              >
                {loading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Account
              </Button>
              
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
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary">
        By clicking create account, you agree to our{" "}
        <Link href="/terms" tabIndex={0}>Terms of Service</Link>{" "}
        and{" "}
        <Link href="/privacy" tabIndex={0}>Privacy Policy</Link>.
      </div>
    </div>
  )
}