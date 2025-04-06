// src/app/(auth)/email-verified/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Microscope, Check } from "lucide-react"
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"

export default function EmailVerifiedPage() {
  const [countdown, setCountdown] = useState(5)
  const router = useRouter()

  // Automatic redirect countdown
  useEffect(() => {
    const timer = setTimeout(() => {
      if (countdown > 1) {
        setCountdown(countdown - 1)
      } else {
        router.push('/login')
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [countdown, router])

  // Clear localStorage when page loads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pendingVerificationEmail')
    }
  }, [])

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
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-xl">Email verified!</CardTitle>
              <CardDescription>
                Your email has been successfully verified
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Thank you for verifying your email. Your account is now activated and ready to use.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button asChild>
                <Link href="/login">
                  Proceed to login ({countdown})
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}