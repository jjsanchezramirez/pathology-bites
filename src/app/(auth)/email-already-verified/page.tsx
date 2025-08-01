// app/(auth)/email-already-verified/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'

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
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <div className="h-8 w-8 text-green-600">✓</div>
          </div>
          <CardTitle className="text-xl text-gray-900">
            Email Already Verified
          </CardTitle>
          <CardDescription className="text-gray-600">
            This email address has already been verified
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600 text-center">
            Your email address is already verified. You can now log in to your account.
          </p>

          <div className="space-y-3">
            <Button 
              onClick={() => router.push('/login')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Go to Login ({countdown})
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => router.push('/signup')}
              className="w-full"
            >
              Create Different Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthPageLayout>
  )
}