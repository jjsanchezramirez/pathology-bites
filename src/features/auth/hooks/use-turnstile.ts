// src/features/auth/hooks/use-turnstile.ts
'use client'

import { useState, useCallback } from 'react'

interface UseTurnstileReturn {
  captchaToken: string | null
  setCaptchaToken: (token: string | null) => void
  resetCaptcha: () => void
  isCaptchaValid: () => boolean
}

/**
 * Custom hook for managing Cloudflare Turnstile CAPTCHA token state
 * Used in authentication forms (signup, login, password reset)
 * 
 * @returns Object containing captcha token state and utility functions
 */
export function useTurnstile(): UseTurnstileReturn {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)

  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null)
  }, [])

  const isCaptchaValid = useCallback(() => {
    return captchaToken !== null && captchaToken.length > 0
  }, [captchaToken])

  return {
    captchaToken,
    setCaptchaToken,
    resetCaptcha,
    isCaptchaValid,
  }
}

