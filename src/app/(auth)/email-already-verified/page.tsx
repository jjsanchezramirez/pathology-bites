// app/(auth)/email-already-verified/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from "@/shared/components/ui/button"
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { StatusCard } from '@/features/auth/components/ui/status-card'

export default function EmailAlreadyVerifiedPage() {
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
        title="Email already verified"
        description="This email address has already been verified"
        content="Your email address is already verified. You can now log in to your account."
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