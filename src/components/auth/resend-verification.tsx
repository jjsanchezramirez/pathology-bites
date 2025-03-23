// src/components/auth/resend-verification.tsx
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from "@/hooks/use-toast"
import { Icons } from "@/components/theme/icons"

interface ResendVerificationProps {
  email: string
}

export function ResendVerification({ email }: ResendVerificationProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const supabase = createClientComponentClient()
  const { toast } = useToast()
  
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [cooldown])
  
  const handleResend = async () => {
    try {
      setIsLoading(true)
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback?type=signup_confirmation&next=/email-verified`
        }
      })
      
      if (error) throw error
      
      toast({
        description: "Verification email has been resent. Please check your inbox.",
      })
      
      // Set cooldown for 60 seconds to prevent abuse
      setCooldown(60)
    } catch (error) {
      console.error('Error resending verification:', error)
      toast({
        variant: "destructive",
        description: error instanceof Error 
          ? error.message 
          : "Failed to resend verification email. Please try again later.",
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="text-center mt-4">
      <p className="text-sm text-muted-foreground mb-2">
        Didn't receive the email?
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={isLoading || cooldown > 0}
      >
        {isLoading ? (
          <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
        ) : null}
        {cooldown > 0 
          ? `Resend in ${cooldown}s` 
          : 'Resend verification email'}
      </Button>
    </div>
  )
}