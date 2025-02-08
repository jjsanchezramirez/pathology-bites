'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Icons } from "@/components/theme/icons"

const formSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  userType: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type FormData = z.infer<typeof formSchema>

interface SignupFormProps {
  className?: string
  onSubmit: (values: Omit<FormData, "confirmPassword">) => Promise<void>
  onGoogleSignUp?: () => Promise<void>
}

export function SignupForm({ className, onSubmit, onGoogleSignUp }: SignupFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      userType: 'resident'
    }
  })

  const onFormSubmit = async (values: FormData) => {
    try {
      setIsLoading(true)
      const { confirmPassword, ...submitData } = values
      await onSubmit(submitData)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    if (!onGoogleSignUp) return
    try {
      setGoogleLoading(true)
      await onGoogleSignUp()
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className={className}>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>
            Sign up to start learning pathology
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-0">
            {onGoogleSignUp && (
              <div className="space-y-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignUp}
                  disabled={isLoading || googleLoading}
                >
                  {googleLoading ? (
                    <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Icons.google className="mr-2 h-4 w-4" />
                  )}
                  Sign up with Google
                </Button>

              <div className="relative text-sm">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative text-center">
                  <span className="bg-card px-2 text-muted-foreground">
                    Or continue with
                  </span>
                </div>
              </div>
            </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  aria-invalid={!!errors.firstName}
                  disabled={isLoading}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive" role="alert">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  aria-invalid={!!errors.lastName}
                  disabled={isLoading}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive" role="alert">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                {...register("email")}
                aria-invalid={!!errors.email}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive" role="alert">{errors.email.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register("password")}
                aria-invalid={!!errors.password}
                disabled={isLoading}
              />
              {errors.password && (
                <p className="text-sm text-destructive" role="alert">{errors.password.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword" 
                type="password"
                autoComplete="new-password"
                {...register("confirmPassword")}
                aria-invalid={!!errors.confirmPassword}
                disabled={isLoading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive" role="alert">{errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="userType">User Type</Label>
              <Select
                value={watch("userType")}
                onValueChange={val => setValue("userType", val)}
                disabled={isLoading}
              >
                <SelectTrigger id="userType">
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="fellow">Fellow</SelectItem>
                  <SelectItem value="attending">Attending</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Button type="submit" className="w-full mt-6" disabled={isLoading}>
                {isLoading && (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Account
              </Button>
            </div>
            <div>
              <div className="text-center text-sm text-muted-foreground mt-4">
                Already have an account?{" "}
                <Link 
                  href="/login" 
                  className="text-foreground underline underline-offset-4 hover:text-primary"
                >
                  Login
                </Link>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a]:hover:text-primary space-y-1">
  <div>By signing up, you agree to our</div>
  <div>
    <Link href="/terms" tabIndex={0}>Terms of Service</Link>{" "}
    and{" "}
    <Link href="/privacy" tabIndex={0}>Privacy Policy</Link>.
  </div>
</div>
    </div>
  )
}