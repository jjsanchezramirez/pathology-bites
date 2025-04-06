// src/components/auth/reset-password-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/theme/icons"

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
  const [loading, setLoading] = useState(false)
  
  // Compute the overall loading state
  const isSubmitting = isLoading || loading

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
      setLoading(true)
      await onSubmit(values.password)
    } catch (error) {
      console.error("Form submission error:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create new password</CardTitle>
          <CardDescription>
            Enter a new strong password for your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="password" id="password-label">New Password</Label>
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
              
              <div className="text-sm text-muted-foreground">
                <p>Password must:</p>
                <ul className="list-disc list-inside space-y-1 pl-4 mt-1">
                  <li>Be at least 8 characters long</li>
                  <li>Include at least one uppercase letter</li>
                  <li>Include at least one lowercase letter</li>
                  <li>Include at least one number</li>
                </ul>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting}
              >
                {loading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Update Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}