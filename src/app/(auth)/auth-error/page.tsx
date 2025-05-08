// src/app/(auth)/auth-error/page.tsx
"use client"

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle } from "lucide-react"
import Link from 'next/link'
import { Button } from "@/components/ui/button"
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { StatusCard } from '@/components/auth/ui/status-card'

// Separate component that uses useSearchParams
function AuthErrorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState({
    code: '',
    title: 'Authentication Error',
    description: 'An error occurred during authentication.'
  })
  
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
    
    // Set appropriate error message based on the code
    if (errorCode === 'otp_expired' || errorType === 'access_denied') {
      setError({
        code: errorCode,
        title: 'Link Expired',
        description: 'Your email verification link has expired or is invalid. Please request a new verification link.'
      })
    } else if (errorCode === 'user_not_found') {
      setError({
        code: errorCode,
        title: 'User Not Found',
        description: 'We couldn\'t find an account associated with this verification link.'
      })
    } else if (errorCode === 'invalid_token') {
      setError({
        code: errorCode,
        title: 'Invalid Token',
        description: 'The authentication token is invalid or has been tampered with.'
      })
    } else if (errorDesc) {
      // Use the provided error description if available
      setError({
        code: errorCode || errorType,
        title: 'Authentication Error',
        description: errorDesc
      })
    }
    
    console.log('Auth error details:', { errorCode, errorType, errorDesc })
  }, [searchParams])

  return (
    <StatusCard
      title={error.title}
      description={error.description}
      icon={<AlertTriangle className="h-6 w-6" />}
      content="If you're trying to sign up or reset your password, you can request a new link below."
      footer={
        <div className="flex flex-col gap-4 w-full">
          {error.code === 'otp_expired' && (
            <Button 
              onClick={() => router.push('/forgot-password')}
              className="w-full"
            >
              Request New Link
            </Button>
          )}
          <Button 
            variant={error.code === 'otp_expired' ? "outline" : "default"}
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