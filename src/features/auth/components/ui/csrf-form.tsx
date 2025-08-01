// src/features/auth/components/ui/csrf-form.tsx
'use client'

import { useEffect, useRef } from 'react'
import { useCSRFToken } from '@/features/auth/hooks/use-csrf-token'

interface CSRFFormProps {
  children: React.ReactNode
  action: (formData: FormData) => void
  className?: string
}

export function CSRFForm({ children, action, className }: CSRFFormProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const { getToken } = useCSRFToken()

  useEffect(() => {
    // Add CSRF token to form when component mounts
    const addTokenToForm = async () => {
      if (formRef.current) {
        try {
          const token = await getToken()
          
          // Remove existing CSRF token input if present
          const existingInput = formRef.current.querySelector('input[name="csrf-token"]')
          if (existingInput) {
            existingInput.remove()
          }

          // Add new CSRF token input
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = 'csrf-token'
          input.value = token
          formRef.current.appendChild(input)
        } catch (error) {
          console.error('Failed to add CSRF token to form:', error)
        }
      }
    }

    addTokenToForm()
  }, [getToken])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    
    if (formRef.current) {
      try {
        // Ensure we have a fresh CSRF token before submitting
        const token = await getToken()
        
        // Update the CSRF token in the form
        const csrfInput = formRef.current.querySelector('input[name="csrf-token"]') as HTMLInputElement
        if (csrfInput) {
          csrfInput.value = token
        }

        // Create FormData and call the action
        const formData = new FormData(formRef.current)
        action(formData)
      } catch (error) {
        console.error('Form submission error:', error)
        // You might want to show an error message to the user here
      }
    }
  }

  return (
    <form 
      ref={formRef}
      onSubmit={handleSubmit}
      className={className}
    >
      {children}
    </form>
  )
}
