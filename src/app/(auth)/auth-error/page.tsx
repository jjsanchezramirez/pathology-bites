// src/app/(auth)/auth-error/page.tsx - Fixed auth error page (client component only)
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { createClient } from '@/lib/supabase/client'

function AuthErrorContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { resendVerification, resetPassword } = useAuth()
  const { toast } = useToast()
  const [isResending, setIsResending] = useState(false)
  const [email, setEmail] = useState<string>('')
  const [mounted, setMounted] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  const error = searchParams.get('error')
  const description = searchParams.get('description')
  const errorCode = searchParams.get('error_code')
  const type = searchParams.get('type')

  useEffect(() => {
    setMounted(true)
    const storedEmail = localStorage.getItem('pendingVerificationEmail')
    if (storedEmail) {
      setEmail(storedEmail)
    }
  }, [])

  // Check if user is already verified when page loads for access_denied errors
  useEffect(() => {
    const checkVerificationStatus = async () => {
      if (error === 'access_denied' && description?.includes('expired') && mounted) {
        setIsCheckingStatus(true)
        try {
          // Use a simple client to check verification status
          const supabase = createClient()
          
          // Try to get current session/user
          const { data: { user }, error: userError } = await supabase.auth.getUser()
          
          if (!userError && user && user.email_confirmed_at) {
            console.log('User is already verified, redirecting to already-verified page')
            router.push('/email-already-verified')
            return
          }
          
          // If we have an email stored, check if that email is verified by trying to sign in
          if (email) {
            console.log('Checking verification status for stored email:', email)
            // We'll just proceed with showing the expired link error since we can't easily check
            // another user's verification status without their password
          }
          
        } catch (error) {
          console.error('Error checking verification status:', error)
        } finally {
          setIsCheckingStatus(false)
        }
      }
    }
    
    checkVerificationStatus()
  }, [error, description, mounted, email, router])

  // Determine error type
  const isEmailVerificationError = (error === 'access_denied' || error === 'signup_disabled') && 
    (errorCode === 'otp_expired' || 
     description?.toLowerCase().includes('expired') ||
     description?.toLowerCase().includes('invalid') ||
     description?.toLowerCase().includes('confirmation'))

  const isPasswordResetError = type === 'recovery' || 
    description?.toLowerCase().includes('password') ||
    description?.toLowerCase().includes('reset')

  const isMissingParamsError = error === 'missing_params' || 
    description?.toLowerCase().includes('missing')

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

  const handleResendPasswordReset = async () => {
    if (!email) {
      router.push('/forgot-password')
      return
    }

    setIsResending(true)
    try {
      const success = await resetPassword(email)
      if (success) {
        router.push('/check-email')
      }
    } catch {
      toast({
        variant: "destructive",
        description: "Failed to send password reset email. Please try again."
      })
    } finally {
      setIsResending(false)
    }
  }

  if (!mounted) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto">
          <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
        </div>
      </AuthPageLayout>
    )
  }

  // Show loading while checking verification status
  if (isCheckingStatus) {
    return (
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking verification status...</p>
        </div>
      </AuthPageLayout>
    )
  }

  // Email verification expired/invalid error
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
            <p className="text-sm text-gray-600 text-center">
              Verification links expire after 10 minutes for security reasons.
            </p>
            
            {email ? (
              <>
                <p className="text-sm text-gray-600 text-center">
                  We'll send a new verification email to: <br />
                  <strong>{email}</strong>
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

  // Password reset error
  if (isPasswordResetError) {
    return (
      <AuthPageLayout>
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <div className="h-8 w-8 text-red-600">✕</div>
            </div>
            <CardTitle className="text-xl text-gray-900">
              Password Reset Link Expired
            </CardTitle>
            <CardDescription className="text-gray-600">
              Your password reset link has expired or is no longer valid
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Password reset links expire after 10 minutes for security reasons.
            </p>
            
            <Button 
              onClick={handleResendPasswordReset}
              disabled={isResending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {isResending ? 'Sending...' : 'Send New Reset Link'}
            </Button>
            
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

  // Missing parameters error (often happens with resend links)
  if (isMissingParamsError) {
    return (
      <AuthPageLayout>
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <div className="h-8 w-8 text-red-600">!</div>
            </div>
            <CardTitle className="text-xl text-gray-900">
              Invalid Link
            </CardTitle>
            <CardDescription className="text-gray-600">
              The verification link is incomplete or corrupted
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              This can happen if the email link was not copied completely or if you're accessing it from a different device.
            </p>
            
            {email ? (
              <>
                <p className="text-sm text-gray-600 text-center">
                  We'll send a new verification email to: <br />
                  <strong>{email}</strong>
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
              <Button 
                onClick={() => router.push('/signup')}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                Sign Up Again
              </Button>
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
          {description && (
            <p className="text-sm text-gray-600 text-center bg-gray-50 p-3 rounded">
              {description}
            </p>
          )}
          
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