// src/app/(auth)/forgot-password/page.tsx
"use client"

import { ForgotPasswordForm } from '@/components/auth/forms/forgot-password-form'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { useAuth } from '@/hooks/use-auth'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useToast } from '@/hooks/use-toast'

export default function ForgotPasswordPage() {
  const { resetPassword, isLoading } = useAuth()
  const isOnline = useNetworkStatus()
  const { toast } = useToast()

  const handleResetPassword = async (email: string) => {
    // Check if online first
    if (!isOnline) {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "You appear to be offline. Please check your internet connection and try again."
      })
      return
    }

    // Use the resetPassword function from the hook
    await resetPassword(email)
  }

  return (
    <AuthPageLayout maxWidth="sm">
      <ForgotPasswordForm 
        onSubmit={handleResetPassword}
        isLoading={isLoading}
      />
    </AuthPageLayout>
  )
}