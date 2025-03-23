// src/app/(auth)/verify-email/page.tsx
"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Microscope } from "lucide-react"
import Link from "next/link"
import { ResendVerification } from "@/components/auth/resend-verification"

export default function VerifyEmailPage() {
  const [email, setEmail] = useState<string>('')
  
  // Move the localStorage check to useEffect to prevent hydration mismatch
  useEffect(() => {
    // Get email from localStorage after component mounts on client
    const storedEmail = localStorage.getItem('pendingVerificationEmail') || ''
    setEmail(storedEmail)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <Card className="w-full p-8 space-y-6">
            <div className="flex flex-col items-center space-y-5 text-center">
              <h1 className="text-2xl font-bold">Check your email</h1>
              
              <p className="text-gray-500 text-lg">
                We've sent you a verification link. Please check your email to verify your account.
              </p>
              
              <p className="text-sm text-gray-500">
                If you don't see the email, check your spam folder. The link will expire in 24 hours.
              </p>
              
              {email && (
                <div className="w-full pt-3">
                  <ResendVerification email={email} />
                </div>
              )}
              
              <Link 
                href="/" 
                className="text-primary hover:underline text-sm mt-2"
              >
                Return to home page
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}