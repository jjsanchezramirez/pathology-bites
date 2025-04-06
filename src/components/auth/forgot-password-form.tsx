// src/components/auth/forgot-password-form.tsx
"use client"

import { useState } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Icons } from "@/components/theme/icons"

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
      email: "",
    },
  })

  // Form submission handler
  async function onFormSubmit(values: FormData) {
    if (!onSubmit) return
    
    try {
      setLoading(true)
      await onSubmit(values.email)
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
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
            <div className="grid gap-4">
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
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting}
              >
                {loading ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Send reset link
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Button 
            variant="link" 
            asChild
            className="text-sm text-muted-foreground hover:text-primary"
          >
            <Link href="/login">Back to login</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}