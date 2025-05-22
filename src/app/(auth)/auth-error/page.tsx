// src/app/(auth)/auth-error/page.tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { resendVerification } = useAuth()
  const { toast } = useToast()
  const [isResending, setIsResending] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  const error = searchParams.get('error')
  const description = searchParams.get('description')
  const errorCode = searchParams.get('error_code')

  // Fix hydration by only accessing localStorage after mount
  useEffect(() => {
    setMounted(true)
    const storedEmail = localStorage.getItem('pendingVerificationEmail')
    if (storedEmail) {
      setEmail(storedEmail)
    }
  }, [])

  // Check if this is an email verification related error
  const isEmailVerificationError = error === 'access_denied' && 
    (errorCode === 'otp_expired' || 
     description?.toLowerCase().includes('expired') ||
     description?.toLowerCase().includes('invalid'))

  const handleResendVerification = async () => {
    if (!email) {
      toast({
        variant: "destructive",
        description: "No email found. Please try signing up again."
      })
      router.push('/signup')
      return
    }

    setIsResending(true)
    try {
      const success = await resendVerification(email)
      if (success) {
        toast({
          description: "New verification email sent!"
        })
        router.push('/verify-email')
      }
    } catch {
      toast({
        variant: "destructive",
        description: "Failed to send verification email. Please try again."
      })
    } finally {
      setIsResending(false)
    }
  }

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto">
          <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </AuthPageLayout>
    )
  }

  // Email verification expired error
  if (isEmailVerificationError) {
    return (
      <AuthPageLayout>
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <div className="h-8 w-8 text-red-600">✕</div>
            </div>
            <CardTitle className="text-xl text-gray-900">
              Verification Link Expired
            </CardTitle>
            <CardDescription className="text-gray-600">
              Your email verification link has expired or is no longer valid
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {email ? (
              <>
                <p className="text-sm text-gray-600 text-center">
                  We'll send a new verification email to: <strong>{email}</strong>
                </p>
                
                <Button 
                  onClick={handleResendVerification}
                  disabled={isResending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {isResending ? 'Sending...' : 'Send New Verification Email'}
                </Button>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 text-center">
                  Please sign up again to receive a new verification link
                </p>
                
                <Button 
                  onClick={() => router.push('/signup')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Sign Up Again
                </Button>
              </>
            )}
            
            <Button 
              variant="outline"
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </AuthPageLayout>
    )
  }

  // General authentication error
  return (
    <AuthPageLayout>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <div className="h-8 w-8 text-red-600">!</div>
          </div>
          <CardTitle className="text-xl text-gray-900">
            Authentication Error
          </CardTitle>
          <CardDescription className="text-gray-600">
            {description || 'An error occurred during authentication'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button 
              onClick={() => router.push('/login')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              Back to Login
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => router.push('/signup')}
              className="w-full"
            >
              Create New Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthPageLayout>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto">
          <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </AuthPageLayout>
    }>
      <AuthErrorContent />
    </Suspense>
  )
}