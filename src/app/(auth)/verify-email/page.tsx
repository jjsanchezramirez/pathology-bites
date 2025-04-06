// src/app/(auth)/verify-email/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Icons } from "@/components/theme/icons"
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useToast } from '@/hooks/use-toast'

export default function VerifyEmailPage() {
  const [email, setEmail] = useState<string>('')
  const { resendVerification, isLoading } = useAuth()
  const [resending, setResending] = useState(false)
  const isOnline = useNetworkStatus()
  const { toast } = useToast()

  // Get email from local storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('pendingVerificationEmail')
      if (storedEmail) {
        setEmail(storedEmail)
      }
    }
  }, [])

  const handleResendVerification = async () => {
    // Check if online first
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "You appear to be offline. Please check your internet connection and try again."
      })
      return
    }

    if (!email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Email address not found. Please try signing up again."
      })
      return
    }

    try {
      setResending(true)
      await resendVerification(email)
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Icons.mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription>
                We've sent a verification link to{" "}
                <span className="font-medium text-foreground">
                  {email || "your email address"}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Please check your email and click the verification link to activate your account.
                If you don't see the email, check your spam folder.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button 
                className="w-full"
                onClick={handleResendVerification}
                disabled={isLoading || resending}
              >
                {(resending || isLoading) ? (
                  <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Resend verification email
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                asChild
              >
                <Link href="/login">Back to login</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}