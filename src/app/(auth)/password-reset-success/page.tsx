// src/app/(auth)/password-reset-success/page.tsx - New success page
"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { StatusCard } from '@/components/auth/ui/status-card'

export default function PasswordResetSuccessPage() {
  const [countdown, setCountdown] = useState(5)
  const router = useRouter()

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

  return (
    <AuthPageLayout>
      <StatusCard
        title="Password Reset Successful"
        description="Your password has been successfully updated"
        content="You can now log in with your new password."
        footer={
          <Button asChild>
            <Link href="/login">
              Continue to login ({countdown})
            </Link>
          </Button>
        }
        variant="success"
      />
    </AuthPageLayout>
  )
}