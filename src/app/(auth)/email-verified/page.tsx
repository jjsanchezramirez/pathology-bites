// src/app/(auth)/email-verified/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { StatusCard } from '@/components/auth/ui/status-card'

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
    <AuthPageLayout>
      <StatusCard
        title="Email verified!"
        description="Your email has been successfully verified"
        content="Thank you for verifying your email. Your account is now activated and ready to use."
        footer={
          <Button asChild>
            <Link href="/login">
              Proceed to login ({countdown})
            </Link>
          </Button>
        }
        variant="success"
      />
    </AuthPageLayout>
  )
}