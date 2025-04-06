// src/app/(auth)/signup/page.tsx
"use client"

import { useState } from 'react'
import { SignupForm } from '@/components/auth/signup-form'
import { useRouter } from 'next/navigation'
import { Microscope } from "lucide-react"
import Link from 'next/link'
import { useNetworkStatus } from '@/hooks/use-network-status'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import type { SignupFormData } from '@/types/auth'

export default function SignupPage() {
  const router = useRouter()
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
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <SignupForm 
            onSubmit={handleSignup}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  )
}