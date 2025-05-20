// src/app/(auth)/auth-error/page.tsx
"use client"

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, RefreshCw, Mail, ArrowRight } from "lucide-react"
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { StatusCard } from '@/components/auth/ui/status-card'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'

// Separate component that uses useSearchParams
function AuthErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resendVerification, isLoading } = useAuth()
  const { toast } = useToast()
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null)
  const [error, setError] = useState({
    code: '',
    title: 'Authentication Error',
    description: 'An error occurred during authentication.',
    errorType: 'generic' // Add an errorType field to control recovery options
  })
  
  // Get email from localStorage if available (for resending verification)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedEmail = localStorage.getItem('pendingVerificationEmail')
      if (storedEmail) {
        setRecoveryEmail(storedEmail)
      }
    }
  }, [])
  
  // Parse error info from URL on component mount
  useEffect(() => {
    // Check for hash errors (like from Supabase OTP links)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    
    // Check for query params (from our own redirects)
    const queryError = searchParams.get('error')
    const queryCode = searchParams.get('code')
    const queryDescription = searchParams.get('description')
    
    // Hash params take precedence (from Supabase)
    const errorCode = hashParams.get('error_code') || queryCode || ''
    const errorType = hashParams.get('error') || queryError || ''
    const errorDesc = hashParams.get('error_description') || queryDescription || ''
    
    // Set appropriate error message based on the code/type
    if (errorCode === 'otp_expired' || errorType === 'access_denied') {
      setError({
        code: errorCode || errorType,
        title: 'Link Expired',
        description: 'Your email verification link has expired or is invalid. Please request a new verification link.',
        errorType: 'expired_link'
      })
    } else if (errorCode === 'user_not_found') {
      setError({
        code: errorCode,
        title: 'User Not Found',
        description: 'We couldn\'t find an account associated with this verification link.',
        errorType: 'user_not_found'
      })
    } else if (errorCode === 'invalid_token') {
      setError({
        code: errorCode,
        title: 'Invalid Token',
        description: 'The authentication token is invalid or has been tampered with.',
        errorType: 'invalid_token'
      })
    } else if (errorType === 'exchange_failed' || (errorDesc && errorDesc.includes('code challenge'))) {
      // Specific handling for PKCE errors - the one you're encountering
      setError({
        code: errorCode,
        title: 'Verification Link Error',
        description: 'This verification link is invalid or has already been used. This can happen if you click the link multiple times or use it in a different browser.',
        errorType: 'pkce_error'
      })
    } else if (errorDesc) {
      // Use the provided error description for other errors
      setError({
        code: errorCode || errorType,
        title: 'Authentication Error',
        description: errorDesc,
        errorType: 'generic'
      })
    }
    
    console.log('Auth error details:', { errorCode, errorType, errorDesc })
  }, [searchParams])

  // Handle resending verification email
  const handleResendVerification = async () => {
    if (!recoveryEmail) {
      toast({
        variant: "destructive",
        title: "Email Not Found",
        description: "We couldn't find your email address. Please try signing up again."
      })
      return
    }

    try {
      await resendVerification(recoveryEmail)
      toast({
        title: "Verification Email Sent",
        description: `We've sent a new verification link to ${recoveryEmail}`
      })
      router.push('/verify-email')
    } catch (err) {  // Changed 'error' to 'err' to avoid name conflict
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to resend verification email: ${errorMessage}`
      })
    }
  }

  return (
    <StatusCard
      title={error.title}
      description={error.description}
      icon={<AlertTriangle className="h-6 w-6" />}
      content={
        <div className="text-center">
          {error.errorType === 'pkce_error' || error.errorType === 'expired_link' ? 
            "This link cannot be used anymore. You'll need to request a new verification link to continue." :
            "If you're trying to sign up or reset your password, you can request a new link below."}
        </div>
      }
      footer={
        <div className="flex flex-col gap-4 w-full">
          {/* PKCE Error - Resend verification */}
          {(error.errorType === 'pkce_error' && recoveryEmail) && (
            <Button 
              onClick={handleResendVerification}
              className="w-full"
              disabled={isLoading}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Resend Verification Email
            </Button>
          )}
          
          {/* PKCE Error - No saved email */}
          {(error.errorType === 'pkce_error' && !recoveryEmail) && (
            <Button 
              onClick={() => router.push('/signup')}
              className="w-full"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Sign Up Again
            </Button>
          )}
          
          {/* Expired link - Password reset */}
          {error.errorType === 'expired_link' && (
            <Button 
              onClick={() => router.push('/forgot-password')}
              className="w-full"
            >
              <Mail className="mr-2 h-4 w-4" />
              Request New Link
            </Button>
          )}
          
          {/* Always show back to login */}
          <Button 
            variant={['pkce_error', 'expired_link'].includes(error.errorType) ? "outline" : "default"}
            className="w-full"
            asChild
          >
            <Link href="/login">Back to Login</Link>
          </Button>
        </div>
      }
      variant="error"
    />
  )
}

// Loading fallback component
function AuthErrorLoading() {
  return (
    <StatusCard
      title="Loading..."
      description="Please wait while we process your request."
      icon={<AlertTriangle className="h-6 w-6" />}
      variant="default"
    />
  )
}

// Main page component with Suspense
export default function AuthErrorPage() {
  return (
    <AuthPageLayout>
      <Suspense fallback={<AuthErrorLoading />}>
        <AuthErrorContent />
      </Suspense>
    </AuthPageLayout>
  )
}