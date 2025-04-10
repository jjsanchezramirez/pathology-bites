// src/app/(auth)/signup/page.tsx
"use client"

import { SignupForm } from '@/components/auth/forms/signup-form'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import type { SignupFormData } from '@/types/auth'

export default function SignupPage() {
  const { toast } = useToast()
  const isOnline = useNetworkStatus()
  const { signup, isLoading } = useAuth()

  const handleSignup = async (values: SignupFormData) => {
    // Check if online first
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "You appear to be offline. Please check your internet connection and try again."
      })
      return
    }

    // Use the signup function from the hook
    await signup(values)
  }

  return (
    <AuthPageLayout maxWidth="md">
      <SignupForm 
        onSubmit={handleSignup}
        isLoading={isLoading}
      />
    </AuthPageLayout>
  )
}