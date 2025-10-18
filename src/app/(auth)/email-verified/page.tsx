// app/(auth)/email-verified/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/shared/components/ui/button"
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { StatusCard } from '@/features/auth/components/ui/status-card'

export default function EmailVerifiedPage() {
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
        title="Email verified!"
        description="Your email has been successfully verified"
        content="Thank you for verifying your email. Your account is now activated and ready to use."
        footer={
          <Button asChild className="w-full">
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