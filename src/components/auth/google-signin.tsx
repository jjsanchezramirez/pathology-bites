// src/components/auth/google-signin.tsx
"use client"

import { useEffect, useCallback } from 'react'
import Script from 'next/script'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface GoogleSignInProps {
  onSignInStart?: () => void
  onSignInEnd?: () => void
}

interface GoogleCredentialResponse {
  credential: string;
  select_by: string;
  client_id?: string;
}

interface GoogleInitializeConfig {
  client_id: string;
  callback: string;
  auto_select: boolean;
  cancel_on_tap_outside: boolean;
}

interface GoogleButtonOptions {
  type: 'standard' | 'icon';
  theme: 'outline' | 'filled_blue' | 'filled_black';
  size: 'large' | 'medium' | 'small';
  text: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment: 'left' | 'center';
  width?: number;
}

export function GoogleSignIn({ onSignInStart, onSignInEnd }: GoogleSignInProps) {
  const router = useRouter()
  const { toast } = useToast()

  // Handle the Google credential response
  const handleCredentialResponse = useCallback(async (response: GoogleCredentialResponse) => {
    try {
      onSignInStart?.()
      console.log("Google authentication successful, verifying with Supabase...")
      
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
      })
      
      if (error) throw error
      
      // Get user profile from database
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .single()
      
      // If user doesn't exist in the database, create a record
      if (profileError) {
        console.log("Creating new user profile")
        const metadata = data.user.user_metadata

        await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          first_name: metadata.full_name?.split(' ')[0] || '',
          last_name: metadata.full_name?.split(' ').slice(1).join(' ') || '',
          role: 'user',
          user_type: 'other'
        })
        
        toast({
          description: "Account created successfully!"
        })
        
        router.push('/dashboard')
      } else {
        toast({
          description: "Signed in successfully!"
        })
        
        // Redirect based on role
        if (userProfile.role === 'admin') {
          router.push('/admin/dashboard')
        } else {
          router.push('/dashboard')
        }
      }
    } catch (error) {
      console.error('Authentication error:', error)
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "Authentication failed"
      })
    } finally {
      onSignInEnd?.()
    }
  }, [router, toast, onSignInStart, onSignInEnd])

  // Initialize Google Sign-In when component mounts
  useEffect(() => {
    // Define the callback function globally so Google's library can access it
    window.handleCredentialResponse = handleCredentialResponse
    
    // The Google library will initialize after the script loads
    return () => {
      // Clean up the global function when component unmounts
      delete window.handleCredentialResponse
    }
  }, [handleCredentialResponse])

  return (
    <>
      {/* Load the Google client library */}
      <Script 
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => {
          // Initialize Google Sign-In after the script loads
          window.google?.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',  // Add fallback empty string
            callback: 'handleCredentialResponse',
            auto_select: false,
            cancel_on_tap_outside: true,
          })          
          
          // Display the Google Sign-In button
          window.google?.accounts.id.renderButton(
            document.getElementById('google-signin-button')!,
            { 
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 280
            }
          )
        }}
      />
      
      {/* Container for the Google Sign-In button */}
      <div id="google-signin-button" className="flex justify-center my-2"></div>
    </>
  )
}

// Extend Window interface to include Google Sign-In properties
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleInitializeConfig) => void;
          renderButton: (element: HTMLElement, options: GoogleButtonOptions) => void;
          prompt: () => void;
        }
      }
    }
    handleCredentialResponse?: (response: GoogleCredentialResponse) => void; // Make this optional with ?
  }
}