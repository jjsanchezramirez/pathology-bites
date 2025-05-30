// src/components/auth/google-sign-in-button.tsx
'use client'

import { createClient } from '@/shared/services/client'
import { SocialButton } from '@/features/auth/components/ui/social-button'

export function GoogleSignInButton() {
  const handleGoogleSignIn = async () => {
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      console.error('Google sign-in error:', error)
      // You could show a toast here if you want
    }
  }

  return <SocialButton provider="google" onClick={handleGoogleSignIn} />
}