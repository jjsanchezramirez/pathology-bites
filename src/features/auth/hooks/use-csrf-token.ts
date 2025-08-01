// src/features/auth/hooks/use-csrf-token.ts
'use client'

import { useState, useCallback } from 'react'

const CSRF_HEADER_NAME = 'x-csrf-token'

interface CSRFTokenHook {
  token: string | null
  isLoading: boolean
  error: string | null
  getToken: () => Promise<string>
  addTokenToFormData: (formData: FormData, csrfToken: string) => void
  addTokenToHeaders: (headers: HeadersInit, csrfToken: string) => HeadersInit
  clearToken: () => void
}

// React hook for CSRF token management
export function useCSRFToken(): CSRFTokenHook {
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getToken = useCallback(async (): Promise<string> => {
    // Return cached token if available and not expired
    if (token) {
      return token
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`)
      }

      const data = await response.json()
      
      if (!data.success || !data.token) {
        throw new Error('Invalid CSRF token response')
      }

      setToken(data.token)
      return data.token
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get CSRF token'
      setError(errorMessage)
      console.error('CSRF token fetch error:', err)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [token])

  const addTokenToFormData = useCallback((formData: FormData, csrfToken: string) => {
    formData.append('csrf-token', csrfToken)
  }, [])

  const addTokenToHeaders = useCallback((headers: HeadersInit, csrfToken: string): HeadersInit => {
    return {
      ...headers,
      [CSRF_HEADER_NAME]: csrfToken
    }
  }, [])

  const clearToken = useCallback(() => {
    setToken(null)
    setError(null)
  }, [])

  return {
    token,
    isLoading,
    error,
    getToken,
    addTokenToFormData,
    addTokenToHeaders,
    clearToken
  }
}

// Utility to add CSRF token to forms
export function addCSRFTokenToForm(form: HTMLFormElement, token: string): void {
  // Remove existing CSRF token input if present
  const existingInput = form.querySelector('input[name="csrf-token"]')
  if (existingInput) {
    existingInput.remove()
  }

  // Add new CSRF token input
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = 'csrf-token'
  input.value = token
  form.appendChild(input)
}

// Constants for client-side use
export const CSRF_CONSTANTS = {
  HEADER_NAME: CSRF_HEADER_NAME
} as const
