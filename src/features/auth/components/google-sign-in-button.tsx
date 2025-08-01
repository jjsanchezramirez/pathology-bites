// src/components/auth/google-sign-in-button.tsx
'use client'

import { createClient } from '@/shared/services/client'
import { SocialButton } from '@/features/auth/components/ui/social-button'
import { toast } from 'sonner'

export function GoogleSignInButton() {
  // Check if we're in admin-only mode
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isAdminOnlyMode = isComingSoonMode || isMaintenanceMode

  const handleGoogleSignIn = async () => {
    // Block Google OAuth in admin-only modes
    if (isAdminOnlyMode) {
      const modeText = isMaintenanceMode ? 'maintenance' : 'coming soon'
      toast.error(`Google sign-in is disabled during ${modeText} mode. Please use email/password login or contact an administrator.`)
      return
    }

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      console.error('Google sign-in error:', error)
      toast.error('Failed to sign in with Google. Please try again.')
    }
  }

  return (
    <SocialButton
      provider="google"
      onClick={handleGoogleSignIn}
      disabled={isAdminOnlyMode}
      label={isAdminOnlyMode ? "Google Sign-in Disabled" : undefined}
    />
  )
}