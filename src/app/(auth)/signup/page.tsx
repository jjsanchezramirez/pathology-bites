// src/app/signup/page.tsx
"use client"

import { SignupForm } from '@/components/auth/signup-form'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import React from 'react'

const SignUpPage: React.FC = () => {
  const router = useRouter()
  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const handleGoogleSignUp = async () => {
    try {
      const redirectUrl = `${window.location.origin}/api/auth/callback`
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        if (error.message?.includes('already exists')) {
          toast({
            description: "This email address is already registered. Please sign in instead.",
            duration: 5000
          })
          return
        }
        throw error
      }
      
    } catch (error: Error | unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to connect to Google. Please try again.",
      })
      console.error('Google signup error:', error)
    }
  }

  const handleSignup = async (values: {
    email: string
    password: string
    firstName: string
    lastName: string
    userType: string
  }) => {
    try {
      // First check if the email exists in the users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', values.email)
        .single()

      if (existingUser) {
        toast({
          description: "This email address is already registered. Please sign in instead.",
          duration: 5000
        })
        return
      }

      // Proceed with signup if email doesn't exist
      const { error: signUpError, data } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            user_type: values.userType,
          },
          emailRedirectTo: `${window.location.origin}/confirm`
        },
      })
  
      if (signUpError) {
        if (signUpError.message?.includes('already registered')) {
          toast({
            description: "This email address is already registered. Please sign in instead.",
          })
          return
        }
        throw signUpError
      }
  
          // Store signup data in user metadata for later profile creation
      if (data.user) {
        await supabase.auth.updateUser({
          data: {
            first_name: values.firstName,
            last_name: values.lastName,
            user_type: values.userType,
          }
        })
      }
  
      router.push("/verify-email")
    } catch (error: Error | unknown) {
      console.error('Error:', error);
      toast({
        variant: "destructive",
        description: "Something went wrong. Please try again."
      })
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-sm space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <SignupForm 
            onSubmit={handleSignup}
            onGoogleSignUp={handleGoogleSignUp}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}

export default SignUpPage